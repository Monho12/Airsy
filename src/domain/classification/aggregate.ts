// Давхрын хэмжигдэхүүний нэгтгэл (CLAUDE.md §5.6, §10 FloorMetricAggregate).
import { conditionsByMetric } from '@/domain/config/thresholds';
import type {
  FloorMetricAggregate,
  SensorReading,
  SimTimeMs,
  ThresholdLevel,
  ThresholdLevels,
} from '@/domain/types';

import { isValidMeasurement } from './isValidMeasurement';
import { worseLevel } from './status';

/**
 * Нэг давхрын нэг хэмжигдэхүүний утгуудаас нэгтгэл гаргана — зөвхөн **зөв хэмжилтээс** (§5.5).
 * Зөв хэмжилт нэг ч байхгүй бол `undefined` (тэг биш). `levels` нь тал бүрийн хамгийн муу түвшин.
 */
export function aggregateFloorMetric(
  readings: readonly SensorReading[],
  now: SimTimeMs,
): FloorMetricAggregate | undefined {
  const first = readings[0];
  if (first === undefined) return undefined;
  const metric = first.metric;
  if (readings.some((reading) => reading.metric !== metric)) {
    throw new Error('aggregateFloorMetric: бүх утга ижил хэмжигдэхүүнийх байх ёстой');
  }

  const valid = readings.filter((reading) => isValidMeasurement(reading, now));
  if (valid.length === 0) return undefined;

  let max = -Infinity;
  let min = Infinity;
  let high: ThresholdLevel = 'normal';
  let low: ThresholdLevel = 'normal';
  for (const reading of valid) {
    const value = reading.value as number; // isValidMeasurement төгсгөлөг тоо гэдгийг баталсан
    max = Math.max(max, value);
    min = Math.min(min, value);
    if (reading.levels !== null) {
      high = worseLevel(high, reading.levels.high);
      if (reading.levels.kind === 'two-sided') low = worseLevel(low, reading.levels.low);
    }
  }

  const levels: ThresholdLevels =
    conditionsByMetric[metric].low === null
      ? { kind: 'one-sided', high }
      : { kind: 'two-sided', high, low };
  return { max, min, validCount: valid.length, levels };
}
