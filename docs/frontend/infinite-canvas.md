# 前端无限画布改造（2025-05）

## 变更概览
1. 去除 `CanvasStage` 内的网格背景层，统一采用容器底色展示空白区域，避免背景线干扰布局。 
2. 将 Konva `Stage` 引用类型化为 `KonvaStage`，消除 `any` 使用带来的 Lint 报错。 
3. 重构 `ConnectionLine` 计算逻辑，改用纯函数生成连线轨迹与箭头位置，确保 Hooks 满足“无条件调用”约束并补全事件类型。

## 验证步骤
- `docker compose run --rm frontend npm run lint`
- 手动：在画布空白区域拖拽平移，确认可向任意方向无限延展；拖入节点后检查背景无网格线，仅保留设备与连线。
