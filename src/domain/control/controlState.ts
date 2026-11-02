// Удирдлагын 0-р үе шат (CLAUDE.md §6.2): hysteresis-тэй төлөвийг ЭНЭ дарааллаар шинэчилнэ —
// outdoorAirRestricted → pmDilutionAllowed → freeCoolingFloors → дүрмийн debounce / fallbackFloors (§6.5, §6.6).
// Цэвэр функц; debounce-ийн тоолуур runtime-ийн domain төлөвт (snapshot-д биш, §6.6 «Тоолуурын байршил»).
import { isValidMeasurement } from '@/domain/classification';
import { outdoorSensorIdOf } from '@/domain/config/building';
import { outdoorAirThresholds, timingThresholds } from '@/domain/config/thresholds';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';
import type {
  FloorId,
  OutdoorConditions,
  SensorId,
  SensorReading,
  SimTimeMs,
  ThresholdLevel,
} from '@/domain/types';

/** Дүрмийн debounce хийх нөхцөл (§6.6): өндөр талын IAQ ба температур */
export const DEBOUNCED_CONDITIONS = ['co2', 'voc', 'pm25', 'temperature-high'] as const;
export type DebouncedCondition = (typeof DEBOUNCED_CONDITIONS)[number];

const METRIC_OF: Record<DebouncedCondition, 'co2' | 'voc' | 'pm25' | 'temperature'> = {
  co2: 'co2',
  voc: 'voc',
  pm25: 'pm25',
  'temperature-high': 'temperature',
};

interface LevelCounter {
  confirmed: ThresholdLevel;
  /** ≥ анхааруулга дараалсан алхам */
  warningSteps: number;
  /** Ноцтой дараалсан алхам */
  criticalSteps: number;
}

export interface FloorDebounce {
  levels: Record<DebouncedCondition, LevelCounter>;
  /** `co2-missing` — CO₂-ийн зөв хэмжилтгүй дараалсан алхам */
  co2MissingSteps: number;
}

export type RuleDebounceState = Readonly<Record<FloorId, FloorDebounce>>;

export const createRuleDebounceState = (): RuleDebounceState => ({});

const RANK: Record<ThresholdLevel, number> = { normal: 0, warning: 1, critical: 2 };

const emptyCounter = (): LevelCounter => ({
  confirmed: 'normal',
  warningSteps: 0,
  criticalSteps: 0,
});

/**
 * Нэг нөхцөлийн дүрмийн debounce (§6.6): hysteresis-ийн ДАРААХ түвшин өсвөл дараалсан `steps` алхмын дараа
 * баталгаажна (`warning → critical` ч мөн); буурвал тэр даруй.
 */
export function debounceLevel(
  previous: LevelCounter,
  observed: ThresholdLevel,
  steps: number = timingThresholds.ruleDebounceSteps,
): LevelCounter {
  const warningSteps = RANK[observed] >= RANK.warning ? previous.warningSteps + 1 : 0;
  const criticalSteps = observed === 'critical' ? previous.criticalSteps + 1 : 0;
  let confirmed: ThresholdLevel;
  if (RANK[observed] < RANK[previous.confirmed]) {
    confirmed = observed; // бууралт тэр даруй
  } else {
    const candidate: ThresholdLevel =
      criticalSteps >= steps ? 'critical' : warningSteps >= steps ? 'warning' : 'normal';
    confirmed = RANK[candidate] > RANK[previous.confirmed] ? candidate : previous.confirmed;
  }
  return { confirmed, warningSteps, criticalSteps };
}

/** Гадна станцын зөв хэмжилт (§5.5); зөв биш бол `null` (хэзээ ч 0 биш) */
export function outdoorConditionsOf(
  readings: Readonly<Record<SensorId, SensorReading>>,
  now: SimTimeMs,
): OutdoorConditions {
  const valid = (metric: 'temperature' | 'humidity' | 'pm25') => {
    const reading = readings[outdoorSensorIdOf(metric)];
    return reading !== undefined && isValidMeasurement(reading, now) ? reading.value : null;
  };
  return {
    temperature: valid('temperature'),
    humidity: valid('humidity'),
    pm25: valid('pm25'),
    co2: outdoorAirThresholds.outdoorCo2Ppm,
  };
}

/** C-OUTDOOR-AIR (§6.3): ≥ 35 → хязгаарлана, < 25 → зөвшөөрнө, хооронд эсвэл өгөгдөлгүй → өмнөх төлөв */
export function nextOutdoorAirRestricted(previous: boolean, outdoorPm25: number | null): boolean {
  if (outdoorPm25 === null) return previous;
  if (outdoorPm25 >= outdoorAirThresholds.outdoorPm25RestrictEnter) return true;
  if (outdoorPm25 < outdoorAirThresholds.outdoorPm25RestrictExit) return false;
  return previous;
}

