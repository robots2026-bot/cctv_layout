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
      "fileId": "file-uuid",
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

## 3. 文件服务（Files）

### 3.1 获取预签名上传地址
- **Method**：POST `/projects/:projectId/files/presign`
- **请求体**：
  ```json
  {
    "fileName": "blueprint-A1.png",
    "mimeType": "image/png",
    "sizeBytes": 7340032,
    "category": "blueprint",
    "layoutId": "layout-uuid" // 可选
  }
  ```
  - `category`：`blueprint|background|export|other`，服务端将根据类型限制最大体积（蓝图 20MB、背景图 15MB、导出 50MB、其他 10MB）。
  - 若传入 `layoutId`，后端会校验该布局隶属于当前项目。
- **响应** `200 OK`：
  ```json
  {
    "fileId": "file-uuid",
    "uploadUrl": "https://<object-storage>/...",
    "expiresIn": 900,
    "headers": {
      "Content-Type": "image/png"
    },
    "objectKey": "dev/<project>/<category>/..."
  }
  ```
  前端使用返回的 `uploadUrl` 执行浏览器直传（PUT 请求），并保留 `fileId` 便于后续绑定布局。

### 3.2 完成上传
- **Method**：POST `/projects/:projectId/files/:fileId/complete`
- **请求体**：
  ```json
  {
    "sizeBytes": 7340032,
    "width": 2480,
    "height": 3508,
    "etag": "19d0e8f6..." // 可选，S3/MinIO 响应头中的 ETag
  }
  ```
- **响应** `200 OK`：
  ```json
  {
    "id": "file-uuid",
    "projectId": "uuid",
    "layoutId": "layout-uuid",
    "category": "blueprint",
    "url": "https://app.example.com/storage/cctv-layout-assets/dev/...",
    "objectKey": "dev/...",
    "mimeType": "image/png",
    "sizeBytes": 7340032,
    "width": 2480,
    "height": 3508,
    "status": "available"
  }
  ```
  - 若 `OBJECT_STORAGE_PUBLIC_BASE_URL` 未配置，后端会返回临时签名下载链接（有效期与 `expiresIn` 一致）。
  - 返回的 `url` 写入布局 `metadata.blueprint.url`，并同步记录 `fileId` 以便后续刷新。

### 3.3 查询文件元数据
- **Method**：GET `/projects/:projectId/files/:fileId`
- **响应** `200 OK`：结构同 3.2 响应。

### 3.4 删除文件
- **Method**：DELETE `/projects/:projectId/files/:fileId`
- **响应** `200 OK`：`{ "success": true }`
- **说明**：标记文件为 `deleted` 并从对象存储移除。当前布局版本仍引用的文件不建议直接删除。

## 4. 设备资源接口（Devices）

### 4.1 查询待布局设备
- **Method**：GET `/projects/:projectId/devices`
- **用途**：用于设备侧栏拉取未放置设备列表；服务端会聚合项目内所有布局的当前版本（`layouts.current_version_id`），过滤掉存在于任何布局节点 `elementsJson[*].deviceId` 或 `elementsJson[*].deviceMac` 的设备，同时跳过已被手动隐藏 (`hidden_at` 非空) 的记录。
- **响应** `200 OK`：
  ```json
  [
    {
      "id": "device-uuid",
      "mac": "00-11-32-AA-BB-CC",
      "alias": "西侧围栏摄像机1",
      "name": "1#塔吊摄像机",
      "type": "Camera",
      "model": "DS-2DE4225IW",
      "ip": "192.168.10.15",
      "status": "online"
    }
  ]
  ```

### 4.2 名称调整与隐藏
- **Method**：
  - PATCH `/projects/:projectId/devices/:deviceId` — `{ "name": "新名称" }`
  - DELETE `/projects/:projectId/devices/:deviceId`
- **说明**：
  - 仅支持对“未布局”设备操作；若设备已出现在任一布局当前版本中，返回 `409 Conflict`。
  - PATCH 用于调整列表展示名称；DELETE 不会物理删除设备，而是将 `hidden_at` 设置为当前时间并广播 `device.remove`（`{ id, mac }`）。
  - 当网关后续再次推送同 MAC 的设备时，后端会自动清除 `hidden_at` 并重新出现在未布局列表中。

