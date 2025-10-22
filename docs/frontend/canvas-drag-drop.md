# 前端画布拖放与平移修复（2025-10）

## 修复内容
1. `CanvasStage` 通过 `stage.setPointersPositions` + `getRelativePointerPosition` 统一计算外部拖入设备的坐标，解决“首次落点偏移”问题。
2. 限制 `Stage` 仅在自身拖拽时更新 `viewport.position`，避免节点移动时误触发画布平移，并同步处理光标状态。

### 2025-10-21 拖拽性能优化
1. 设备节点拖动改用 `requestAnimationFrame` 批量提交坐标，仅在 `dragend` 时落盘，显著降低 Zustand 状态写入次数。
2. 为节点与连线组件引入 `React.memo` 与 `zustand/shallow` 选择器，保证大规模布局时只有变更实体参与重渲染。

## 验证步骤
- `docker compose run --rm frontend npm run build`
- 手动：从“未布局设备”拖入画布多次，确认落点与光标一致；在画布内拖动节点与拖动空白区域分别保持正常行为。
