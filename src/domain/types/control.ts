// Удирдлагын төрөл (CLAUDE.md §6, §10). Phase 2-т зөвхөн гэрээ; engine Phase 5-д.
import type { DeviceKind, DeviceState, VentilationDevice } from './devices';
import type { DeviceId, FloorId, SimTimeMs } from './ids';
import type { MetricType, ThresholdLevels } from './metrics';

export type RuleId =
  | 'R-EMERGENCY'
  | 'R-MANUAL'
  | 'R-SENSOR-FALLBACK'
  | 'R-IAQ-CRITICAL'
  | 'R-IAQ-WARNING'
  | 'R-THERMAL'
  | 'R-BASELINE';

export type ConstraintId = 'C-OUTDOOR-AIR';

/** Дүрмийн харж болох бүх зүйл (зөвхөн унших) */
export interface ControlContext {
  floorId: FloorId;
  now: SimTimeMs;
  floorAggregates: Partial<Record<MetricType, FloorMetricAggregate>>; // зөвхөн зөв хэмжилт; байхгүй = өгөгдөлгүй
  outdoor: OutdoorConditions; // зөв хэмжилтгүй талбар null
  devices: Record<DeviceKind, VentilationDevice>;
  autoMode: boolean;
  outdoorAirRestricted: boolean; // C-OUTDOOR-AIR (барилга); энэ алхмын 0-р үе шатанд тооцсон (§6.2)
  pmDilutionAllowed: boolean; // гадна PM2.5-аар шингэлэх (барилга); 0-р үе шатанд тооцсон (§6.5)
  freeCoolingActive: boolean; // энэ давхрын үнэгүй хөргөлт; 0-р үе шатанд тооцсон (§6.5)
  emergency: EmergencyState | null;
}

/** §5.6; зөвхөн зөв хэмжилтээс */
export interface FloorMetricAggregate {
  max: number;
  min: number;
  validCount: number; // ≥ 1 (0 бол нэгтгэл огт үүсэхгүй)
  levels: ThresholdLevels; // тал бүрийн хамгийн муу түвшин; ерөнхий төлөвийг worstLevel()-оор гаргана
}

export interface ControlRequest {
  ruleId: RuleId;
  priority: number;
  deviceKind: DeviceKind;
  target: DeviceState;
  role: 'demand' | 'minimum' | 'override'; // §6.4: эрэлт / доод хязгаар / яаралтай
  reason: string; // хүн унших тайлбар (Монгол)
}

/** Дүрэм = код + мета мэдээлэл */
export interface ControlRule {
  id: RuleId;
  name: string;
  priority: number;
  description: string; // «Яагаад?» шалгагчид харагдана
  evaluate(ctx: ControlContext): ControlRequest[]; // цэвэр функц
}

export interface ControlDecision {
  deviceId: DeviceId;
  evaluatedAt: SimTimeMs;
  candidates: ControlRequest[];
  winningRuleId: RuleId | null; // эцсийн түвшинг тогтоосон дүрэм (§6.4)
  contributingRuleIds: RuleId[]; // ижил эцсийн утга хүссэн бусад дүрэм
  requestedState: DeviceState | null;
  constrainedState: DeviceState | null;
  constraintsApplied: { id: ConstraintId; note: string }[];
  minimumApplied: { ruleId: 'R-SENSOR-FALLBACK'; note: string } | null;
  outcome:
    'applied' | 'unchanged' | 'held_by_dwell' | 'manual' | 'recommendation_only' | 'emergency';
  reason: string;
}

export interface ControlState {
  autoMode: boolean;
  outdoorAirRestricted: boolean;
  pmDilutionAllowed: boolean;
  fallbackFloors: FloorId[];
  freeCoolingFloors: FloorId[];
  emergency: EmergencyState | null;
}

export interface EmergencyState {
  fireFloorId: FloorId;
  startedAt: SimTimeMs;
}

export interface OutdoorConditions {
  temperature: number | null;
  humidity: number | null;
  pm25: number | null;
  co2: number; // тохиргооны тогтмол утга
}
