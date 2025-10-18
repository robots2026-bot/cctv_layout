# 前端画布拖放与平移修复（2025-10）

## 修复内容
1. `CanvasStage` 通过 `stage.setPointersPositions` + `getRelativePointerPosition` 统一计算外部拖入设备的坐标，解决“首次落点偏移”问题。
2. 限制 `Stage` 仅在自身拖拽时更新 `viewport.position`，避免节点移动时误触发画布平移，并同步处理光标状态。

## 验证步骤
- `docker compose run --rm frontend npm run build`
- 手动：从“未布局设备”拖入画布多次，确认落点与光标一致；在画布内拖动节点与拖动空白区域分别保持正常行为。
