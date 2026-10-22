// Дохионы нөхцөл (§4.4, §5.2, D72) ба §12.2: «1000-ын орчимд ±5 ppm хэлбэлзэх утга давтан үйл явдал үүсгэхгүй».
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { indoorThresholds } from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import { LocalSimulationRuntime } from '@/domain/runtime/LocalSimulationRuntime';
import { computeFloorAggregates, indexFloorSensors } from '@/domain/simulation/floorAggregates';
import { nextReading } from '@/domain/simulation/sensors';
import type { SensorReading } from '@/domain/types';

import { buildAlertConditions } from './conditions';
import { createAlertEvaluatorState, evaluateAlerts } from './evaluator';

const baseline = new LocalSimulationRuntime().getSnapshot();
const index = indexFloorSensors(buildingConfig);
const now = baseline.simTime;

describe('buildAlertConditions', () => {
  const conditions = buildAlertConditions(
    buildingConfig,
    baseline.readings,
    computeFloorAggregates(index, baseline.readings, now),
  );

  it('түлхүүр (§5.2): давхар бүрт 7 босгын нөхцөл + мэдрэгч бүрт offline ба invalid', () => {
    const floors = buildingConfig.building.floorIds.length;
    const sensors = Object.keys(buildingConfig.sensors).length;
    expect(conditions).toHaveLength(floors * Object.keys(indoorThresholds).length + sensors * 2);
    const keys = conditions.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('threshold:co2:F02');
    expect(keys).toContain('threshold:temperature-high:F12');
    expect(keys).toContain('threshold:humidity-low:F04');
    expect(keys).toContain('sensor_offline:F04-A-co2');
    expect(keys).toContain('sensor_invalid:F04-A-humidity');
    expect(keys).toContain('sensor_offline:OUT-pm25');
  });

  it('суурь төлөвт бүх нөхцөл normal (S1: дохио байхгүй)', () => {
    expect(conditions.every((c) => c.level === 'normal')).toBe(true);
  });

  it('гадна мэдрэгчийн гарчиг гадна станцыг нэрлэнэ', () => {
    const outdoor = conditions.find((c) => c.key === 'sensor_offline:OUT-pm25')!;
    expect(outdoor.title).toBe(mn.alerts.sensorOfflineTitle(mn.common.outdoorStation));
  });

  it('давхарт зөв хэмжилт огт байхгүй бол босгын нөхцөл level: null (үнэлэхгүй, тэг биш)', () => {
    const readings = { ...baseline.readings };
    for (const id of index['F04']!.co2) {
      readings[id] = {
        ...readings[id]!,
        connection: 'offline',
        status: 'offline',
        value: null,
        levels: null,
        condition: null,
      };
    }
    const result = buildAlertConditions(
      buildingConfig,
      readings,
      computeFloorAggregates(index, readings, now),
    );
    expect(result.find((c) => c.key === 'threshold:co2:F04')!.level).toBeNull();
    expect(result.find((c) => c.key === 'sensor_offline:F04-A-co2')!.level).toBe('warning');
  });
});

describe('§12.2: 1000 ppm-ийн орчим ±5 ppm хэлбэлзэл давтан үйл явдал үүсгэхгүй', () => {
  it('нэг л ALERT_RAISED, шийдэгдэлт ба давтан үүсэлтгүй (hysteresis + debounce)', () => {
    const config = createBuildingConfig(2);
    const runtime = new LocalSimulationRuntime({ config });
    const sensorIndex = indexFloorSensors(config);
    let readings = runtime.getSnapshot().readings;
    let state = createAlertEvaluatorState();
    const kinds: string[] = [];
    let previous: SensorReading = readings['F02-A-co2']!;
    for (let i = 0; i < 120; i += 1) {
      const t = now + (i + 1) * 1000;
      const value = 1000 + (i % 2 === 0 ? 5 : -5); // 1005, 995, 1005, …
      previous = nextReading({
        sensor: config.sensors['F02-A-co2']!,
        previous,
        measured: value,
        fault: null,
        now: t,
      });
      readings = { ...readings, 'F02-A-co2': previous };
      // Бусад мэдрэгчийн хугацааг шинэчилнэ (хуучирсан болохоос сэргийлж)
      for (const [id, reading] of Object.entries(readings)) {
        if (id !== 'F02-A-co2') readings[id] = { ...reading, timestamp: t };
      }
      const result = evaluateAlerts(
        state,
        buildAlertConditions(config, readings, computeFloorAggregates(sensorIndex, readings, t)),
        t,
      );
      state = result.state;
      kinds.push(...result.transitions.map((tr) => `${tr.kind}:${tr.alert.key}`));
    }
    expect(kinds).toEqual(['raised:threshold:co2:F02']);
  });
});
