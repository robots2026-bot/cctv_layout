# 项目列表新增/删除设计

## 背景
- 在项目管理页面中提供统一的列表视图，支持快速新增工地项目与可靠的删除/归档能力。
- 对应后端需要具备筛选、软删除、恢复、统计字段维护与审计记录，保持与实时侧边栏一致。

## 前端界面
- **页面入口**：`/projects/manage`，受 `admin` 与 `maintainer` 角色访问限制。
- **列表布局**：
  - 顶部操作条：展示项目总数、活跃项目、待归档项目三个统计卡片 + `新建项目` 主按钮。
  - 搜索框位于操作条右侧，支持名称/编号模糊匹配，敲回车或失焦触发查询。
  - 列表采用虚拟化表格（React Window）防止 200+ 项目时卡顿，列顺序为：名称、站点编号、地区、施工阶段、摄像头数、最近更新时间、状态、操作。
  - 列头筛选器：状态（active/archived/deleted）、阶段、地区；筛选状态同步至 URL query。
  - 行内操作菜单提供 `查看详情`、`归档`、`删除`、`恢复`（针对已归档/删除项目）等动作。
- **新建项目抽屉**：
  - 触发后右侧滑出宽 480px 抽屉，表单字段：名称（必填，<= 60 字）、站点编号（必填，唯一，正则 `/^[A-Z0-9-]{3,12}$/`）、地区（下拉 + 可搜索）、施工阶段（planning/construction/completed）、计划上线日期（可选）、备注。
  - 提交前运行本地校验；提交后显示加载状态，成功后收起抽屉并滚动列表至新建行，顶部展示成功 toast。
  - 若后端返回站点编号冲突，表单对应字段展示错误提示并保持抽屉打开。
- **删除/归档流程**：
  - 从行内菜单触发 Radix AlertDialog；删除需输入项目名称确认，归档仅需勾选确认复选框。
  - 复选项：`同时归档所有布局版本`、`保留设备映射`，默认全选。选项映射到请求体。
  - 删除调用后提供 5 秒撤销 toast（调用恢复接口），撤销失败给出错误通知并提示刷新。
- **批量操作**：
  - 列表左侧复选框支持多选；顶部在有选择时浮出批量操作条，可执行归档或恢复。
  - 批量删除需管理员权限，且所有所选项目必须为已归档状态。
- **状态管理**：
  - `projectStore` 扩展 `filters`、`selection`、`pagination`、`mutations`，将 REST 调用封装为 `fetchProjects`, `createProject`, `archiveProject`, `deleteProject`, `restoreProject`。
  - Mutations 完成后触发 `realtimeStore.emit('projects.requestSync')`，在收到 `projects.updated` 事件时自动刷新列表与左侧项目栏。

## 后端设计
- **REST 接口**（均位于 `ProjectsController`，采用 `ClassValidator` 校验）：
  - `GET /api/projects`：支持分页参数 `page`, `pageSize`，筛选 `keyword`, `status`, `stage`, `region`, `includeDeleted`；响应包含统计数据 `totals`.
  - `POST /api/projects`：请求体 `name`, `code`, `region`, `stage`, `plannedOnlineAt`, `description`; 创建时计算 `slug` 并写入默认布局草稿；返回新建实体。
  - `PATCH /api/projects/:id`：允许更新基础信息或切换 `status=archived`。
  - `DELETE /api/projects/:id`：软删除，记录 `deleted_at` 并根据请求体布尔参数 `archiveLayouts`, `keepDeviceMappings` 触发对应异步任务。
  - `POST /api/projects/:id/restore`：清空 `deleted_at` 并重建缓存。
  - `POST /api/projects/bulk`：接收 `action=archive|restore` 以及 `ids[]`，以数据库事务执行批量操作。
- **服务流程**：
  - 所有写操作在事务内完成：更新 `projects`, 维护 `project_members` 默认成员（创建者为 owner），记录 `activity_logs`。
  - 创建成功后向 BullMQ 推送 `project.cache.rebuild` 任务以刷新 Redis 中的项目概要数据（设备数、布局数）。
  - 删除/归档时根据选项触发对应队列：`layouts.archive`（批量归档布局版本）、`devices.detach`（解绑设备映射）。
  - 每次变更结束后通过 `ProjectsGateway` 广播 `projects.updated`，payload 包含变更项目 ID 与动作类型。
- **权限控制**：
  - 使用 `RolesGuard` 限制不同接口：创建/批量操作/删除仅 `admin`，归档/恢复允许 `maintainer`。
  - 在 `CanActivate` 中验证用户是否属于目标项目成员或拥有平台管理员角色。
- **审计与幂等**：
  - `DELETE` 请求附带 `reason` 字段写入 `activity_logs.details`。
  - `POST /api/projects` 通过站点编号 `code` 建唯一约束，并在服务层实现若重复则返回已有实体及 409 状态；方便前端提示。

## 数据库设计
- **projects 表**：
  - 新增列：`code VARCHAR(12) UNIQUE`, `location_text`, `location_geo geography(Point,4326) NULL`, `stage VARCHAR(16)`, `status VARCHAR(16)`, `planned_online_at TIMESTAMPTZ`, `description TEXT`, `layout_count_cache INT DEFAULT 0`, `device_count_cache INT DEFAULT 0`, `created_by UUID`, `deleted_at TIMESTAMPTZ`.
  - 索引：`idx_projects_status_stage`(status, stage), `idx_projects_deleted_at`(deleted_at), `idx_projects_location`(USING GIST location_geo)。
- **project_members 表**：
  - 结构：`id UUID`, `project_id UUID`, `user_id UUID`, `role VARCHAR(16)`, `invited_at TIMESTAMPTZ`, `has_notifications BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
  - 唯一约束 `(project_id, user_id)`，以便幂等邀请。
- **activity_logs 表**：
  - 扩充 `action` 枚举包含 `project.created`, `project.archived`, `project.deleted`, `project.restored`。
  - `details` 字段存储 JSON（如 `{ reason: string, options: { archiveLayouts: boolean } }`）。
- **迁移策略**：
  - 编写 TypeORM migration：添加新列时为现有数据填充默认值（`status=active`, `stage=planning`），`created_by` 以系统账号补齐。
  - 回填 `layout_count_cache` 与 `device_count_cache` 通过单独脚本（迁移 `up` 中调用 SQL 聚合）。

## 实施建议
- 拆分 MR：先完成后端 schema + API，再开发前端页面与状态 store，最后串联 WebSocket。
- 在 docker compose 环境中运行 `npm run migration:run`（backend 容器）验证迁移后 API 正常。
- 编写集成测试覆盖：创建重复编号、删除后恢复、批量归档等场景。
