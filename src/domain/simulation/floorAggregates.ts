// Давхар бүрийн хэмжигдэхүүний нэгтгэл (CLAUDE.md §5.6). Зөвхөн дотоод мэдрэгчийн **зөв хэмжилтээс**
// (`aggregateFloorMetric`); зөв хэмжилтгүй бол тухайн хэмжигдэхүүн байхгүй (тэг биш).
// D89: давхрын нэгтгэлд зөвхөн удирдлагад оролцох бүс (`controlRole: 'ventilation'`); техникийн өрөө (`monitorOnly`)
// бүс тус бүрийн нэгтгэлээр зөвхөн дохио өгнө.
import { aggregateFloorMetric } from '@/domain/classification';
import { METRICS, type BuildingConfig } from '@/domain/config/building';
import type {
  AreaId,
  FloorId,
  FloorMetricAggregate,
  MetricType,
  SensorId,
  SensorReading,
  SimTimeMs,
} from '@/domain/types';

export type FloorSensorIndex = Record<FloorId, Record<MetricType, SensorId[]>>;
export type FloorAggregates = Record<FloorId, Partial<Record<MetricType, FloorMetricAggregate>>>;

export type AreaSensorIndex = Record<AreaId, Record<MetricType, SensorId[]>>;
export type AreaAggregates = Record<AreaId, Partial<Record<MetricType, FloorMetricAggregate>>>;

const emptyMetrics = (): Record<MetricType, SensorId[]> => ({
  temperature: [],
  co2: [],
  humidity: [],
  pm25: [],
  voc: [],
});

const controlRoleOf = (config: BuildingConfig, areaId: AreaId | null) =>
  areaId === null ? null : (config.areas[areaId]?.controlRole ?? null);

/**
 * Давхар → хэмжигдэхүүн → удирдлагад оролцох бүсийн дотоод мэдрэгчийн ID (тохиргооны дарааллаар; нэг удаа тооцно).
 * Техникийн өрөө (`monitorOnly`) давхрын нэгтгэлд орохгүй (D89).
 */
export function indexFloorSensors(config: BuildingConfig): FloorSensorIndex {
  const index: FloorSensorIndex = {};
  for (const floorId of config.building.floorIds) index[floorId] = emptyMetrics();
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.location !== 'indoor' || sensor.floorId === null) continue;
    if (controlRoleOf(config, sensor.areaId) !== 'ventilation') continue;
    index[sensor.floorId]?.[sensor.metric].push(sensor.id);
  }
  return index;
}

/** Бүс → хэмжигдэхүүн → мэдрэгчийн ID — тухайн `controlRole`-той бүсүүдэд (D89) */
export function indexAreaSensors(
  config: BuildingConfig,
  role: 'ventilation' | 'monitorOnly',
): AreaSensorIndex {
  const index: AreaSensorIndex = {};
  for (const area of Object.values(config.areas)) {
    if (area.controlRole === role) index[area.id] = emptyMetrics();
  }
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.areaId === null) continue;
    index[sensor.areaId]?.[sensor.metric].push(sensor.id);
  }
  return index;
}

const readingsOf = (
  ids: readonly SensorId[],
  readings: Readonly<Record<SensorId, SensorReading>>,
) =>
  ids.flatMap((id) => {
    const reading = readings[id];
    return reading === undefined ? [] : [reading];
  });

/** Бүс тус бүрийн нэгтгэл (техникийн өрөөний дохионд, D89) — зөвхөн зөв хэмжилтээс */
export function computeAreaAggregates(
  index: AreaSensorIndex,
  readings: Readonly<Record<SensorId, SensorReading>>,
  now: SimTimeMs,
): AreaAggregates {
  const result: AreaAggregates = {};
  for (const [areaId, byMetric] of Object.entries(index)) {
    const area: Partial<Record<MetricType, FloorMetricAggregate>> = {};
    for (const metric of METRICS) {
      const aggregate = aggregateFloorMetric(readingsOf(byMetric[metric], readings), now);
      if (aggregate !== undefined) area[metric] = aggregate;
    }
    result[areaId] = area;
  }
  return result;
}

/**
 * Давхар бүрт удирдлагад оролцох **аль нэг** бүсэд CO₂-ийн зөв хэмжилт алга эсэх (D89: харалган цэг → нөөц горим,
 * §6.1, §6.3). `ventilationAreas` — `indexAreaSensors(config, 'ventilation')`.
 */
export function computeCo2Gaps(
  config: BuildingConfig,
  ventilationAreas: AreaSensorIndex,
  readings: Readonly<Record<SensorId, SensorReading>>,
  now: SimTimeMs,
): Record<FloorId, boolean> {
  const gaps: Record<FloorId, boolean> = {};
  for (const floorId of config.building.floorIds) gaps[floorId] = false;
  for (const [areaId, byMetric] of Object.entries(ventilationAreas)) {
    const floorId = config.areas[areaId]?.floorId;
    if (floorId === undefined) continue;
    const co2 = aggregateFloorMetric(readingsOf(byMetric.co2, readings), now);
    if (co2 === undefined) gaps[floorId] = true;
  }
  return gaps;
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
      const aggregate = aggregateFloorMetric(readingsOf(byMetric[metric], readings), now);
      if (aggregate !== undefined) floor[metric] = aggregate;
    }
    result[floorId] = floor;
  }
  return result;
}