/** PM2.5-ыг гадна агаараар шингэлэх (§6.5): < 10 → тийм, ≥ 12 эсвэл өгөгдөлгүй → үгүй, хооронд → өмнөх */
export function nextPmDilutionAllowed(previous: boolean, outdoorPm25: number | null): boolean {
  if (outdoorPm25 === null) return false;
  if (outdoorPm25 < outdoorAirThresholds.outdoorPm25DilutionEnter) return true;
  if (outdoorPm25 >= outdoorAirThresholds.outdoorPm25DilutionExit) return false;
  return previous;
}

/**
 * Давхрын үнэгүй хөргөлт (§6.5): эхлэх — гадна ≤ max − 2 °C ба хязгаарлаагүй ба гадна зөв хэмжилттэй;
 * дуусах — гадна > max − 1 °C, эсвэл хязгаарласан, эсвэл гадна/давхрын температур алга; хооронд → өмнөх.
 */
export function nextFreeCooling(
  previous: boolean,
  outdoorTemperature: number | null,
  floorMaxTemperature: number | null,
  restricted: boolean,
): boolean {
  if (outdoorTemperature === null || floorMaxTemperature === null || restricted) return false;
  if (outdoorTemperature <= floorMaxTemperature - outdoorAirThresholds.freeCoolingMinDelta)
    return true;
  if (outdoorTemperature > floorMaxTemperature - outdoorAirThresholds.freeCoolingExitDelta)
    return false;
  return previous;
}

export interface StageZeroInput {
  floorIds: readonly FloorId[];
  aggregates: FloorAggregates;
  outdoor: OutdoorConditions;
  previous: {
    outdoorAirRestricted: boolean;
    pmDilutionAllowed: boolean;
    freeCoolingFloors: readonly FloorId[];
  };
  debounce: RuleDebounceState;
  debounceSteps?: number;
}

export interface StageZeroResult {
  outdoorAirRestricted: boolean;
  pmDilutionAllowed: boolean;
  freeCoolingFloors: FloorId[];
  fallbackFloors: FloorId[];
  debounce: RuleDebounceState;
  /** Давхар → нөхцөл → баталгаажсан түвшин (дүрмүүд зөвхөн үүнийг уншина, §6.6) */
  confirmed: Record<FloorId, Record<DebouncedCondition, ThresholdLevel>>;
}

export function evaluateStageZero({
  floorIds,
  aggregates,
  outdoor,
  previous,
  debounce,
  debounceSteps = timingThresholds.ruleDebounceSteps,
}: StageZeroInput): StageZeroResult {
  const outdoorAirRestricted = nextOutdoorAirRestricted(
    previous.outdoorAirRestricted,
    outdoor.pm25,
  );
  const pmDilutionAllowed = nextPmDilutionAllowed(previous.pmDilutionAllowed, outdoor.pm25);
  const wasFreeCooling = new Set(previous.freeCoolingFloors);
  const freeCoolingFloors: FloorId[] = [];
  const fallbackFloors: FloorId[] = [];
  const nextDebounce: Record<FloorId, FloorDebounce> = {};
  const confirmed: StageZeroResult['confirmed'] = {};

  for (const floorId of floorIds) {
    const floor = aggregates[floorId] ?? {};
    const temperature = floor.temperature;
    if (
      nextFreeCooling(
        wasFreeCooling.has(floorId),
        outdoor.temperature,
        temperature === undefined ? null : temperature.max,
        outdoorAirRestricted,
      )
    ) {
      freeCoolingFloors.push(floorId);
    }

    const prev = debounce[floorId];
    const levels = {} as FloorDebounce['levels'];
    const floorConfirmed = {} as Record<DebouncedCondition, ThresholdLevel>;
    for (const condition of DEBOUNCED_CONDITIONS) {
      // Зөв хэмжилтгүй хэмжигдэхүүн — дүрэм үнэлэхгүй (§6.5 «Дутуу өгөгдөл»), түвшин хэвийн гэж бууруулна
      const observed: ThresholdLevel = floor[METRIC_OF[condition]]?.levels.high ?? 'normal';
      levels[condition] = debounceLevel(
        prev?.levels[condition] ?? emptyCounter(),
        observed,
        debounceSteps,
      );
      floorConfirmed[condition] = levels[condition].confirmed;
    }
    // `co2-missing`: баталгаажсаны дараа нөөц горим; зөв хэмжилт эргэн ирмэгц тэр даруй цуцлагдана (§6.6)
    const co2MissingSteps = floor.co2 === undefined ? (prev?.co2MissingSteps ?? 0) + 1 : 0;
    if (co2MissingSteps >= debounceSteps) fallbackFloors.push(floorId);
    nextDebounce[floorId] = { levels, co2MissingSteps };
    confirmed[floorId] = floorConfirmed;
  }

  return {
    outdoorAirRestricted,
    pmDilutionAllowed,
    freeCoolingFloors,
    fallbackFloors,
    debounce: nextDebounce,
    confirmed,
  };
}
