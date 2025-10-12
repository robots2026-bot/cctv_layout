# 前端蓝图导入与独立缩放方案（2025-05）

## 目标与范围
1. 允许用户在布局画布中导入一张工地蓝图图片，作为设备摆放的参照层。
2. 蓝图应支持独立的缩放与位置调节，不与全局视口缩放（`viewport.scale`）互相干扰。
3. 提供基础的 UI 控件完成图片选择、缩放比例与透明度调节，并支持移除或替换蓝图。
4. 保持现有设备、连线、背景色渲染逻辑不变，蓝图仅作为附加视觉层。

## 模式选择与交互流程

### 为何需要专门的蓝图管理模式

| 方案 | 优点 | 风险/缺点 |
| --- | --- | --- |
| 在现有布局模式中直接导入与调整 | 实现路径最短，可沿用既有控制面板 | 调整蓝图时可能误触设备拖拽/连线；多人协作下难以提示其他成员处于蓝图调整阶段 |
| 新增“蓝图管理模式” | 蓝图编辑操作与设备布局解耦；可在模式入口增加确认/锁定提示，降低误操作 | 需要额外的模式切换状态与 UI，初期实现复杂度略高 |

综合考虑蓝图尺寸、旋转、透明度等操作往往会频繁拖拽、缩放，如果与设备布局共享同一模式，误拖设备或连线的概率较高。因此我们选择**引入蓝图管理模式**：蓝图的导入、替换、缩放、偏移都在该模式下进行；退出模式后默认锁定蓝图层，不再响应点击/拖拽事件，避免对既有布局造成干扰。

### 交互流程
1. 用户在布局工具栏点击“蓝图”入口，打开蓝图管理模式的抽屉（或全屏蒙层）。
2. 若尚未导入蓝图，抽屉展示上传控件；用户选择图片（限制格式：PNG/JPEG/WebP；大小 < 10 MB）。
3. 前端读取文件并上传至后端文件服务，拿到签名 URL 后写入 `canvasStore.blueprint` 状态，同时 `uiStore.blueprintMode` 维持为 `"editing"`，画布进入蓝图编辑态：
   - `Stage` 上除蓝图以外的层全部 `listening=false`，并显示“蓝图调整中，请完成后退出”提示；
   - 若多人协作，通过 WebSocket 广播蓝图模式状态，其他成员看到不可编辑提示。
4. 用户通过模式内的 `BlueprintControls` 调节缩放（0.1~5.0）、透明度（0~1）、位置偏移（X/Y）。这些控制仅更新蓝图参数，不改变 `viewport.scale`。
5. 用户点击“应用并退出”，`uiStore.blueprintMode` 置为 `"locked"`：蓝图层 `listening=false`、`draggable=false`，设备布局恢复交互。
6. 布局保存时，携带 `blueprint` 参数写入布局 JSON，保证刷新后状态恢复；再次进入蓝图管理模式可继续编辑。
7. 模式面板内提供“替换图片”“清除蓝图”操作，并要求二次确认以防误删。

## 状态设计
- `canvasStore` 新增 `blueprint` 切片：
  ```ts
  interface CanvasBlueprint {
    url: string;
    naturalWidth: number;
    naturalHeight: number;
    scale: number; // 默认 1.0
    opacity: number; // 默认 0.6
    offset: { x: number; y: number }; // 默认 { x: 0, y: 0 }
  }
  ```
- 新增动作：
  - `setBlueprint(blueprint: CanvasBlueprint | null)`：导入/移除蓝图。
  - `updateBlueprint(patch: Partial<CanvasBlueprint>)`：缩放/透明度/偏移增量更新。
- `setCanvasData`、`resetCanvas` 同步蓝图字段。
- 布局保存 API Payload 需包含 `blueprint` 字段（后端 Layout 模块按 JSON 原样存储）。
- `uiStore` 新增 `blueprintMode: 'idle' | 'editing' | 'locked'`：
  - `enterBlueprintMode()`：开启编辑态，广播给协作者并关闭设备交互。
  - `confirmBlueprintMode()`：应用更改并锁定蓝图层。
  - `exitBlueprintMode()`：无蓝图时退回 `idle`，已有蓝图时默认 `locked`。

