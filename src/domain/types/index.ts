// Нийтлэг төрлийн цорын ганц эх сурвалж (CLAUDE.md §10, §9.3-ын 7-р дүрэм).
// `AerisRuntime`/командын төрөл (§9.4) нь Phase 4-т `domain/runtime/AerisRuntime.ts`-д (D53).
export type {
  AlertId,
  AreaId,
  BuildingId,
  DeviceId,
  EventId,
  FloorId,
  ScenarioId,
  SensorId,
  SimTimeMs,
} from './ids';
export type {
  ConnectionStatus,
  HealthStatus,
  MetricType,
  MetricUnit,
  ReadingClassification,
  Severity,
  ThresholdConditionId,
  ThresholdLevel,
  ThresholdLevels,
} from './metrics';
export type {
  Area,
  Building,
  Floor,
  FloorVentilationLayout,
  Rect2D,
  Sensor,
  Vec3,
} from './building';
export type { SensorReading } from './readings';
export type {
  ControlMode,
  DamperPosition,
  DeviceKind,
  DeviceState,
  FanLevel,
  ManualOverride,
  VentilationDevice,
} from './devices';
export type {
  ConstraintId,
  ControlContext,
  ControlDecision,
  ControlRequest,
  ControlRule,
  ControlState,
  EmergencyState,
  FloorMetricAggregate,
  OutdoorConditions,
  RuleId,
} from './control';
export type { Alert, AlertType } from './alerts';
export type { SystemEvent, SystemEventType } from './events';
export type { ScenarioAction, ScenarioStep, SimulationScenario } from './scenarios';
export type { LiveSnapshot, SimulationSpeed, TrendHistory, TrendPoint } from './snapshot';
