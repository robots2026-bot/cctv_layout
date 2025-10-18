# 文档索引

按照主题将所有文档分类，便于快速定位。修改或新增文档时，请同步更新此索引。

## 设计（Design）
- [design/design-plan.md](design/design-plan.md)：系统架构与整体设计。
- *待补充*：业务域模型、路线图等。

## 后端（Backend）
- [backend/api-reference.md](backend/api-reference.md)：后端对外 API 定义及请求/响应规范。
- [backend/device-sync.md](backend/device-sync.md)：NanoPi2 网关采集与设备同步方案。
- [backend/websocket.md](backend/websocket.md)：实时通道事件与订阅规则。
- [backend/data-model.md](backend/data-model.md)：数据库/实体示例与字段说明。
- [backend/object-storage.md](backend/object-storage.md)：对象存储接入与文件服务方案。
- [backend/ops/deployment.md](backend/ops/deployment.md)：本地与服务器部署流程、Docker 工作流。

## 前端（Frontend）
- [frontend/feature-guides.md](frontend/feature-guides.md) *(可选，待补充)*。
- 交互/功能文档：
  - [frontend/blueprint-import.md](frontend/blueprint-import.md)
  - [frontend/canvas-drag-drop.md](frontend/canvas-drag-drop.md)
  - [frontend/canvas-resize-sync.md](frontend/canvas-resize-sync.md)
  - [frontend/connection-design.md](frontend/connection-design.md)
  - [frontend/device-visuals.md](frontend/device-visuals.md)
  - [frontend/focus-all-elements.md](frontend/focus-all-elements.md)
  - [frontend/infinite-canvas.md](frontend/infinite-canvas.md)
  - [frontend/manual-device-entry.md](frontend/manual-device-entry.md)
  - [frontend/mode-switch-refresh.md](frontend/mode-switch-refresh.md)
  - [frontend/opacity-removal.md](frontend/opacity-removal.md)
  - [frontend/project-management-add-delete.md](frontend/project-management-add-delete.md)
  - [frontend/project-sidebar.md](frontend/project-sidebar.md)
  - [frontend/sidebar-collapse.md](frontend/sidebar-collapse.md)
  - [frontend/workbench-refresh.md](frontend/workbench-refresh.md)

## 运维 / 工作流（Ops）
- *待补充*：常用运维手册、故障处理、CI/CD 说明等。

---

> 提示：  
> - 接口层信息 → `backend/api-reference.md`  
> - 业务/流程方案 → 对应主题文档（如 `backend/device-sync.md`）  
> - 若存在交叉依赖，请在文档中加入“参见 ...”说明，保持更新一致。  
