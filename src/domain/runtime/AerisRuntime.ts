// UI ба өгөгдлийн эх сурвалжийн хоорондох гэрээ (CLAUDE.md §9.4, D2, D16, D53). Эзэмшигч: Ахлах архитектор (§14.3).
// Прототипт `LocalSimulationRuntime`, ирээдүйд `RemoteRuntime` [ИРЭЭДҮЙ] — UI зөвхөн энэ interface-тэй харьцана.
import type {
  AlertId,
  DeviceId,
  DeviceState,
  LiveSnapshot,
  ScenarioId,
  SensorId,
  SimulationSpeed,
} from '@/domain/types';

export interface AerisRuntime {
  /** Timer-ийг үүсгэнэ; давтан дуудвал юу ч хийхгүй (§9.4.1) */
  start(): void;
  /** Timer-ийг устгана; эцсийн — дараа нь `start()` дахин эхлүүлэхгүй, `dispatch` татгалзана (§9.4.1) */
  stop(): void;
  /** Сүүлийн өөрчлөгдөшгүй snapshot */
  getSnapshot(): LiveSnapshot;
  /** Захиалгыг цуцлах функц буцаана */
  subscribe(listener: (snapshot: LiveSnapshot) => void): () => void;
  /** Async: ирээдүйн RemoteRuntime сүлжээгээр хариулна (D16). Шинэ төлөв `subscribe`-аар ирнэ. */
  dispatch(command: AerisCommand): Promise<CommandResult>;
}

export type AerisCommand =
  | { type: 'simulation/play' }
  | { type: 'simulation/pause' }
  | { type: 'simulation/setSpeed'; speed: SimulationSpeed }
  | { type: 'simulation/reset' }
  | { type: 'scenario/start'; scenarioId: ScenarioId }
  | { type: 'scenario/stop' }
  | { type: 'emergency/end' }
  | { type: 'control/setAutoMode'; enabled: boolean }
  | { type: 'device/setManual'; deviceId: DeviceId; state: DeviceState }
  | { type: 'device/returnToAuto'; deviceId: DeviceId }
  | { type: 'alert/acknowledge'; alertId: AlertId }
  | { type: 'sensor/disconnect'; sensorId: SensorId } // симуляцийн эвдрэл: тэр даруй offline
  | { type: 'sensor/injectInvalid'; sensorId: SensorId; value: number }
  | { type: 'sensor/reconnect'; sensorId: SensorId | 'all' };

export type CommandResult = { ok: true } | { ok: false; reason: string };
