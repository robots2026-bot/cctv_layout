# 未布局设备手动添加

1. 布局工作台右侧“未布局设备资源”面板新增“手动添加”入口，打开抽屉依次选择设备类型（Camera / NVR / Bridge）、填写设备型号与 IP；名称字段可选。
2. 列表项展示设备名称、类型徽章、型号及 IP，便于识别新增资源。
3. 设备拖入画布后，右上角浮动属性面板同步展示类型徽章、运行状态、型号与 IP。
4. 保存动作调用 `POST /projects/:projectId/devices/register` 接口写入设备，并立即刷新未布局设备列表；新增设备默认状态为 `unknown`，后续由实时同步更新状态。

## 接口说明

- `POST /projects/:projectId/devices/register`：请求体包含 `type`、`ipAddress`、`model`，`name` 可空时由前端自动生成占位值，成功返回设备实体，前端转存为 `DeviceSummary`。

## 自测

1. `docker compose up -d postgres redis backend frontend` 后打开布局工作台。
2. 在“未布局设备资源”中点击“手动添加”，选择类型、填写型号和 IP（名称可留空）。
3. 确认新增设备出现在列表中，卡片显示类型徽章、型号与 IP；拖拽进画布后右上角属性面板展示同样信息。
4. 再次打开抽屉，录入重复 IP 时接口返回更新，列表与浮层同步刷新型号。