### 4.3 手动注册交换机
- **Method**：POST `/projects/:projectId/devices/register-switch`
- **用途**：用于现场临时补录交换机（其它设备仍依赖网关同步）。
- **请求体**：
  ```json
  {
    "name": "施工区交换机01"
  }
  ```
- **响应** `200 OK`：
  ```json
  {
    "id": "device-uuid",
    "projectId": "uuid",
    "name": "施工区交换机01",
    "alias": null,
    "type": "Switch",
    "mac": null,
    "status": "unknown"
  }
  ```
- **行为**：
  - 新增交换机默认状态 `unknown`，`hidden_at = null`，可随后通过 PATCH/DELETE 编辑别名或隐藏。
  - 若后续网关开始同步该交换机，可根据返回的 MAC 进行合并。

## 5. 实时通道（Socket.IO）

- **连接地址**：`ws(s)://<host>:<port>`，`path = /realtime`。
- **鉴权**：推荐通过 `auth: { token }` 或 `query.token` 传递，同步校验。
- **房间管理**：后端需支持订阅 `project:<projectId>`，以便按项目推送事件。

### 5.1 服务器向客户端事件
| 事件名 | 触发场景 | Payload |
|--------|----------|---------|
| `device.update` | 设备状态/属性变更（注册、去重、心跳更新） | `{ id, mac, alias, name, type, model, ip, status }` |
| `presence.sync` | 项目成员在线状态同步 | `{ users: string[] }`（用户标识列表） |
| `projects.updated` | 项目增删改、恢复 | `{ projectId, action: "created" \| "updated" \| "archived" \| "deleted" \| "restored" }` |
| `layout.version` | 布局保存生成新版本 | `{ layoutId, versionId }` |

### 5.2 设备同步事件（后续扩展）
- 当前版本仅依赖 `device.update` 推送。
- 若平台后续直接触发实时消息，可采用 `device.synced`，Payload 与 `device.update` 保持一致。

### 5.3 客户端建议的订阅流程
1. 连接后发送 `socket.emit('project.join', { projectId })`（待后端实现），加入项目房间。
2. 在路由切换时调用 `project.leave` 退出旧项目，避免冗余推送。
3. 前端在 `device.update` 后根据 `device.id` 决定更新未布局列表或忽略（画布上已使用的设备不再加入列表）。

## 6. 变更流程要求

- 新增或调整接口前，必须在本文件中更新对应章节，并标记版本号/日期。
- 前后端需以此文档为准完成联调，未经记录的接口视为未对齐。
- 重要字段或响应格式变化需同步评估：数据库迁移、权限策略、实时推送影响。

## 7. 设备同步接口（Platform → Backend）

平台通过部署在工地现场的 NanoPi2 网关周期性采集设备信息（在线状态、IP、延迟、类型、型号等），并通过 HTTP 推送到后端。每次推送视为“当前工地设备的完整快照”，后端需用最新数据覆盖旧状态，并刷新画布 / 未布局列表。本阶段接口仅做核心字段校验，不做鉴权。详细同步流程见 [device-sync.md](./device-sync.md)。

### 7.1 推送入口
- **Method**：POST `/device-sync`
- **请求体**：
  ```json
  {
    "projectCode": 12,
    "gatewayMac": "00-11-22-33-44-55",
    "gatewayIp": "192.168.0.10",
    "scannedAt": "2025-10-18T02:05:32Z",
    "devices": [
      {
        "mac": "00-11-32-AA-BB-CC",
        "name": "塔吊摄像机",
        "type": "Camera",
        "model": "IPC123",
        "ip": "10.0.1.1",
        "statuses": ["signal-weak"],
        "latencyMs": 42,
        "packetLoss": 0.3
      },
      {
        "mac": "00-11-32-DD-EE-FF",
        "name": "基站网桥 AP",
        "type": "Bridge",
        "model": "Bridge-Pro",
        "ip": "10.0.2.1",
        "bridgeRole": "AP"
      }
    ]
  }
  ```
  - `projectCode`：项目通信 ID（0-255），来自项目管理界面的“通信 ID”。
