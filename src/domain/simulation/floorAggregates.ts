// Давхар бүрийн хэмжигдэхүүний нэгтгэл (CLAUDE.md §5.6). Зөвхөн дотоод мэдрэгчийн **зөв хэмжилтээс**
// (`aggregateFloorMetric`); зөв хэмжилтгүй бол тухайн хэмжигдэхүүн байхгүй (тэг биш).
import { aggregateFloorMetric } from '@/domain/classification';
import { METRICS, type BuildingConfig } from '@/domain/config/building';
import type {
  FloorId,
  FloorMetricAggregate,
  MetricType,
  SensorId,
  SensorReading,
  SimTimeMs,
} from '@/domain/types';

export type FloorSensorIndex = Record<FloorId, Record<MetricType, SensorId[]>>;
export type FloorAggregates = Record<FloorId, Partial<Record<MetricType, FloorMetricAggregate>>>;

/** Давхар → хэмжигдэхүүн → дотоод мэдрэгчийн ID (тохиргооны дарааллаар; нэг удаа тооцно) */
export function indexFloorSensors(config: BuildingConfig): FloorSensorIndex {
  const index: FloorSensorIndex = {};
  for (const floorId of config.building.floorIds) {
    index[floorId] = { temperature: [], co2: [], humidity: [], pm25: [], voc: [] };
  }
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.location !== 'indoor' || sensor.floorId === null) continue;
    index[sensor.floorId]?.[sensor.metric].push(sensor.id);
  }
  return index;
}

export function computeFloorAggregates(
  index: FloorSensorIndex,
  readings: Readonly<Record<SensorId, SensorReading>>,
  now: SimTimeMs,
): FloorAggregates {
  const result: FloorAggregates = {};
  for (const [floorId, byMetric] of Object.entries(index)) {
    const floor: Partial<Record<MetricType, FloorMetricAggregate>> = {};
    for (const metric of METRICS) {
      const floorReadings = byMetric[metric].flatMap((id) => {
        const reading = readings[id];
        return reading === undefined ? [] : [reading];
      });
      const aggregate = aggregateFloorMetric(floorReadings, now);
      if (aggregate !== undefined) floor[metric] = aggregate;
    }
    result[floorId] = floor;
  }
  return result;
}
