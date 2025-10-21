# CCTV 布局系统方案设计

## 1. 总体目标
构建一个可在工地现场快速完成 CCTV 与网桥部署规划的 Web 应用，实现设备扫描、布局展示、手动拖拽定位等核心需求。

## 2. 系统架构
- **前端**：
  - 技术选型：React + TypeScript + Zustand 进行状态管理，配合 Tailwind CSS 提升样式开发效率。
  - 布局编辑：采用 Konva.js 支持 Canvas 拖拽、缩放、连接线绘制，使用 react-konva 封装组件；新增蓝图图层用于导入工地平面图并可独立缩放，画布模式扩展 `blueprint` 以隔离图纸调整与设备操作。
  - 通信：通过 WebSocket 接收实时设备扫描推送，REST API 执行常规数据管理操作。
  - 交付与本地访问：统一由 Nginx 容器暴露静态资源与反向代理；开发、测试与生产均通过 `http://localhost:8080` 进入应用，Nginx 根据 `/api/*`、`/realtime/*` 路径将请求转发至后端服务，避免前端跨域或端口差异问题。
- **后端**：
  - 技术选型：Node.js（NestJS 框架）作为唯一后端框架选择，统一采用 TypeScript 编写服务。
  - 功能模块：
    - 设备发现与接入模块：从网络扫描服务或第三方平台获取设备列表。
    - 布局管理模块：存储项目、平面图、设备位置及连线。
    - 文件服务：通过对象存储（MinIO/S3 兼容）处理背景图、蓝图上传，提供预签名直传、元数据管理与缩略图生成。
    - 推送服务：通过 WebSocket 将最新设备状态推送至前端。
  - 数据库：PostgreSQL 存储结构化数据，Redis 缓存实时设备状态并辅助消息发布订阅。

### 2.1 前端架构细化
- **页面结构**：
  - 登录/项目概览页：展示项目卡片、最近更新时间、设备总览。
  - 布局工作台：左侧项目导航（含快速搜索，可折叠）+ 中央画布区（Konva Stage）+ 右侧未布局设备面板（可折叠）+ 浮动属性编辑面板。
  - 系统设置页：维护扫描周期、默认图层可见性、团队成员权限。
  - 模拟网关调试页：提供项目通信 ID、网关标识（MAC/IP）、采样时间及设备列表（可增删行、调序）编辑区，网桥设备需确认 AP/ST 角色；设备在线状态由后端自动判定（出现即视为在线，连续 3 分钟未出现即自动离线），页面仅保留附加状态标签录入；支持延迟/丢包等指标录入、实时 JSON 预览与一键推送 `POST /device-sync`，发送结果在页面内以成功/失败列表呈现。
- **项目管理界面（更新）**：
  - 入口 `/projects/manage` 采用“左侧筛选栏 + 右侧列表 + 详情抽屉”布局；顶部仅保留指标卡片与“新建项目”按钮；
  - 筛选栏提供状态、阶段、地区、通信 ID 范围及排序选项，变更即时刷新；
  - 列表列包含通信 ID、项目名称、地区、阶段、摄像头数、布局数、最近更新时间、状态、操作；点击行打开详情抽屉；
  - 详情抽屉展示基础信息、统计、最近 5 条布局、成员列表，并提供归档/恢复/删除操作；
  - 新建/编辑/删除依旧通过右侧抽屉与确认对话框完成，前端负责通信 ID 的 0-255 范围校验。
- **状态切片**：
  1. `projectStore`：项目元信息、成员、权限，负责发起 REST 查询。
  2. `canvasStore`：画布元素集合、选择状态、图层可见性、撤销重做栈，封装对 Konva 节点的纯数据操作。
  3. `realtimeStore`：WebSocket 连接状态、在线成员列表、实时设备心跳，并合并后端推送的设备元数据（含 `metadata.bridgeRole`）；设备在线/离线以后台推送为准，无需前端手动维护。
  4. `uiStore`：模态窗口、通知、全局加载态。
  - 模拟网关调试页使用局部状态（`useReducer` + `useMemo`）组合校验与预览，通过 `apiClient.post('/device-sync')` 直接完成推送，不新增全局 store；状态字段自动补齐在线标识。
