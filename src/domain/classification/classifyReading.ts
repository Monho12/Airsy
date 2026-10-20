// Утгын ангилал — цэвэр функц (CLAUDE.md §5.6, D32, D49).
import {
  conditionsByMetric,
  metricSpecs,
  type IndoorThresholds,
  type ThresholdDefinition,
} from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import type {
  ConnectionStatus,
  MetricType,
  ReadingClassification,
  ThresholdConditionId,
  ThresholdLevel,
  ThresholdLevels,
} from '@/domain/types';

import { statusRank } from './status';

const OFFLINE: ReadingClassification = Object.freeze({
  status: 'offline',
  levels: null,
  condition: null,
  explanation: mn.classification.offline,
});

interface SideResult {
  level: ThresholdLevel;
  /** Орох босгыг давахаа больсон ч гарах босгод хүрээгүй тул барьж буй */
  held: boolean;
}

/** Орох босгоор тооцсон түүхий түвшин — hysteresis-ээс өмнөх, зөвхөн энэ файлын дотоод алхам (§5.6-ийн 3). */
function rawLevel(value: number, def: ThresholdDefinition): ThresholdLevel {
  const reached = (enter: number) => (def.side === 'high' ? value >= enter : value <= enter);
  if (reached(def.criticalEnter)) return 'critical';
  if (reached(def.warningEnter)) return 'warning';
  return 'normal';
}

/** Гарах босгыг давсан эсэх: `high` талд `value < exit`, `low` талд `value > exit`. */
function hasExited(value: number, exit: number, def: ThresholdDefinition): boolean {
  return def.side === 'high' ? value < exit : value > exit;
}

/** Нэг талын hysteresis (§5.6-ийн 4–5): муудах нь шууд, сайжрах нь зөвхөн гарах босгоор. */
function evaluateSide(
  value: number,
  def: ThresholdDefinition,
  previous: ThresholdLevel,
): SideResult {
  const raw = rawLevel(value, def);
  if (statusRank(raw) >= statusRank(previous)) return { level: raw, held: false };

  // Сайжирч байна: өмнөх түвшнээс зөвхөн гарах босгыг давсан хэмжээгээр бууна.
  if (previous === 'critical' && !hasExited(value, def.criticalExit, def)) {
    return { level: 'critical', held: true };
  }
  if (raw === 'warning') return { level: 'warning', held: false };
  if (!hasExited(value, def.warningExit, def)) return { level: 'warning', held: true };
  return { level: 'normal', held: false };
}

/**
 * Нэг мэдрэгчийн утгыг ангилна (§5.6).
 *
 * @param previous — тухайн мэдрэгчийн өмнөх ангилал (D49). `stale` үед бүхэлд нь буцаана; hysteresis нь
 *   `previous.levels`-ийг ашиглана, `null` бол бүх тал `normal`-оос шинээр эхэлнэ.
 * @param thresholds — дотоод мэдрэгчид `indoorThresholds`; **гадна** мэдрэгчид `null` — зөвхөн зөв эсэхээр
 *   (`normal`/`offline`/`invalid`, `levels: null`; §5.5).
 */
export function classifyReading(
  metric: MetricType,
  value: number | null,
  connection: ConnectionStatus,
  previous: ReadingClassification | null,
  thresholds: IndoorThresholds | null,
): ReadingClassification {
  // 1. Холболтгүй → offline (хэзээ ч 0 биш). Хуучирсан → өмнөх ангилал бүхэлдээ, байхгүй бол offline (D49).
  if (connection === 'offline') return OFFLINE;
  if (connection === 'stale') return previous ?? OFFLINE;

  // 2. Буруу утга (§5.4)
  const spec = metricSpecs[metric];
  if (value === null || !Number.isFinite(value)) {
    return {
      status: 'invalid',
      levels: null,
      condition: null,
      explanation: mn.classification.invalidNonNumeric,
    };
  }
  if (value < spec.validMin || value > spec.validMax) {
    return {
      status: 'invalid',
      levels: null,
      condition: null,
      explanation: mn.classification.invalidOutOfRange(
        value,
        spec.validMin,
        spec.validMax,
        spec.unit,
        spec.decimals,
      ),
    };
  }

  // Гадна мэдрэгч: зөвхөн зөв эсэх (§5.5)
  if (thresholds === null)
    return { status: 'normal', levels: null, condition: null, explanation: null };

  // 3–5. Тал бүрийг тусад нь, зөвхөн өөрийн өмнөх түвшингээр
  const sides = conditionsByMetric[metric];
  const previousLevels = previous?.levels ?? null;
  const previousHigh = previousLevels?.high ?? 'normal';
  const previousLow = previousLevels?.kind === 'two-sided' ? previousLevels.low : 'normal';

  const high = {
    id: sides.high,
    def: thresholds[sides.high],
    result: evaluateSide(value, thresholds[sides.high], previousHigh),
  };
  const low =
    sides.low === null
      ? null
      : {
          id: sides.low,
          def: thresholds[sides.low],
          result: evaluateSide(value, thresholds[sides.low], previousLow),
        };

  const levels: ThresholdLevels =
    low === null
      ? { kind: 'one-sided', high: high.result.level }
      : { kind: 'two-sided', high: high.result.level, low: low.result.level };

  // 6. status = хамгийн муу тал; condition = тэр тал (тэнцвэл high)
  const deciding =
    low !== null && statusRank(low.result.level) > statusRank(high.result.level) ? low : high;
  const level = deciding.result.level;
  if (level === 'normal') return { status: 'normal', levels, condition: null, explanation: null };

  const condition: ThresholdConditionId = deciding.id;
  // 7. Тайлбар (Монгол, §8.9)
  const explanation = mn.classification.threshold({
    metric,
    unit: spec.unit,
    decimals: spec.decimals,
    value,
    level,
    side: deciding.def.side,
    enter: level === 'critical' ? deciding.def.criticalEnter : deciding.def.warningEnter,
    exit: level === 'critical' ? deciding.def.criticalExit : deciding.def.warningExit,
    heldByHysteresis: deciding.result.held,
  });
  return { status: level, levels, condition, explanation };
}
