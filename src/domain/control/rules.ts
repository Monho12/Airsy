// Удирдлагын дүрмүүд (CLAUDE.md §6.3, §6.5, §6.9). Дүрэм бүр цэвэр функц: ижил `ControlContext` → ижил хүсэлт.
// Дүрмүүд зөвхөн debounce-оор баталгаажсан түвшинг уншина (`ctx.floorAggregates[*].levels.high`, §6.6, D78).
// `R-MANUAL` нь хүсэлт үүсгэгч биш, шүүлтүүр — `resolve.ts`-д (§6.4-ийн 2-р алхам).
import { indoorThresholds, metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatMetricValueMn, mn } from '@/domain/i18n/mn';
import type {
  ControlContext,
  ControlRequest,
  ControlRule,
  DamperPosition,
  DeviceKind,
  DeviceState,
  FanLevel,
  FloorId,
  RuleId,
  ThresholdLevel,
} from '@/domain/types';

export const RULE_PRIORITY: Record<RuleId, number> = {
  'R-EMERGENCY': 1000,
  'R-MANUAL': 900,
  'R-SENSOR-FALLBACK': 700,
  'R-IAQ-CRITICAL': 600,
  'R-IAQ-WARNING': 500,
  'R-THERMAL': 400,
  'R-BASELINE': 100,
};

/** 'F07' → 7 (§5.2-ын ID-ийн дүрэм) */
export const floorLevelOf = (floorId: FloorId): number => Number.parseInt(floorId.slice(1), 10);

const sf = (level: FanLevel): DeviceState => ({ kind: 'supply_fan', level });
const ef = (level: FanLevel): DeviceState => ({ kind: 'exhaust_fan', level });
const oad = (position: DamperPosition): DeviceState => ({ kind: 'outdoor_air_damper', position });

function request(
  ruleId: RuleId,
  role: ControlRequest['role'],
  target: DeviceState,
  reason: string,
): ControlRequest {
  return { ruleId, priority: RULE_PRIORITY[ruleId], deviceKind: target.kind, target, role, reason };
}

/** «2-р давхар: CO₂ 1,180 ppm — анхааруулга (≥ 1,000 ppm).» */
function metricReason(
  ctx: ControlContext,
  metric: 'co2' | 'voc' | 'pm25' | 'temperature',
  level: Exclude<ThresholdLevel, 'normal'>,
): string {
  const aggregate = ctx.floorAggregates[metric]!;
  const spec = metricSpecs[metric];
  const def = indoorThresholds[metric === 'temperature' ? 'temperature-high' : metric];
  const enter = level === 'critical' ? def.criticalEnter : def.warningEnter;
  return mn.control.metricReason(
    floorLabelMn(floorLevelOf(ctx.floorId)),
    `${mn.metrics.shortLabel[metric]} ${formatMetricValueMn(aggregate.max, spec.unit, spec.decimals)}`,
    mn.control.levelWord[level],
    formatMetricValueMn(enter, spec.unit, spec.decimals),
  );
}

const confirmedHigh = (ctx: ControlContext, metric: 'co2' | 'voc' | 'pm25' | 'temperature') =>
  ctx.floorAggregates[metric]?.levels.high ?? 'normal';

/** CO₂/VOC/PM2.5-ын IAQ хүсэлт (§6.3, §6.5): `level` нь энэ дүрмийн түвшин */
function iaqRequests(
  ctx: ControlContext,
  ruleId: 'R-IAQ-CRITICAL' | 'R-IAQ-WARNING',
  matches: (level: ThresholdLevel) => boolean,
  level: 'warning' | 'critical',
): ControlRequest[] {
  const out: ControlRequest[] = [];
  const high = level === 'critical';
  for (const metric of ['co2', 'voc'] as const) {
    if (!matches(confirmedHigh(ctx, metric))) continue;
    const reason = metricReason(ctx, metric, level);
    out.push(
      request(ruleId, 'demand', sf(high ? 'BOOST' : 'HIGH'), reason),
      request(ruleId, 'demand', ef(high ? 'HIGH' : 'MEDIUM'), reason),
      request(ruleId, 'demand', oad(high ? 'OPEN' : 'PARTIAL'), reason),
    );
  }
  if (matches(confirmedHigh(ctx, 'pm25'))) {
    // PM2.5 нь EF-д хүсэлт гаргахгүй (§6.5, D36): шингэлэх эсвэл SF-ээр шүүх
    const base = metricReason(ctx, 'pm25', level);
    const dilution = ctx.pmDilutionAllowed;
    const reason = `${base} ${dilution ? mn.control.pmDilutionNote : mn.control.pmFilterNote}`;
    out.push(
      request(ruleId, 'demand', sf(high ? 'BOOST' : 'HIGH'), reason),
      request(ruleId, 'demand', oad(dilution ? (high ? 'OPEN' : 'PARTIAL') : 'MINIMUM'), reason),
    );
  }
  return out;
}