- **组件划分**：
  - 原子组件：按钮、表单、弹窗等，通过 Tailwind 原子类与 Radix UI 组合实现。
  - 画布组件：`CanvasStage`、`DeviceNode`、`ConnectionLine`、`GridBackground`，严格区分展示型与容器型组件；蓝图相关能力拆分为 `BlueprintLayer` 与 `BlueprintControls`，由 `canvasStore.mode` 中的 `blueprint` 态控制交互，保持背景缩放/位置逻辑独立并防止误操作。
  - 侧栏组件：`DevicePalette`（可拖拽列表，使用图形化图标与绿色/深灰背景区分设备在线状态；网桥节点追加 AP/ST 徽章，快速识别上下行角色）、`PropertyPanel`、`VersionHistory`。
  - 交换机仅展示名称，不支持别名；上下文菜单仅保留“隐藏”，避免与其它设备共享的别名编辑入口。
  - 网桥连线约束：同一项目的网桥节点按角色渲染不同的连接类型。`AP ⇄ ST` 使用带方向的双虚线表示桥接链路；`AP`/`ST` 与其他设备之间使用实线；`AP ⇄ AP`、`ST ⇄ ST` 不允许绘制双虚线以防止错误拓扑。
  - 调试组件：`GatewayMockForm` 负责收集基础字段，`MockDeviceTable` 支撑设备行编辑与批量导入，`PayloadPreview` 展示实时 JSON 与校验告警，`MockSendResult` 输出后端响应与错误提示。
- **性能策略**：
  - 使用 `react-konva` 的 `FastLayer` 渲染大量静态图元。
  - 通过 requestAnimationFrame 合并高频拖拽状态更新。
  - 对设备列表与属性面板采用虚拟滚动，减轻 DOM 负载。
  - 在 Zustand 中使用选择器与浅比较，避免无关组件重渲染。
- **可扩展性**：
  - 建立统一的 `CanvasElement` 类型定义，约束自定义节点扩展接口。
  - 将导出能力封装为 hooks（如 `useExportImage`、`useExportConfig`），方便复用与测试。

### 2.2 后端架构细化
- **分层结构**：NestJS `modules` → `controllers`/`resolvers` → `services` → `repositories`/`integrations`，以依赖注入提升可测试性。
- **核心模块职责**：
  1. `ProjectsModule`：项目 CRUD、成员与权限管理、操作日志落库；`GET /api/projects` 支持排序、通信 ID 区间与统计返回，`GET /api/projects/:id` 输出成员与近期布局摘要，若项目存在布局但未设默认布局会自动填充；其余 CRUD 接口沿用软删除/恢复语义，通过 `ProjectsGateway` 广播 `projects.updated` 同步侧边栏。
  2. `DevicesModule`：对接扫描器（REST/消息队列），执行设备标准化、幂等写入、状态同步；非交换机设备以 MAC 地址与项目 ID 形成唯一约束（数据库主键仍使用 UUID），设备新增仅来自网关。交换机禁止设置别名、仅保留名称，并在项目维度内强制唯一；提供清理脚本去除存量重复记录。前端仅允许对未布局设备维护“别名”和执行“隐藏”动作：隐藏后记录 `hidden_at`，后续网关推送同一 MAC 会自动清除；别名为空时界面使用网关同步的原始名称。设备在线状态由同步任务自动维护：本次快照出现即标记为 `online`，连续 3 分钟未出现即降为 `offline`。后端依据各布局当前版本过滤已落位或已隐藏的设备，防止画布数据失配，并在 `metadata.bridgeRole` 中持久化网桥 AP/ST 角色，供画布与侧栏展示。
  3. `LayoutsModule`：保存画布 JSON、维护版本链、处理冲突合并；首次创建布局时若项目无默认布局自动设为默认。
  4. `FilesModule`：处理背景图上传（S3 兼容存储）、生成缩略图、提供受控访问链接。
  5. `RealtimeGateway`：基于 `@nestjs/websockets`，统一管理房间订阅、事件广播、心跳检测。
  6. `AuthModule`：JWT + Refresh Token、角色鉴权守卫、密码策略、审计钩子。
- **数据访问**：采用 TypeORM（或 Prisma with PostgreSQL Driver）实现实体映射，配合迁移脚本管理 schema。
- **异步任务**：引入 BullMQ（Redis）处理扫描重试、批量导入、版本快照清理、导出任务。
- **配置管理**：使用 `@nestjs/config` 支持多环境配置，敏感信息读取自 `.env`/密钥管理服务。
- **日志与观测**：整合 Pino/Winston 输出结构化日志，暴露 `/metrics` Prometheus 指标，接入 OpenTelemetry 收集 trace。

