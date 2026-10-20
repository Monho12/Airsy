// Босгын цорын ганц эх сурвалж (CLAUDE.md §5.4, §5.5). Компонентод тоон босго хэзээ ч бичихгүй (FR-M2).
// Эдгээр нь прототипийн үзүүлэх босго — хууль эрх зүйн эсвэл стандартын утга БИШ (§5.5, A6).
import type { MetricType, MetricUnit, ThresholdConditionId } from '@/domain/types';

/** Босгын тал: `high` — их байх нь муу, `low` — бага байх нь муу. */
export type ThresholdSide = 'high' | 'low';

/**
 * Нэг талын босго (§5.5-ын хүснэгтийн мөр).
 * `high` талд: орох нь `value ≥ enter`, гарах (сайжрах) нь `value < exit`.
 * `low` талд: орох нь `value ≤ enter`, гарах (сайжрах) нь `value > exit`.
 */
export interface ThresholdDefinition {
  metric: MetricType;
  side: ThresholdSide;
  warningEnter: number;
  warningExit: number;
  criticalEnter: number;
  criticalExit: number;
}

export type IndoorThresholds = Record<ThresholdConditionId, ThresholdDefinition>;

/** Дотоод мэдрэгчийн босго (§5.5). Гадна мэдрэгчид хамаарахгүй. */
export const indoorThresholds: IndoorThresholds = {
  'temperature-high': {
    metric: 'temperature',
    side: 'high',
    warningEnter: 26.0,
    warningExit: 25.5,
    criticalEnter: 29.0,
    criticalExit: 28.5,
  },
  'temperature-low': {
    metric: 'temperature',
    side: 'low',
    warningEnter: 19.0,
    warningExit: 19.5,
    criticalEnter: 16.0,
    criticalExit: 16.5,
  },
  co2: {
    metric: 'co2',
    side: 'high',
    warningEnter: 1000,
    warningExit: 950,
    criticalEnter: 1500,
    criticalExit: 1400,
  },
  'humidity-high': {
    metric: 'humidity',
    side: 'high',
    warningEnter: 60,
    warningExit: 57,
    criticalEnter: 70,
    criticalExit: 67,
  },
  'humidity-low': {
    metric: 'humidity',
    side: 'low',
    warningEnter: 30,
    warningExit: 32,
    criticalEnter: 20,
    criticalExit: 22,
  },
  pm25: {
    metric: 'pm25',
    side: 'high',
    warningEnter: 15,
    warningExit: 12,
    criticalEnter: 35,
    criticalExit: 30,
  },
  voc: {
    metric: 'voc',
    side: 'high',
    warningEnter: 200,
    warningExit: 180,
    criticalEnter: 300,
    criticalExit: 270,
  },
};

/** Хэмжигдэхүүн бүрийн тал (§5.2, §5.6): нэг талт — зөвхөн `high`; хоёр талт — `high` ба `low`. */
export const conditionsByMetric: Record<
  MetricType,
  { high: ThresholdConditionId; low: ThresholdConditionId | null }
> = {
  temperature: { high: 'temperature-high', low: 'temperature-low' },
  humidity: { high: 'humidity-high', low: 'humidity-low' },
  co2: { high: 'co2', low: null },
  pm25: { high: 'pm25', low: null },
  voc: { high: 'voc', low: null },
};

/** Хэмжигдэхүүн, нэгж, нарийвчлал, боломжит муж (§5.4). Мужаас гадуурх утга — буруу утга. */
export const metricSpecs: Record<
  MetricType,
  { unit: MetricUnit; decimals: number; validMin: number; validMax: number }
> = {
  temperature: { unit: '°C', decimals: 1, validMin: -40, validMax: 85 },
  co2: { unit: 'ppm', decimals: 0, validMin: 300, validMax: 10000 },
  humidity: { unit: '%RH', decimals: 0, validMin: 0, validMax: 100 },
  pm25: { unit: 'µg/m³', decimals: 0, validMin: 0, validMax: 1000 },
  voc: { unit: 'index', decimals: 0, validMin: 1, validMax: 500 },
};

/** Гадна агаарын босго — удирдлагын логикт (§5.5, §6). Прототипийн симуляцийн утга. */
export const outdoorAirThresholds = {
  outdoorPm25RestrictEnter: 35, // ≥ 35 µg/m³ — гадна агаар оруулахыг хязгаарлана
  outdoorPm25RestrictExit: 25, // < 25 µg/m³ — дахин зөвшөөрнө
  outdoorPm25DilutionEnter: 10, // < 10 µg/m³ — шингэлэхийг зөвшөөрнө (түр симуляцийн утга, D36)
  outdoorPm25DilutionExit: 12, // ≥ 12 µg/m³ — шингэлэхийг зогсооно (түр симуляцийн утга, D36)
  freeCoolingMinDelta: 2.0, // °C — үнэгүй хөргөлт эхлэх
  freeCoolingExitDelta: 1.0, // °C — үнэгүй хөргөлт дуусах
  outdoorCo2Ppm: 420, // ppm — гадна CO₂-ийн тогтмол агууламж
} as const;

/** Хугацааны босго — симуляцийн хугацаагаар (§5.5). */
export const timingThresholds = {
  sensorStaleAfterMs: 10_000,
  sensorOfflineAfterMs: 20_000,
  ruleDebounceSteps: 3,
  alertDebounceSteps: 3,
} as const;