export const emergencyRule: ControlRule = {
  id: 'R-EMERGENCY',
  name: mn.control.ruleName['R-EMERGENCY'],
  priority: RULE_PRIORITY['R-EMERGENCY'],
  description: mn.control.ruleDescription['R-EMERGENCY'],
  evaluate(ctx) {
    if (ctx.emergency === null) return [];
    // §6.9-ийн жишээ «даралтын сэндвич» стратеги — зөвхөн сургалтын симуляци
    const fireLevel = floorLevelOf(ctx.emergency.fireFloorId);
    const distance = Math.abs(floorLevelOf(ctx.floorId) - fireLevel);
    const role = distance === 0 ? 'fire' : distance === 1 ? 'neighbor' : 'other';
    const reason = mn.control.emergencyReason(role, floorLabelMn(fireLevel));
    const targets: Record<typeof role, [FanLevel, FanLevel, DamperPosition]> = {
      fire: ['OFF', 'BOOST', 'CLOSED'],
      neighbor: ['HIGH', 'OFF', 'OPEN'],
      other: ['OFF', 'OFF', 'CLOSED'],
    };
    const [s, e, d] = targets[role];
    return [
      request('R-EMERGENCY', 'override', sf(s), reason),
      request('R-EMERGENCY', 'override', ef(e), reason),
      request('R-EMERGENCY', 'override', oad(d), reason),
    ];
  },
};

export const sensorFallbackRule: ControlRule = {
  id: 'R-SENSOR-FALLBACK',
  name: mn.control.ruleName['R-SENSOR-FALLBACK'],
  priority: RULE_PRIORITY['R-SENSOR-FALLBACK'],
  description: mn.control.ruleDescription['R-SENSOR-FALLBACK'],
  evaluate(ctx) {
    if (!ctx.sensorFallbackActive) return [];
    const reason = mn.control.fallbackReason(floorLabelMn(floorLevelOf(ctx.floorId)));
    return [
      request('R-SENSOR-FALLBACK', 'minimum', sf('MEDIUM'), reason),
      request('R-SENSOR-FALLBACK', 'minimum', ef('LOW'), reason),
      request('R-SENSOR-FALLBACK', 'minimum', oad('MINIMUM'), reason),
    ];
  },
};

export const iaqCriticalRule: ControlRule = {
  id: 'R-IAQ-CRITICAL',
  name: mn.control.ruleName['R-IAQ-CRITICAL'],
  priority: RULE_PRIORITY['R-IAQ-CRITICAL'],
  description: mn.control.ruleDescription['R-IAQ-CRITICAL'],
  evaluate: (ctx) => iaqRequests(ctx, 'R-IAQ-CRITICAL', (l) => l === 'critical', 'critical'),
};

export const iaqWarningRule: ControlRule = {
  id: 'R-IAQ-WARNING',
  name: mn.control.ruleName['R-IAQ-WARNING'],
  priority: RULE_PRIORITY['R-IAQ-WARNING'],
  description: mn.control.ruleDescription['R-IAQ-WARNING'],
  // Ноцтой үед ч идэвхтэй — давхардлыг §6.4 шийднэ
  evaluate: (ctx) => iaqRequests(ctx, 'R-IAQ-WARNING', (l) => l !== 'normal', 'warning'),
};

export const thermalRule: ControlRule = {
  id: 'R-THERMAL',
  name: mn.control.ruleName['R-THERMAL'],
  priority: RULE_PRIORITY['R-THERMAL'],
  description: mn.control.ruleDescription['R-THERMAL'],
  evaluate(ctx) {
    // Зөвхөн өндөр тал — бага температур хэзээ ч биш (§6.3, §6.5)
    const level = confirmedHigh(ctx, 'temperature');
    if (level === 'normal') return [];
    const base = metricReason(ctx, 'temperature', level);
    const note = ctx.freeCoolingActive ? mn.control.freeCoolingNote : mn.control.noFreeCoolingNote;
    const reason = `${base} ${note}`;
    return [
      request('R-THERMAL', 'demand', sf(level === 'critical' ? 'BOOST' : 'HIGH'), reason),
      request('R-THERMAL', 'demand', oad(ctx.freeCoolingActive ? 'OPEN' : 'MINIMUM'), reason),
    ];
  },
};

export const baselineRule: ControlRule = {
  id: 'R-BASELINE',
  name: mn.control.ruleName['R-BASELINE'],
  priority: RULE_PRIORITY['R-BASELINE'],
  description: mn.control.ruleDescription['R-BASELINE'],
  evaluate() {
    const reason = mn.control.baselineReason;
    return [
      request('R-BASELINE', 'demand', sf('LOW'), reason),
      request('R-BASELINE', 'demand', ef('LOW'), reason),
      request('R-BASELINE', 'demand', oad('MINIMUM'), reason),
    ];
  },
};

/** Эрэмбээр (их → бага) */
export const CONTROL_RULES: readonly ControlRule[] = [
  emergencyRule,
  sensorFallbackRule,
  iaqCriticalRule,
  iaqWarningRule,
  thermalRule,
  baselineRule,
];

export const DEVICE_KIND_ORDER: readonly DeviceKind[] = [
  'supply_fan',
  'exhaust_fan',
  'outdoor_air_damper',
];
