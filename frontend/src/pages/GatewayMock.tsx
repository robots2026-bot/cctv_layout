import { useMemo, useReducer, useState } from 'react';
import { isAxiosError } from 'axios';
import { DeviceSyncRequest, DeviceSyncType, postDeviceSync } from '../services/deviceSync';

interface DeviceFormRow {
  id: string;
  name: string;
  type: DeviceSyncType;
  bridgeRole: 'AP' | 'ST' | '';
  mac: string;
  model: string;
  ip: string;
  extraStatuses: string;
  latencyMs: string;
  packetLoss: string;
  metricsJson: string;
}

type DeviceField = Exclude<keyof DeviceFormRow, 'id'>;

interface FormState {
  projectCode: string;
  gatewayMac: string;
  gatewayIp: string;
  scannedAt: string;
  devices: DeviceFormRow[];
}

type FormAction =
  | { type: 'setBase'; field: Exclude<keyof FormState, 'devices'>; value: string }
  | { type: 'addDevice'; payload?: Partial<DeviceFormRow> }
  | { type: 'updateDevice'; id: string; field: DeviceField; value: string }
  | { type: 'removeDevice'; id: string }
  | { type: 'replace'; state: FormState };

const deviceTypeOptions: Array<{ label: string; value: DeviceSyncType }> = [
  { label: '摄像机', value: 'Camera' },
  { label: 'NVR', value: 'NVR' },
  { label: '网桥', value: 'Bridge' },
  { label: '交换机', value: 'Switch' }
];

const bridgeRoleOptions: Array<{ label: string; value: 'AP' | 'ST' }> = [
  { label: 'AP（主站）', value: 'AP' },
  { label: 'ST（从站）', value: 'ST' }
];

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;

const randomFrom = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

const randomHexByte = () => Math.floor(Math.random() * 256)
  .toString(16)
  .padStart(2, '0')
  .toUpperCase();

const randomMac = () => Array.from({ length: 6 }, randomHexByte).join('-');

