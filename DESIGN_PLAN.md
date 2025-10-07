# CCTV 布局系统方案设计

## 1. 总体目标
构建一个可在工地现场快速完成 CCTV 与网桥部署规划的 Web 应用，实现设备扫描、布局展示、手动拖拽定位以及背景图透明度调整等核心需求。

## 2. 系统架构
- **前端**：
  - 技术选型：React + TypeScript + Zustand 进行状态管理，配合 Tailwind CSS 提升样式开发效率。
  - 布局编辑：采用 Konva.js 支持 Canvas 拖拽、缩放、连接线绘制，使用 react-konva 封装组件。
  - 通信：通过 WebSocket 接收实时设备扫描推送，REST API 执行常规数据管理操作。
- **后端**：
  - 技术选型：Node.js（NestJS 框架）作为唯一后端框架选择，统一采用 TypeScript 编写服务。
  - 功能模块：
    - 设备发现与接入模块：从网络扫描服务或第三方平台获取设备列表。
    - 布局管理模块：存储项目、平面图、设备位置及连线。
    - 文件服务：处理背景图上传、存储与缩略图生成。
    - 推送服务：通过 WebSocket 将最新设备状态推送至前端。
  - 数据库：PostgreSQL 存储结构化数据，Redis 缓存实时设备状态并辅助消息发布订阅。

### 2.1 前端架构细化
- **页面结构**：
  - 登录/项目概览页：展示项目卡片、最近更新时间、设备总览。
  - 布局工作台：包含画布区（Konva Stage）、设备资源列表、属性面板、版本面板。
  - 系统设置页：维护扫描周期、默认图层可见性、团队成员权限。
- **状态切片**：
  1. `projectStore`：项目元信息、成员、权限，负责发起 REST 查询。
  2. `canvasStore`：画布元素集合、选择状态、图层可见性、撤销重做栈，封装对 Konva 节点的纯数据操作。
  3. `realtimeStore`：WebSocket 连接状态、在线成员列表、实时设备心跳。
  4. `uiStore`：模态窗口、通知、全局加载态。
- **组件划分**：
  - 原子组件：按钮、表单、弹窗等，通过 Tailwind 原子类与 Radix UI 组合实现。
  - 画布组件：`CanvasStage`、`DeviceNode`、`ConnectionLine`、`GridBackground`，严格区分展示型与容器型组件。
  - 侧栏组件：`DevicePalette`（可拖拽列表）、`PropertyPanel`、`VersionHistory`。
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
  1. `ProjectsModule`：项目 CRUD、成员与权限管理、操作日志落库。
  2. `DevicesModule`：对接扫描器（REST/消息队列），执行设备标准化、幂等写入、状态同步。
  3. `LayoutsModule`：保存画布 JSON、维护版本链、处理冲突合并。
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
  - `/api/projects`：项目 CRUD、成员管理、权限配置。
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
   - 背景图导入、缩放、透明度调整。
   - 设备元素拖拽放置、旋转、属性编辑。
   - 连线工具：支持自由连线、自动吸附端口。
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
3. **背景图管理流程**：用户上传 → 后端文件服务存储 → 前端加载 → 用户调整透明度（存储在布局配置中）。

## 5. 数据模型草案
- `projects`：id、name、location、created_at、updated_at。
- `devices`：id、project_id、type、name、ip、status、metadata、last_seen_at。
- `layouts`：id、project_id、name、background_image_url、background_opacity、current_version_id。
- `layout_versions`：id、layout_id、version_no、elements_json、connections_json、created_by、created_at。
- `users`：id、name、email、password_hash、role。
- `activity_logs`：id、project_id、user_id、action、details、created_at。

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
   - 画布区实现 `CanvasStage`、`DeviceNode`、`ConnectionLine` 等核心组件，支持背景图透明度调节、拖拽放置、缩放视图。
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