## 组件与渲染
1. `BlueprintLayer`（新组件）
   - 使用 `useImage` 加载 `canvasStore.blueprint.url`。
   - 通过 `KonvaImage` 的 `scaleX/scaleY`、`x/y`、`opacity` 属性应用蓝图参数。
   - 根据 `uiStore.blueprintMode`：`editing` 时允许拖拽或使用控制点；`locked`/`idle` 时 `listening=false`，防止阻挡设备操作。
   - 当图片尚未加载完成时展示“蓝图加载中”骨架（可选）。
2. `BlueprintControls`（新组件）
   - 在蓝图管理模式抽屉内展示，核心交互包含：
     - 缩放滑杆（0.1~5.0，步长 0.1）。
     - 透明度滑杆（0~1，步长 0.05）。
     - X/Y 位移微调输入（可通过按钮 +/− 或数值框）。
     - 隐藏/显示切换、替换图片、移除蓝图按钮，均要求二次确认。
   - 模式顶部展示“蓝图模式生效，设备暂不可编辑”警示条。
   - 使用 Zustand actions 更新 `canvasStore.blueprint` 与 `uiStore.blueprintMode`。
3. `CanvasStage`
   - 将蓝图层渲染在设备/连线之前，但在背景色之后。
   - `Stage` 的 `scaleX/scaleY` 仍由 `viewport` 控制，用户缩放视口时，蓝图整体随同放大/缩小；单独调节蓝图时，通过 `blueprint.scale` 控制图片自身尺寸，从而实现叠加效果。
   - 当 `uiStore.blueprintMode === 'editing'` 时，通过 Stage 守卫阻止设备节点、连线的 `dragstart/dragmove/dragend` 事件，并在画布中央显示半透明遮罩提示。

## 后端影响
- `LayoutsModule` 的 DTO 与实体需新增 `blueprint` 字段（可选），沿用 JSONB 存储。
- 文件服务沿用背景图上传能力，仅需新增文件夹前缀（如 `blueprints/`）以便分类管理。
- 需校验文件大小/类型，并返回可直接在前端 `Konva` 使用的公开 URL。

## 验证计划
- `docker compose run --rm frontend npm run lint`
- 手动检查：
  1. 导入蓝图后缩放视口与蓝图，确认设备位置未错位、背景缩放不受影响。
  2. 保存布局并刷新，蓝图状态能正确恢复。
  3. 移除蓝图后设备拖拽、连线功能不受影响。

## 开放问题
1. 是否需要对蓝图提供锁定开关，防止误拖动偏移？
2. 后续是否支持多张蓝图图层或分区对齐点？
3. 图片上传是否需要压缩/生成缩略图以降低加载成本？


## 实现记录（2025-05）
1. 前端新增 `BlueprintManager`/`BlueprintDrawer`/`BlueprintLayer` 组件：
   - `BlueprintManager` 挂载在布局工作台右上角，负责进入蓝图模式并展示当前锁定状态。
   - `BlueprintDrawer` 作为模式抽屉承载上传、缩放、透明度与偏移调节，上传逻辑使用 `URL.createObjectURL` 读取本地图片尺寸。
   - `BlueprintLayer` 插入到 Konva 渲染树中，`editing` 模式下允许拖拽图片并实时写回偏移。
2. `canvasStore` 扩展 `blueprint` 切片与 `setBlueprint`/`updateBlueprint` 行为，`uiStore` 新增 `blueprintMode` 及对应模式切换动作，进入模式时会清理选中状态与连线流程。
3. 画布交互在 `editing` 态下全面禁用设备节点、连线的事件监听，`CanvasLinkingControls` 与上下文菜单均被锁定，保证蓝图调节不会误触原有布局。
4. 布局页 `LayoutWorkbench` 注入蓝图管理浮层，蓝图状态与布局模式一起保存，退出后自动恢复锁定。
