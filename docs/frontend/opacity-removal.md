# 前端背景/设备透明度移除说明（2025-10）

## 变更内容
1. 移除布局背景透明度调节逻辑：不再从 `layoutStore` 暴露 `updateBackgroundOpacity`，`CanvasStage` 始终以不透明方式绘制背景图。
2. 删除浮动/侧栏属性面板中的背景透明度滑杆，仅保留设备字段编辑。
3. 调整 `DeviceNode` 配色，采用实色填充与描边，避免设备卡片呈现半透明效果。

## 验证项
- `docker compose run --rm frontend npm run build`
- 手动打开布局工作台：确认背景图为全不透明展示；拖动设备时卡片填充保持实色；属性面板不再出现透明度调节。
