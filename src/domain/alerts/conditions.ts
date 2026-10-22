// Phase 4-ийн дохионы нөхцөл (CLAUDE.md §4.4, §5.2, D72): босгын (`threshold`) ба мэдрэгчийн (`sensor_offline`,
// `sensor_invalid`). `control_degraded`, `outdoor_air_restricted`, `emergency` (§9.5-ын 6b) нь Phase 5-д.
import type { BuildingConfig } from '@/domain/config/building';
import { indoorThresholds, metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';
import type { Sensor, SensorId, SensorReading, ThresholdConditionId } from '@/domain/types';

import type { AlertCondition, ConditionLevel } from './evaluator';

/** Мэдрэгчийн байршлын шошго: «7-р давхар, Нээлттэй оффис (хойд)» эсвэл гадна станц */
export function sensorLocationLabel(sensor: Sensor, config: BuildingConfig): string {
  if (sensor.floorId === null || sensor.areaId === null) return mn.common.outdoorStation;
  const floor = config.floors[sensor.floorId];
  const area = config.areas[sensor.areaId];
  const floorLabel = floor === undefined ? sensor.floorId : floorLabelMn(floor.level);
  return area === undefined ? floorLabel : `${floorLabel}, ${area.name}`;
}

const floorLabelOf = (sensor: Sensor, config: BuildingConfig) => {
  if (sensor.floorId === null) return mn.common.outdoorStation;
  const floor = config.floors[sensor.floorId];
  return floor === undefined ? sensor.floorId : floorLabelMn(floor.level);
};

const areaNameOf = (sensor: Sensor, config: BuildingConfig) =>
  sensor.areaId === null
    ? mn.common.outdoorStation
    : (config.areas[sensor.areaId]?.name ?? sensor.areaId);

/** Давхрын нэгтгэлийн тухайн талын түвшнээс босгын дохио (§4.4: түлхүүр `threshold:{condition}:{floorId}`) */
function thresholdConditions(
  config: BuildingConfig,
  aggregates: FloorAggregates,
): AlertCondition[] {
  const conditions: AlertCondition[] = [];
  for (const floorId of config.building.floorIds) {
    const floor = config.floors[floorId];
    if (floor === undefined) continue;
    const floorLabel = floorLabelMn(floor.level);
    for (const [id, def] of Object.entries(indoorThresholds) as [
      ThresholdConditionId,
      (typeof indoorThresholds)[ThresholdConditionId],
    ][]) {
      const aggregate = aggregates[floorId]?.[def.metric];
      const spec = metricSpecs[def.metric];
      let level: ConditionLevel | null = null;
      let value: number | null = null;
      if (aggregate !== undefined) {
        const levels = aggregate.levels;
        level =
          def.side === 'high' ? levels.high : levels.kind === 'two-sided' ? levels.low : 'normal';
        value = def.side === 'high' ? aggregate.max : aggregate.min;
      }
      let message = '';
      if (value !== null && (level === 'warning' || level === 'critical')) {
        const enter = level === 'critical' ? def.criticalEnter : def.warningEnter;
        const reached = def.side === 'high' ? value >= enter : value <= enter;
        message = mn.classification.threshold({
          metric: def.metric,
          unit: spec.unit,
          decimals: spec.decimals,
          value,
          level,
          side: def.side,
          enter,
          exit: level === 'critical' ? def.criticalExit : def.warningExit,
          heldByHysteresis: !reached,
        });
      }
      conditions.push({
        key: `threshold:${id}:${floorId}`,
        type: 'threshold',
        scope: { floorId, metric: def.metric, condition: id },
        level,
        title: mn.alerts.thresholdTitle(mn.metrics.shortLabel[def.metric], def.side, floorLabel),
        message,
        value,
        peak: def.side === 'high' ? 'max' : 'min',
      });
    }
  }
  return conditions;
}

/** Мэдрэгч бүрийн холболтгүй ба буруу утгын дохио (§5.2: `sensor_offline:{sensorId}`, `sensor_invalid:{sensorId}`) */
function sensorConditions(
  config: BuildingConfig,
  readings: Readonly<Record<SensorId, SensorReading>>,
): AlertCondition[] {
  const conditions: AlertCondition[] = [];
  for (const sensor of Object.values(config.sensors)) {
    const reading = readings[sensor.id];
    if (reading === undefined) continue;
    const metricLabel = mn.metrics.shortLabel[sensor.metric];
    const scope: AlertCondition['scope'] = {
      ...(sensor.floorId === null ? {} : { floorId: sensor.floorId }),
      ...(sensor.areaId === null ? {} : { areaId: sensor.areaId }),
      sensorId: sensor.id,
      metric: sensor.metric,
    };
    conditions.push({
      key: `sensor_offline:${sensor.id}`,
      type: 'sensor_offline',
      scope,
      level: reading.status === 'offline' ? 'warning' : 'normal',
      title: mn.alerts.sensorOfflineTitle(floorLabelOf(sensor, config)),
      message: mn.alerts.sensorOfflineMessage(areaNameOf(sensor, config), metricLabel),
      value: null,
      peak: null,
    });
    conditions.push({
      key: `sensor_invalid:${sensor.id}`,
      type: 'sensor_invalid',
      scope,
      level: reading.status === 'invalid' ? 'warning' : 'normal',
      title: mn.alerts.sensorInvalidTitle(floorLabelOf(sensor, config)),
      message: mn.alerts.sensorInvalidMessage(
        areaNameOf(sensor, config),
        metricLabel,
        reading.explanation ?? '',
      ),
      value: null,
      peak: null,
    });
  }
  return conditions;
}

/** Алхмын бүх нөхцөл, тогтвортой дарааллаар (давхар → нөхцөл, дараа нь мэдрэгч тохиргооны дарааллаар) */
export function buildAlertConditions(
  config: BuildingConfig,
  readings: Readonly<Record<SensorId, SensorReading>>,
  aggregates: FloorAggregates,
): AlertCondition[] {
  return [...thresholdConditions(config, aggregates), ...sensorConditions(config, readings)];
}
