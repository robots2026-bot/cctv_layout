# 后端接口对接规范 v1

本文档为前后端协作的唯一接口基线，所有 API 变更必须先在此文档对齐后再实施。内容包括通用约定、REST 接口分组以及实时通道事件描述。

## 0. 通用约定

- **Base URL**：`/api`（前端通过 `VITE_API_BASE_URL` 覆盖；默认同源代理）。
- **认证**：所有请求需附带 `Authorization: Bearer <token>`，未认证返回 `401`.
- **传输格式**：`Content-Type: application/json; charset=utf-8`。文件上传等后续补充。
- **成功响应**：各接口直接返回业务数据对象或数组，无额外包裹层；HTTP 状态 2xx。
- **错误响应结构**：
  ```json
  {
    "error": "BadRequest",
    "message": "具体错误描述",
    "details": { ... } // 可选
  }
  ```
- **分页参数默认值**：`page=1`、`pageSize=20`；服务端需返回 `meta` 与 `totals`（详见项目接口）。

## 1. 项目管理接口（Projects）

### 1.1 查询项目列表
- **Method**：GET `/projects`
- **Query 参数**：
  - `page`/`pageSize`：分页控制；前端默认 20，每页上限建议 100。
  - `status`：`active|archived|deleted`；未传视为 `active`。
  - `stage`：`planning|construction|completed|archived`，`all` 时不传。
  - `keyword`：模糊搜索（名称、编号等）。
  - `region`：区域过滤。
  - `includeDeleted`：布尔；true 时返回已删除项目。
  - `orderBy`：`name|updatedAt`；`order`：`asc|desc`。
  - `codeGte`/`codeLte`：通信 ID 范围过滤。
- **响应** `200 OK`：
  ```json
  {
    "items": [ProjectListItem, ...],
    "meta": { "page": 1, "pageSize": 20, "totalItems": 45, "totalPages": 3 },
    "totals": { "total": 45, "active": 32, "archived": 10, "deleted": 3 }
  }
  ```
- **数据结构** `ProjectListItem`：
  ```json
  {
    "id": "uuid",
    "code": 12,
    "name": "一期工地",
    "region": "南京江北",
    "locationText": "江北新区 1 号地块",
    "stage": "construction",
    "status": "active",
    "plannedOnlineAt": "2025-03-01T00:00:00Z",
    "description": "夜间施工注意",
    "defaultLayoutId": "uuid",
    "layoutCount": 3,
    "deviceCount": 126,
    "updatedAt": "2025-10-16T12:00:00Z",
    "deletedAt": null
  }
  ```

### 1.2 获取项目详情
- **Method**：GET `/projects/:projectId`
- **响应** `200 OK`：返回 `ProjectDetail`，在列表字段基础上追加：
  - `createdAt`: ISO8601
  - `members`: `ProjectMemberSummary[]`
  - `recentLayouts`: `{ id, name, updatedAt }[]`

### 1.3 创建项目
- **Method**：POST `/projects`
- **请求体**（对应前端 `CreateProjectPayload`）：
  ```json
  {
    "name": "一期工地",
    "code": 12,                       // 0-255 整数
    "stage": "planning",              // 可选
    "region": "南京江北",              // 可选
    "description": "夜班施工提醒",      // 可选
    "plannedOnlineAt": "2025-03-01",   // 可选
    "includeDefaultMembership": true,  // 默认 true
    "createdBy": "user-uuid",          // 可选
    "location": {                      // 可选
      "text": "江北新区 1 号地块",
      "lat": 32.12,
      "lng": 118.72
    }
  }
  ```
- **响应** `201 Created`：建议返回 `{ "id": "uuid" }` 或完整 `ProjectDetail`。
- **错误**：`409` 当 `code` 已占用。

### 1.4 更新项目
- **Method**：PATCH `/projects/:projectId`
- **请求体**：任意 `CreateProjectPayload` 字段的子集 + `status`（`active|archived|deleted`）。
- **响应** `200 OK`：返回更新后的 `ProjectDetail`。

### 1.5 删除项目（软删除）
- **Method**：DELETE `/projects/:projectId`
- **请求体**：
  ```json
  {
    "reason": "项目终止",            // 可选
    "archiveLayouts": true,        // 默认 true
    "keepDeviceMappings": true     // 默认 true
  }
  ```
- **响应** `204 No Content`。
- **行为**：项目状态应转为 `deleted`，并按配置处理关联布局/设备。

### 1.6 恢复项目
- **Method**：POST `/projects/:projectId/restore`
- **请求体**：`{ "reason": "重新开工" }`（可选）。
- **响应** `200 OK`：返回恢复后的 `ProjectDetail`。

## 2. 布局服务接口（Layouts）

### 2.1 创建布局
- **Method**：POST `/layouts`
- **请求体**：
  ```json
  {
    "projectId": "uuid",
    "name": "默认布局"
  }
  ```
