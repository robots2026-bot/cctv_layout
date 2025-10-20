# 设备同步方案（初版）

## 1. 场景概述
- 工地部署 NanoPi2 网关，周期采集现场摄像机、交换机、网桥、NVR 等在线状态、IP、延迟、型号。
- 每次推送视为该项目当前设备的完整快照：出现的设备标记为最新状态；缺失的设备视为离线。
- 网关只掌握项目通信 ID（`projectCode`），后端负责映射到项目 UUID 并落库。

## 2. 核心数据关系
- **项目 (projects)**：保留现有结构，通信 ID (`code`) 唯一。
- **设备 (devices)**：
  - 增加 `mac_address`（唯一）、`metadata.metrics`（延迟、丢包等）、`metadata.extraStatuses`。
  - `metadata.bridgeRole` 保存网桥 AP/ST 角色，供未布局列表及画布渲染徽章。
  - 仍以 `project_id` 关联项目，网关切换时设备不丢失。
- **网关绑定 (gateway_bindings)**（新表）：
  - 字段示例：`gateway_id`、`project_id`、`project_code`、`status`、`bound_at`、`changed_at`、`updated_by`。
  - 一台网关在任意时刻最多绑定一个项目；绑定失败或未绑定时拒绝推送。

## 3. 接口设计
- `POST /device-sync`
  - 请求体：
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
          "statuses": ["online", "signal-weak"],
          "latencyMs": 42,
          "packetLoss": 0.3,
          "bridgeRole": "AP"
        }
      ]
    }
    ```
  - 返回：`{ "processed": n, "failed": [...] }`

## 4. 处理流程（初版）
1. 校验 `gatewayMac` 与绑定表：
   - 未绑定或绑定到其他项目 → 拒绝请求并记录告警。
2. 根据 `projectCode` 查询项目 UUID。
3. 遍历设备列表：
   - 以 `(project_id, mac)` 去重匹配；网关保证 `mac` 必填。
   - `type`/`model` 变化视为设备替换：覆盖数据前记录旧值到 `metadata.previousModel`，写 `activity_log`（`device.model_changed`）。
   - 更新字段：`name/type/model/ip/status`、`lastSeenAt`、`metadata.metrics`、`metadata.extraStatuses`、`gatewayMac`、`gatewayIp`、`scannedAt`；对于网桥设备，根据 `bridgeRole`/`mode`/名称等提示写入 `metadata.bridgeRole`，区分 AP 和 ST。
   - 调用 `realtimeService.emitDeviceUpdate` 推送前端。
4. 快照结束后，将本次未出现的设备状态标记为 `offline` 并推送。
5. 记录操作日志（`activity_log` action=`device.sync`）。

## 5. 离线与重新绑定提醒
- 维护网关 `last_seen_at`。超过阈值（如 30 分钟）未推送 → 进入 “离线” 状态，生成告警。
- 离线后重新推送时若绑定不一致 → 拒绝请求 + 告警，提示需要重新绑定。

## 6. 前端配合要点
- 继续监听 `device.update`，根据 `status` + `metadata.extraStatuses` 渲染未布局列表和画布节点；当 `metadata.bridgeRole` 存在时，未布局面板与节点图标展示 AP/ST 徽章。
- 布局/项目界面可展示“网关离线/绑定异常”提示（后端提供状态接口）。

## 7. 初期简化实现
- 绑定表可手动维护（后台录入即可），暂不实现绑定 API。
- `metadata.metrics` 仅存延迟、丢包（无需复杂结构）。
- 离线阈值、告警可先只写日志，后续再接入通知通道。
- 安全（签名/限频）留到下一阶段加入。
