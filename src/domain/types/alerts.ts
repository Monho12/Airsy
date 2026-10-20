// Дохио — шууд төлөв (CLAUDE.md §4.4, §10).
import type { AlertId, AreaId, FloorId, SensorId, SimTimeMs } from './ids';
import type { MetricType, Severity, ThresholdConditionId } from './metrics';

export type AlertType =
  | 'threshold'
  | 'sensor_offline'
  | 'sensor_invalid'
  | 'outdoor_air_restricted'
  | 'control_degraded'
  | 'emergency';

export interface Alert {
  id: AlertId;
  key: string; // давхардлыг арилгах түлхүүр, жишээ нь 'threshold:temperature-high:F12' (§5.2)
  type: AlertType;
  severity: Exclude<Severity, 'info'>; // 'warning' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved'; // амьдралын мөчлөг §4.4
  scope: {
    floorId?: FloorId;
    areaId?: AreaId;
    sensorId?: SensorId;
    metric?: MetricType;
    condition?: ThresholdConditionId;
  };
  title: string; // 'CO₂ өндөр — 2-р давхар'
  message: string; // утга ба босгыг агуулна
  raisedAt: SimTimeMs;
  updatedAt: SimTimeMs;
  acknowledgedAt: SimTimeMs | null;
  resolvedAt: SimTimeMs | null;
  peakValue: number | null;
}