const randomIp = () =>
  `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;

const deviceNameTemplates: Record<DeviceSyncType, readonly string[]> = {
  Camera: ['塔吊摄像机', '外墙摄像机', '基坑摄像机', '仓库摄像机'],
  NVR: ['楼层 NVR', '塔吊 NVR', '地面 NVR'],
  Bridge: ['施工网桥', '基站网桥', '塔吊网桥'],
  Switch: ['配电交换机', '施工交换机', '临时交换机']
} as const;

const deviceModelTemplates: Record<DeviceSyncType, readonly string[]> = {
  Camera: ['IPC2K', 'IPC4K', 'IPC123', 'IPC-Pro'],
  NVR: ['NVR-16', 'NVR-32', 'NVR-Pro'],
  Bridge: ['Bridge-200', 'Bridge-350', 'Bridge-Pro'],
  Switch: ['SW-8P', 'SW-16P', 'SW-24P']
} as const;

const extraStatusPool = ['signal-weak', 'high-load', 'rebooting', 'packet-loss', 'focus-adjust'];

const randomDeviceData = (type: DeviceSyncType) => {
  const suffix = Math.floor(Math.random() * 90) + 10;
  const name = `${randomFrom(deviceNameTemplates[type])} ${suffix}`;
  const model = randomFrom(deviceModelTemplates[type]);
  const shouldHaveExtra = Math.random() > 0.5;
  const extraStatuses = shouldHaveExtra ? randomFrom(extraStatusPool) : '';
  const latency = Math.max(5, Math.floor(Math.random() * 120)).toString();
  const packetLoss = Math.random() > 0.6 ? (Math.random() * 1.5).toFixed(2) : '';
  const bridgeRole = type === 'Bridge' ? randomFrom(['AP', 'ST'] as const) : '';

  return {
    name,
    model,
    extraStatuses,
    latencyMs: latency,
    packetLoss,
    bridgeRole
  };
};

const createDevice = (overrides?: Partial<DeviceFormRow>): DeviceFormRow => {
  const type = overrides?.type ?? randomFrom(deviceTypeOptions).value;
  const base = randomDeviceData(type);
  const mac = overrides?.mac ?? randomMac();
  const ip = overrides?.ip ?? (type === 'Switch' ? '' : randomIp());
  let bridgeRole: DeviceFormRow['bridgeRole'] = '';
  if (type === 'Bridge') {
    if (overrides?.bridgeRole === 'AP' || overrides?.bridgeRole === 'ST') {
      bridgeRole = overrides.bridgeRole;
    } else if (base.bridgeRole === 'AP' || base.bridgeRole === 'ST') {
      bridgeRole = base.bridgeRole;
    } else {
      bridgeRole = 'AP';
    }
  }

  return {
    id: generateId(),
    name: overrides?.name ?? base.name,
    type,
    bridgeRole,
    mac,
    model: overrides?.model ?? base.model,
    ip,
    extraStatuses: overrides?.extraStatuses ?? base.extraStatuses,
    latencyMs: overrides?.latencyMs ?? base.latencyMs,
    packetLoss: overrides?.packetLoss ?? base.packetLoss,
    metricsJson: overrides?.metricsJson ?? ''
  };
};

const createInitialState = (): FormState => ({
  projectCode: '',
  gatewayMac: '',
  gatewayIp: '',
  scannedAt: new Date().toISOString(),
  devices: [createDevice()]
});

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case 'setBase':
      return { ...state, [action.field]: action.value };
    case 'addDevice':
      return { ...state, devices: [...state.devices, createDevice(action.payload)] };
    case 'updateDevice':
      return {
        ...state,
        devices: state.devices.map((device) => {
          if (device.id !== action.id) {
            return device;
          }
          const next = { ...device, [action.field]: action.value } as DeviceFormRow;
          if (action.field === 'type') {
            const nextType = action.value as DeviceSyncType;
            next.type = nextType;
            if (nextType === 'Bridge') {
              if (next.bridgeRole !== 'AP' && next.bridgeRole !== 'ST') {
                next.bridgeRole = 'AP';
              }
            } else {
              next.bridgeRole = '';
            }
          }
          if (action.field === 'bridgeRole') {
            const rawValue = action.value;
            next.bridgeRole = rawValue === 'AP' || rawValue === 'ST' ? (rawValue as DeviceFormRow['bridgeRole']) : '';
          }
          return next;
        })
      };
    case 'removeDevice':
      return {
        ...state,
        devices: state.devices.length > 1 ? state.devices.filter((device) => device.id !== action.id) : state.devices
      };
    case 'replace':
      return action.state;
    default:
      return state;
  }
};

interface ValidationResult {
  payload: DeviceSyncRequest | null;
  draftPayload: Record<string, unknown>;
  errors: string[];
}

const createSampleState = (): FormState => ({
  projectCode: '12',
  gatewayMac: '00-11-22-33-44-55',
  gatewayIp: '192.168.0.10',
  scannedAt: new Date().toISOString(),
  devices: [
    createDevice({
      name: '塔吊摄像机 A',
      type: 'Camera',
      mac: '00-11-32-AA-BB-CC',
      model: 'IPC123',
      ip: '10.0.1.1',
      extraStatuses: 'signal-weak',
      latencyMs: '42',
      packetLoss: '0.3'
    }),
    createDevice({
      name: '施工电梯网桥',
      type: 'Bridge',
      mac: '00-11-32-DD-EE-FF',
      model: 'Bridge-200',
      ip: '10.0.1.2',
      extraStatuses: 'high-load',
      bridgeRole: 'ST'
    })
  ]
});

const GatewayMock = () => {
  const [state, dispatch] = useReducer(formReducer, undefined, createInitialState);
  const [isSubmitting, setSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const validation = useMemo<ValidationResult>(() => {
    const errors: string[] = [];
    const trimmedCode = state.projectCode.trim();
    const trimmedGatewayMac = state.gatewayMac.trim();
    const trimmedGatewayIp = state.gatewayIp.trim();
    const trimmedScannedAt = state.scannedAt.trim();

    const projectCodeNumber = trimmedCode === '' ? NaN : Number(trimmedCode);
    if (trimmedCode === '') {
      errors.push('通信 ID（projectCode）不能为空');
    } else if (!Number.isInteger(projectCodeNumber) || projectCodeNumber < 0 || projectCodeNumber > 255) {
      errors.push('通信 ID 必须是 0-255 的整数');
    }

    if (!trimmedGatewayMac) {
      errors.push('网关 MAC 地址不能为空');
    }

    if (trimmedGatewayIp) {
      const ipParts = trimmedGatewayIp.split('.');
      const isValidIp =
        ipParts.length === 4 &&
        ipParts.every((part) => {
          const numeric = Number(part.trim());
          return /^\d{1,3}$/.test(part.trim()) && numeric >= 0 && numeric <= 255;
        });
      if (!isValidIp) {
        errors.push('网关 IP 地址格式不正确');
      }
    }

    if (trimmedScannedAt) {
      const timestamp = Date.parse(trimmedScannedAt);
      if (Number.isNaN(timestamp)) {
        errors.push('采样时间需要是 ISO8601 格式，例如 2025-10-18T02:05:32Z');
      }
    }

    if (state.devices.length === 0) {
      errors.push('至少需要添加一台设备');
    }

    const devices = state.devices.map((device, index) => {
      const trimmedMac = device.mac.trim();
      const trimmedName = device.name.trim();
      const trimmedModel = device.model.trim();
      const trimmedIp = device.ip.trim();
      const extraStatusList = device.extraStatuses
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (!trimmedMac) {
        errors.push(`第 ${index + 1} 台设备缺少 MAC 地址`);
      }

      if (device.type !== 'Switch' && trimmedIp === '') {
        // IP 可以为空，但提醒更清晰
        errors.push(`第 ${index + 1} 台设备建议填写 IP（非交换机）`);
      }

      if (device.type === 'Bridge' && (!device.bridgeRole || device.bridgeRole.trim().length === 0)) {
        errors.push(`第 ${index + 1} 台网桥需要选择角色（AP/ST）`);
      }

      let latency: number | undefined;
      if (device.latencyMs.trim() !== '') {
        latency = Number(device.latencyMs.trim());
        if (!Number.isFinite(latency) || latency < 0) {
          errors.push(`第 ${index + 1} 台设备的延迟必须是非负数字`);
        }
      }

      let packetLoss: number | undefined;
      if (device.packetLoss.trim() !== '') {
        packetLoss = Number(device.packetLoss.trim());
        if (!Number.isFinite(packetLoss) || packetLoss < 0) {
          errors.push(`第 ${index + 1} 台设备的丢包率必须是非负数字`);
        }
      }

      let metrics: Record<string, unknown> | undefined;
      if (device.metricsJson.trim() !== '') {
        try {
          const parsed = JSON.parse(device.metricsJson);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            metrics = parsed as Record<string, unknown>;
          } else {
            errors.push(`第 ${index + 1} 台设备的自定义指标需要是对象 JSON`);
          }
        } catch (exception) {
          errors.push(`第 ${index + 1} 台设备的自定义指标 JSON 解析失败`);
        }
      }

      const result = {
        mac: trimmedMac,
        type: device.type,
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(trimmedModel ? { model: trimmedModel } : {}),
        ...(trimmedIp ? { ip: trimmedIp } : {}),
        ...(extraStatusList.length > 0 ? { statuses: extraStatusList } : {}),
        ...(latency !== undefined ? { latencyMs: latency } : {}),
        ...(packetLoss !== undefined ? { packetLoss } : {}),
        ...(metrics ? { metrics } : {}),
        ...(device.type === 'Bridge' && device.bridgeRole ? { bridgeRole: device.bridgeRole } : {})
      };

      return result;
    });

    const seenMacs = new Set<string>();
    state.devices.forEach((device, index) => {
      const macLower = device.mac.trim().toLowerCase();
      if (!macLower) {
        return;
      }
      if (seenMacs.has(macLower)) {
        errors.push(`第 ${index + 1} 台设备的 MAC 与其它设备重复`);
      } else {
        seenMacs.add(macLower);
      }
    });

    const draftPayload: Record<string, unknown> = {
      projectCode: Number.isNaN(projectCodeNumber) ? trimmedCode : projectCodeNumber,
      gatewayMac: trimmedGatewayMac,
      ...(trimmedGatewayIp ? { gatewayIp: trimmedGatewayIp } : {}),
      ...(trimmedScannedAt ? { scannedAt: trimmedScannedAt } : {}),
      devices
    };

    const payload: DeviceSyncRequest | null =
      errors.length === 0
        ? {
            projectCode: projectCodeNumber,
            gatewayMac: trimmedGatewayMac,
            ...(trimmedGatewayIp ? { gatewayIp: trimmedGatewayIp } : {}),
            ...(trimmedScannedAt ? { scannedAt: trimmedScannedAt } : {}),
            devices: devices as DeviceSyncRequest['devices']
          }
        : null;

    return { payload, draftPayload, errors };
  }, [state]);

  const handleSubmit = async () => {
    if (!validation.payload || isSubmitting) {
      return;
    }
    setSubmitting(true);
    setLastError(null);
    setLastResponse(null);
    const startedAt = performance.now();
    try {
      const response = await postDeviceSync(validation.payload);
      const duration = performance.now() - startedAt;
      setLastDuration(duration);
      setLastResponse(JSON.stringify(response, null, 2));
    } catch (error) {
      const duration = performance.now() - startedAt;
      setLastDuration(duration);
      if (isAxiosError(error)) {
        const responseData = error.response?.data;
        if (responseData) {
          setLastError(JSON.stringify(responseData, null, 2));
        } else {
          setLastError(error.message);
        }
      } else if (error instanceof Error) {
        setLastError(error.message);
      } else {
        setLastError('未知错误');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadSample = () => {
    dispatch({ type: 'replace', state: createSampleState() });
  };

  const handleReset = () => {
    dispatch({ type: 'replace', state: createInitialState() });
    setLastResponse(null);
    setLastError(null);
    setLastDuration(null);
  };

  const deviceCount = state.devices.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-white">模拟网关设备推送</h1>
          <p className="text-sm text-slate-400">
            构造 `POST /device-sync` 请求以调试网关推送流程，支持在线编辑设备列表、实时 JSON 预览与结果反馈。
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={handleLoadSample}
              className="rounded border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
            >
              填充示例数据
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'setBase', field: 'scannedAt', value: new Date().toISOString() })}
              className="rounded border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-medium text-slate-200 transition hover:border-brand-400/80 hover:text-white"
            >
              使用当前时间
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-medium text-rose-200 transition hover:border-rose-400/80 hover:text-white"
            >
              清空表单
            </button>
          </div>
        </div>

        <section className="rounded border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-white">网关信息</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              通信 ID（0-255）
              <input
                value={state.projectCode}
                onChange={(event) => dispatch({ type: 'setBase', field: 'projectCode', value: event.target.value })}
                placeholder="例如 12"
                className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              网关 MAC
              <input
                value={state.gatewayMac}
                onChange={(event) => dispatch({ type: 'setBase', field: 'gatewayMac', value: event.target.value })}
                placeholder="00-11-22-33-44-55"
                className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              网关 IP（可选）
              <input
                value={state.gatewayIp}
                onChange={(event) => dispatch({ type: 'setBase', field: 'gatewayIp', value: event.target.value })}
                placeholder="192.168.0.10"
                className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
              采样时间（ISO8601，可选）
              <input
                value={state.scannedAt}
                onChange={(event) => dispatch({ type: 'setBase', field: 'scannedAt', value: event.target.value })}
                placeholder="2025-10-18T02:05:32Z"
                className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section className="rounded border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">设备列表（{deviceCount}）</h2>
            <button
              type="button"
              onClick={() => dispatch({ type: 'addDevice' })}
              className="rounded border border-brand-400/40 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-200 transition hover:border-brand-400/80 hover:text-white"
            >
              添加设备
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            设备出现在快照中即视为在线，附加状态标签会写入 `metadata.extraStatuses`；自定义指标需输入对象 JSON（例如
            {" { \"rssi\": -42 } "}）。
          </p>
          <div className="mt-4 space-y-4">
            {state.devices.map((device, index) => (
              <div key={device.id} className="rounded border border-slate-800 bg-slate-900/50 p-4 shadow-inner shadow-slate-950/20">
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>设备 #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'removeDevice', id: device.id })}
                    className="rounded border border-slate-800 bg-slate-900/70 px-2 py-1 text-rose-300 transition hover:border-rose-400/80 hover:text-white disabled:opacity-30"
                    disabled={state.devices.length === 1}
                  >
                    移除
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    设备名称
                    <input
                      value={device.name}
                      onChange={(event) =>
                        dispatch({ type: 'updateDevice', id: device.id, field: 'name', value: event.target.value })
                      }
                      placeholder="塔吊摄像机 A"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    设备类型
                    <select
                      value={device.type}
                      onChange={(event) =>
                        dispatch({
                          type: 'updateDevice',
                          id: device.id,
                          field: 'type',
                          value: event.target.value as DeviceSyncType
                        })
                      }
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-brand-400/80 focus:outline-none"
                    >
                      {deviceTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {device.type === 'Bridge' && (
                    <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                      网桥角色
                      <select
                        value={device.bridgeRole}
                        onChange={(event) =>
                          dispatch({
                            type: 'updateDevice',
                            id: device.id,
                            field: 'bridgeRole',
                            value: event.target.value
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-brand-400/80 focus:outline-none"
                      >
                        {bridgeRoleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    MAC 地址
                    <input
                      value={device.mac}
                      onChange={(event) =>
                        dispatch({ type: 'updateDevice', id: device.id, field: 'mac', value: event.target.value })
                      }
                      placeholder="00-11-32-AA-BB-CC"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    IP 地址
                    <input
                      value={device.ip}
                      onChange={(event) =>
                        dispatch({ type: 'updateDevice', id: device.id, field: 'ip', value: event.target.value })
                      }
                      placeholder="10.0.1.1"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    设备型号
                    <input
                      value={device.model}
                      onChange={(event) =>
                        dispatch({ type: 'updateDevice', id: device.id, field: 'model', value: event.target.value })
                      }
                      placeholder="IPC123"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300 md:col-span-2 xl:col-span-3">
                    附加状态标签（逗号分隔）
                    <input
                      value={device.extraStatuses}
                      onChange={(event) =>
                        dispatch({
                          type: 'updateDevice',
                          id: device.id,
                          field: 'extraStatuses',
                          value: event.target.value
                        })
                      }
                      placeholder="signal-weak, vibration-high"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    往返延迟 (ms)
                    <input
                      value={device.latencyMs}
                      onChange={(event) =>
                        dispatch({
                          type: 'updateDevice',
                          id: device.id,
                          field: 'latencyMs',
                          value: event.target.value
                        })
                      }
                      placeholder="42"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300">
                    丢包率
                    <input
                      value={device.packetLoss}
                      onChange={(event) =>
                        dispatch({
                          type: 'updateDevice',
                          id: device.id,
                          field: 'packetLoss',
                          value: event.target.value
                        })
                      }
                      placeholder="0.3"
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-medium text-slate-300 md:col-span-2 xl:col-span-3">
                    自定义指标 JSON（可选）
                    <textarea
                      value={device.metricsJson}
                      onChange={(event) =>
                        dispatch({
                          type: 'updateDevice',
                          id: device.id,
                          field: 'metricsJson',
                          value: event.target.value
                        })
                      }
                      rows={3}
                      placeholder='例如 { "rssi": -42, "voltage": 11.8 }'
                      className="w-full rounded border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-400/80 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">请求预览</h2>
              <span className="text-xs text-slate-500">自动根据当前表单生成</span>
            </div>
            <pre className="mt-3 max-h-96 overflow-auto rounded border border-slate-800 bg-slate-950/80 p-4 text-xs text-emerald-200">
              {JSON.stringify(validation.draftPayload, null, 2)}
            </pre>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-lg font-semibold text-white">校验提示</h2>
              {validation.errors.length === 0 ? (
                <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                  所有必填项已准备就绪，可直接发送请求。
                </div>
              ) : (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-amber-200">
                  {validation.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">发送结果</h2>
                {lastDuration !== null && (
                  <span className="text-xs text-slate-500">耗时 {(lastDuration / 1000).toFixed(2)}s</span>
                )}
              </div>
              <button
                type="button"
                disabled={validation.errors.length > 0 || isSubmitting}
                onClick={handleSubmit}
                className="mt-3 w-full rounded border border-brand-400/60 bg-brand-500/20 px-4 py-2 text-sm font-medium text-brand-100 transition hover:border-brand-400/80 hover:text-white disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/40 disabled:text-slate-500"
              >
                {isSubmitting ? '发送中…' : '发送到后端'}
              </button>
              {lastResponse && (
                <pre className="mt-3 max-h-60 overflow-auto rounded border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                  {lastResponse}
                </pre>
              )}
              {lastError && (
                <pre className="mt-3 max-h-60 overflow-auto rounded border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-100">
                  {lastError}
                </pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GatewayMock;