- **响应** `201 Created`：`{ "id": "layout-uuid" }`。
- **备注**：创建时需要同步生成空画布结构 & 初始版本快照。

### 2.2 获取布局详情
- **Method**：GET `/layouts/:layoutId`
- **响应** `200 OK`：`CanvasLayout`
  ```json
  {
    "id": "layout-uuid",
    "name": "默认布局",
    "projectId": "uuid",
    "background": { "url": "https://..." }, // 可为空
    "blueprint": {
      "url": "https://...",
      "naturalWidth": 2480,
      "naturalHeight": 3508,
      "scale": 0.72,
      "opacity": 0.85,
      "offset": { "x": 120, "y": 320 }
    },
    "elements": [CanvasElement, ...],
    "connections": [CanvasConnection, ...]
  }
  ```
  - `CanvasElement`：包含 `id/name/type/deviceId/metadata/position/size/selected`。
  - `metadata` 至少包含 `ip`、`status`、`model`、`sourceDeviceId`。
  - `CanvasConnection`：包含 `id/from/to/kind/fromDeviceId/toDeviceId/bandwidth/status`。前端规则：当连接两端均为 Bridge 时渲染双线，其余情况渲染单线；无线链路沿用虚线表示。

### 2.3 保存布局（预留）
- **Method**：PUT `/layouts/:layoutId`
- **请求体**：`CanvasLayout` 的可更新子集（`elements`、`connections`、`blueprint` 等）。
- **响应** `200 OK`：返回最新 `CanvasLayout` 与 `versionId`。
- **备注**：保存时需生成版本快照，并通过实时通道广播。

## 3. 设备资源接口（Devices）

### 3.1 查询待布局设备
- **Method**：GET `/projects/:projectId/devices`
- **用途**：用于设备侧栏拉取未放置设备列表；服务端需过滤掉已在当前布局中的设备。
- **响应** `200 OK`：
  ```json
  [
    {
      "id": "device-uuid",
      "name": "1#塔吊摄像机",
      "type": "Camera",
      "model": "DS-2DE4225IW",
      "ip": "192.168.10.15",
      "status": "online"
    }
  ]
  ```

### 3.2 手动注册/更新设备
- **Method**：POST `/projects/:projectId/devices/register`
- **请求体**：
  ```json
  {
    "name": "1#塔吊摄像机",         // 可为空，后端需允许
    "type": "Camera",               // 必填，限定枚举：Camera|NVR|Bridge|Switch
    "model": "DS-2DE4225IW",        // 必填，交换机默认 V600
    "ipAddress": "192.168.10.15",   // Camera/NVR/Bridge 必填；Switch 可省略
    "status": "unknown"             // 可选：online|offline|unknown
  }
  ```
- **响应** `200 OK`：
  ```json
  {
    "id": "device-uuid",
    "name": "1#塔吊摄像机",
    "type": "Camera",
    "model": "DS-2DE4225IW",
    "ipAddress": "192.168.10.15",
    "status": "unknown",
    "projectId": "uuid",
    "metadata": { "model": "DS-2DE4225IW" }
  }
  ```
- **行为**：
  - 若 IP 已存在同项目，执行幂等更新。
  - 保存后应通过实时通道 `device.update` 推送。

## 4. 实时通道（Socket.IO）

- **连接地址**：`ws(s)://<host>:<port>`，`path = /realtime`。
- **鉴权**：推荐通过 `auth: { token }` 或 `query.token` 传递，同步校验。
- **房间管理**：后端需支持订阅 `project:<projectId>`，以便按项目推送事件。

### 4.1 服务器向客户端事件
| 事件名 | 触发场景 | Payload |
|--------|----------|---------|
| `device.update` | 设备状态/属性变更（注册、去重、心跳更新） | `{ id, name, type, model, ip, status }` |
| `presence.sync` | 项目成员在线状态同步 | `{ users: string[] }`（用户标识列表） |
| `projects.updated` | 项目增删改、恢复 | `{ projectId, action: "created" \| "updated" \| "archived" \| "deleted" \| "restored" }` |
| `layout.version` | 布局保存生成新版本 | `{ layoutId, versionId }` |

### 4.2 客户端建议的订阅流程
1. 连接后发送 `socket.emit('project.join', { projectId })`（待后端实现），加入项目房间。
2. 在路由切换时调用 `project.leave` 退出旧项目，避免冗余推送。
3. 前端在 `device.update` 后根据 `device.id` 决定更新未布局列表或忽略（画布上已使用的设备不再加入列表）。

## 5. 变更流程要求

- 新增或调整接口前，必须在本文件中更新对应章节，并标记版本号/日期。
- 前后端需以此文档为准完成联调，未经记录的接口视为未对齐。
- 重要字段或响应格式变化需同步评估：数据库迁移、权限策略、实时推送影响。

---

最近更新时间：2025-10-16