### 2.3 集成与部署
- **API 网关层**：Nginx/Traefik 负责 TLS 终止、静态资源缓存、WebSocket 代理。
- **部署拓扑**：
  - 前端构建后部署于对象存储 + CDN 或 Nginx 静态站点。
  - 后端与扫描服务以 Docker Compose/Kubernetes 部署，提供滚动更新策略。
  - PostgreSQL 与 Redis 独立部署并配置备份、主从高可用。
- **CI/CD**：GitHub Actions 触发测试、构建、镜像推送；环境变量经由 Secrets 管理；提供预发环境供产品验收。
- **安全加固**：启用 WAF/安全组限制来源 IP，使用 Vault/KMS 管理密钥，定期审计依赖漏洞。

### 2.4 数据流与消息协议
- **REST API 分层**：
  - `/api/projects`：分页查询（名称/编号/状态/阶段筛选）、创建、更新、归档、软删除、恢复、批量操作；子资源包含 `/members` 用于成员维护。
  - `/api/devices`：设备列表查询、状态过滤、手动录入、批量导入。
  - `/api/layouts`：布局读取、保存、版本对比、导出任务创建。
  - `/api/files`：背景图上传、签名 URL 获取、删除。
  - `/api/auth`：登录、刷新、注销、密码找回。
- **WebSocket 事件命名**：
  - `device.update`：推送设备状态变更（在线/离线、信号强度、告警）。
  - `layout.lock`：广播画布锁定/释放信息，避免冲突写。
  - `layout.patch`：传递增量更新（diff/patch），支持多人协作。
  - `presence.sync`：同步在线成员、光标位置、当前选中元素。
- **消息格式约定**：
  - 统一包裹 `{ event: string, payload: any, timestamp: number }` 结构。
  - 关键字段如设备 ID、布局元素 ID 均使用 UUIDv4，避免前后端冲突。
  - 大型 payload（> 200KB）改走文件或任务形式，WebSocket 只下发引用。

### 2.5 配置与环境
- **环境划分**：`development`、`staging`、`production`，通过 `NODE_ENV` 区分。
- **可配置项**：
  - 扫描任务周期、重试策略、并发上限。
  - 布局快照保留数量、自动清理阈值。
  - 背景图文件大小/格式限制。
- **Secrets 管理**：集中由密钥管理服务下发，容器中仅读取一次；本地开发使用 `.env.local`。
- **特性开关**：引入 `config/feature-flags.ts` 管理灰度功能，如高级协作、第三方摄像头协议。


## 3. 核心功能模块拆分
1. **项目管理**
   - 创建/编辑/删除工地项目。
   - 项目级权限控制与协作。
2. **设备扫描与同步**
   - 现场有扫描，定时推送平台设备列表及其状态。
   - 设备信息标准化（类型、IP、状态、厂商）。
   - 重复设备判定策略与状态更新。
3. **布局画布**
  - 背景图导入与缩放；支持单独导入施工图蓝图，可调节透明度、缩放比例与偏移，而不影响整体视口缩放。
   - 设备元素拖拽放置、旋转、属性编辑（画布卡片仅显示名称/IP，背景随在线状态变色）。
   - 节点悬停展示详情浮窗，左键不再触发选中。
   - 连线工具：在“连线模式”下点击两个设备即可创建连接，自动吸附端口并以双轨箭纹展示上下行数据。
   - 图层管理：显示/隐藏不同设备类型、网桥、辅助标记、有线连接、无线连接。
4. **实时更新与协作**
   - 多用户同时编辑的锁定/合并策略。
   - 实时设备状态展示（在线/离线、信号强度）。
5. **数据存储与版本控制**
   - 布局快照与历史版本保存。
   - 导出布局（PNG、PDF、JSON 配置）。
6. **权限与审计**
   - 登录认证、角色权限（管理员、工程师、访客）。
   - 操作日志记录。

## 4. 关键流程
1. **设备接入流程**：扫描设备将结果推送的平台后端 → 后端设备同步服务 → 数据库存储/更新 → WebSocket 推送到前端 → 前端设备列表更新。
2. **布局编辑流程**：用户选中设备 → 拖拽到画布 → 前端生成布局 JSON → 后端保存 → 版本记录与实时广播。
3. **背景图/蓝图管理流程**：用户上传 → 前端请求对象存储预签名 URL → 浏览器直传至 MinIO/S3 → 上传完成后回传 `fileId`/`publicUrl` 并写入布局版本元数据（保留尺寸与偏移）→ 前端渲染蓝图 → 用户在蓝图模式下调整缩放/透明度/位置（独立于视口缩放）。
4. **项目生命周期流程（新增）**：用户在管理界面创建/删除/归档项目 → 前端校验后调用 `ProjectsService` → 事务性写入/更新 `projects`、`project_members`、`activity_logs` → 触发 BullMQ 任务重建默认布局缓存与统计 → WebSocket 广播 `projects.updated` 刷新前端列表与侧边栏。