- `gatewayMac`：现场 NanoPi2 网关 MAC，用作绑定校验；`gatewayIp` 为当前网关 IP，便于排查。
   - `scannedAt`：网关采样时间；缺省时后端使用当前时间。
- `devices`：设备列表；`mac` 为物理网卡地址（必填，作为唯一标识）。网关保证每条记录均携带有效 `mac`，不存在缺失情况。`statuses` 为附加状态标签数组（例如信号弱、抖动），不会直接影响主状态。
  - `devices`：设备列表；`mac` 为物理网卡地址（必填，作为唯一标识）。缺少 `mac` 的设备会被判定为非法并记录在 `failed` 列表；网桥可通过 `bridgeRole` 标注 AP/ST。`statuses` 为附加状态标签数组（例如信号弱、抖动），不会直接影响主状态。
- 额外指标（可选）：
  - `latencyMs`：往返延迟毫秒数（Number）。
  - `packetLoss`：丢包率百分比（0-100 的 Number 或 0-1 小数）。
  - `bridgeRole`：网桥角色（`AP`/`ST`），仅对 `type=Bridge` 生效；若缺省则沿用上一轮同步或标记为未知。
  - 其它指标（如 RSSI、电压）可放入 `metrics` 对象，由后端原样入库。
- **成功响应** `200 OK`：
  ```json
  {
    "processed": 8,
    "failed": [
      { "deviceId": "d-009", "reason": "project not found" }
    ]
  }
  ```

### 7.2 服务端处理
1. 通过 `projectCode` 查询 `ProjectEntity.code`，找不到则记日志并将该设备列入 `failed`。
2. 对每个设备：
   - 使用 `(projectId, mac)` 去重匹配；网关保证提供唯一且稳定的 `mac`，不再根据 IP 等字段补偿匹配。
   - `type`、`model` 在同一 `mac` 上视为稳定属性，如发生变化视为设备替换：更新前记录历史值并写入 `activity_log`（action=`device.model_changed`），便于审计。
   - 调用 `devicesService.registerOrUpdate` 更新字段：`name/type/model/ip/status`、`lastSeenAt`，并存储 `gatewayMac`、`gatewayIp` 及采样时间。
   - 出现在快照中的设备统一标记为 `online`，`statuses` 数组仅作为附加标签写入 `metadata.extraStatuses`。
  - 将延迟/丢包等指标记录到 `metadata.metrics`，并同步更新时间戳、网关信息：
     ```json
    {
      "extraStatuses": ["signal-weak"],
      "metrics": { "latencyMs": 42, "packetLoss": 0.3 },
      "gatewayMac": "00-11-22-33-44-55",
      "gatewayIp": "192.168.0.10",
      "scannedAt": "2025-10-18T02:05:32Z"
    }
     ```
   - 对于网桥设备（`type=Bridge`），通过 `bridgeRole`/`mode`/名称等字段判定 AP/ST，并写入 `metadata.bridgeRole`，后续未布局面板与画布均按此展示角色徽章。
3. 每台设备成功后调用 `realtimeService.emitDeviceUpdate`，前端未布局列表即时刷新；同步标记本次快照中出现过的设备 ID。
4. 快照处理结束后，对未出现在本次快照且 `lastSeenAt` 距当前时间超过 3 分钟的设备，将其状态置为 `offline` 并同样广播（阈值可配置）。
4. 可选：写入 `activity_log`，action=`device.sync`，便于审计。

### 7.3 错误处理
- 项目不存在：记录 `warn` 并回传 `failed` 列表。
- 单条设备写库失败：捕获异常后继续处理剩余设备，最终一次性返回处理结果。
- 网关 MAC 非法：直接返回 `400 Bad Request`，前端需提示重新确认网关配置。

### 7.4 后续增强（计划）
- 接入平台签名校验、频率控制。
- 引入失败队列（BullMQ）与重试。
- 暴露同步日志查询接口（如 `/device-sync/logs`）。

---

最近更新时间：2025-10-18
