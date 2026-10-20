// Үйл явдал — түүх, зөвхөн нэмэгдэнэ (CLAUDE.md §10).
import type { RuleId } from './control';
import type { DeviceState } from './devices';
import type { AlertId, DeviceId, EventId, FloorId, SensorId, SimTimeMs } from './ids';
import type { Severity } from './metrics';

export type SystemEventType =
  | 'SIMULATION_STARTED'
  | 'SIMULATION_PAUSED'
  | 'SIMULATION_RESET'
  | 'SPEED_CHANGED'
  | 'SCENARIO_STARTED'
  | 'SCENARIO_STEP'
  | 'SCENARIO_COMPLETED'
  | 'SCENARIO_STOPPED'
  | 'SENSOR_DISCONNECTED'
  | 'SENSOR_RECONNECTED'
  | 'SENSOR_INVALID_READING'
  | 'ALERT_RAISED'
  | 'ALERT_ESCALATED'
  | 'ALERT_DEESCALATED'
  | 'ALERT_RESOLVED'
  | 'ALERT_ACKNOWLEDGED'
  | 'DEVICE_STATE_CHANGED'
  | 'MANUAL_OVERRIDE_SET'
  | 'MANUAL_OVERRIDE_CLEARED'
  | 'MANUAL_OVERRIDE_EXPIRED'
  | 'AUTO_MODE_ENABLED'
  | 'AUTO_MODE_DISABLED'
  | 'CONTROL_CONSTRAINT_ACTIVE'
  | 'CONTROL_CONSTRAINT_CLEARED'
  | 'CONTROL_FALLBACK_ACTIVE'
  | 'CONTROL_FALLBACK_CLEARED'
  | 'EMERGENCY_STARTED'
  | 'EMERGENCY_ENDED';

export interface SystemEvent {
  id: EventId;
  seq: number; // үргэлж өснө; тогтвортой дараалал
  timestamp: SimTimeMs;
  type: SystemEventType;
  category: 'simulation' | 'scenario' | 'sensor' | 'alert' | 'control' | 'operator';
  severity: Severity;
  message: string; // нэг мөр, хүн унших (Монгол)
  floorId?: FloorId;
  deviceId?: DeviceId;
  sensorId?: SensorId;
  alertId?: AlertId;
  ruleId?: RuleId;
  trigger?: string; // жишээ нь 'CO₂ 1,240 ppm ≥ 1,000 (анхааруулга)'
  previousState?: DeviceState;
  newState?: DeviceState;
  reason?: string; // бүтэн тайлбар
  actor: 'system' | 'operator' | 'scenario';
}