## 5. 数据模型草案
- `projects`：id、code（唯一）、name、location_text、location_geo（Point）、stage（planning|construction|completed|archived）、status（active|archived|deleted）、planned_online_at、description、layout_count_cache、device_count_cache、created_by、created_at、updated_at、deleted_at。
- `project_members`：id、project_id、user_id、role（owner|maintainer|viewer）、invited_at、has_notifications、created_at、updated_at。
- `devices`：id、project_id、type、name、ip、status、metadata、last_seen_at。
- `layouts`：id、project_id、name、background_image_url、background_opacity、current_version_id。
- `layout_versions`：id、layout_id、version_no、elements_json、connections_json、created_by、created_at。
- `users`：id、name、email、password_hash、role。
- `activity_logs`：id、project_id、user_id、action、details、created_at。
- **索引策略**：`projects` 在 `code`、`status`、`deleted_at` 建联合索引，`project_members` 在 `(project_id, user_id)` 建唯一索引，`activity_logs` 在 `project_id`、`created_at` 上建组合索引以支撑审计查询。

## 6. 非功能性需求
- **性能**：画布保证 200+ 设备流畅拖拽；WebSocket 推送延迟 < 2s。
- **可靠性**：设备同步失败自动重试，关键操作具备幂等性。
- **安全**：全站 HTTPS，Token 鉴权，设备敏感信息脱敏处理。
- **可运维性**：Docker 化部署，Prometheus + Grafana 监控。

## 7. 项目里程碑建议
1. **需求确认阶段（1 周）**：细化设备类型、平台接口、用户角色需求。
2. **原型设计与技术选型（2 周）**：完成界面原型、组件选型、技术预研。
3. **基础功能开发（4 周）**：实现项目管理、设备同步、基础布局编辑。
4. **高级功能开发（3 周）**：实时协作、版本管理、导出能力。
5. **测试与部署（2 周）**：性能测试、安全测试、上线准备。

## 8. 风险与应对
- **设备平台接口不稳定**：预留模拟数据与重试机制。
- **画布性能瓶颈**：前期预研 Konva/Fabric 优化手段，采用虚拟化列表与图层管理。
- **多人协作冲突**：引入乐观锁或 CRDT 同步方案，确保数据一致性。

## 9. 当前实现进展（2025-10）

1. **前端骨架**
   - Vite + React + TypeScript + Tailwind + Zustand 已完成初始化。
  - 画布区实现 `CanvasStage`、`DeviceNode`、`ConnectionLine` 等核心组件，支持背景图展示、拖拽放置、缩放视图。节点根据类型渲染差异化图形，并用颜色标识在线状态。
   - 状态切片按照方案拆分为 `projectStore`、`canvasStore`、`layoutStore`、`realtimeStore`、`uiStore`，并封装 WebSocket 连接 hook。
   - 预置布局工作台、项目概览页面与通知侧栏，便于后续集成更多交互。

2. **后端骨架**
   - NestJS 工程完成模块划分：项目、设备、布局、文件、认证、实时、健康检查、操作日志。
   - 集成 TypeORM + PostgreSQL 实体：项目、设备、布局、布局版本、用户、活动日志。
   - 设备同步服务实现去重逻辑，联动实时网关与操作日志；布局服务支持版本快照写入与广播事件。
   - 引入 Socket.IO 网关 `RealtimeGateway`，暴露 `device.update`、`layout.version` 等事件，支撑前端实时需求。

3. **工程化与运维**
   - 前后端均提供独立 Dockerfile 与 npm scripts；前端 `npm run build`、后端 `npm run build` 均通过。
   - README 已更新为快速启动指南，明确运行方式与环境变量约定。
   - Docker Compose 默认同时启动 `frontend` 与 `nginx`，本地调试需通过 `docker compose up` 保持统一入口；后端 `ALLOWED_ORIGINS` 必须至少包含 `http://localhost:8080` 以匹配代理源站。
