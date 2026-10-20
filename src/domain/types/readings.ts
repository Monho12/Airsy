// Мэдрэгчийн шууд утга (CLAUDE.md §5.3, §10).
import type { SensorId, SimTimeMs } from './ids';
import type {
  ConnectionStatus,
  HealthStatus,
  MetricType,
  MetricUnit,
  ThresholdConditionId,
  ThresholdLevels,
} from './metrics';

export interface SensorReading {
  sensorId: SensorId;
  metric: MetricType;
  value: number | null; // холболтгүй үед null — орлуулагч болгож ХЭЗЭЭ Ч 0 биш
  unit: MetricUnit;
  timestamp: SimTimeMs; // энэ утгын хугацаа (холболтгүй бол сүүлийн зөв утгынх)
  lastValidValue: number | null; // бүдэг «сүүлийн мэдэгдэж буй» утгыг харуулахад
  lastValidAt: SimTimeMs | null;
  connection: ConnectionStatus;
  status: HealthStatus;
  levels: ThresholdLevels | null; // ReadingClassification-оос (§5.6)
  condition: ThresholdConditionId | null;
  explanation: string | null; // status ≠ 'normal' үед (Монгол бичвэр)
  source: 'simulated'; // [ИРЭЭДҮЙ] | 'device'
}
