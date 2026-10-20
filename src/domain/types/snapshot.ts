// UI руу илгээх snapshot (CLAUDE.md §10). Phase 2-т mock adapter-аар, Phase 4-өөс runtime-аас.
import type { Alert } from './alerts';
import type { ControlDecision, ControlState } from './control';
import type { VentilationDevice } from './devices';
import type { SystemEvent } from './events';
import type { DeviceId, FloorId, ScenarioId, SensorId, SimTimeMs } from './ids';
import type { MetricType } from './metrics';
import type { SensorReading } from './readings';

export type SimulationSpeed = 1 | 2 | 5 | 10;

export interface LiveSnapshot {
  schemaVersion: 1; // гэрээний хувилбар; ирээдүйн RemoteRuntime шалгана
  simTime: SimTimeMs;
  simulation: {
    running: boolean;
    speed: SimulationSpeed;
    seed: number;
    activeScenario: { id: ScenarioId; startedAt: SimTimeMs; progress: number } | null;
  };
  readings: Record<SensorId, SensorReading>;
  devices: Record<DeviceId, VentilationDevice>;
  decisions: Record<DeviceId, ControlDecision>;
  control: ControlState;
  // Гадна нөхцөлийг энд ДАВХАРДУУЛАХГҮЙ: OUT-* утгаас selector-оор гаргана
  // (selectOutdoorConditions), runtime ControlContext.outdoor-ыг ч яг энэ туслахаар үүсгэнэ.
  alerts: { active: Alert[]; recentResolved: Alert[] }; // хязгаартай
  events: SystemEvent[]; // хязгаартай ring buffer, шинэ нь сүүлд
  history: TrendHistory; // хязгаартай
}

export interface TrendPoint {
  t: SimTimeMs;
  value: number | null;
}

export type TrendHistory = Record<FloorId, Record<MetricType, TrendPoint[]>>;
