// Сценарийн оролт (CLAUDE.md §5.8, §7.1, §10 `ScenarioAction`).
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { baselineOutdoor } from '@/domain/simulation/environment';

import {
  applyInputAction,
  createBaselineInputs,
  occupantsAt,
  outdoorAt,
  pruneInputs,
  rampValue,
  sourcesAt,
} from './inputs';

const T0 = 1_000_000;
const base = () => createBaselineInputs(buildingConfig, baselineOutdoor, T0);
const apply = (
  inputs: ReturnType<typeof base>,
  action: Parameters<typeof applyInputAction>[1],
  now = T0,
) => applyInputAction(inputs, action, buildingConfig, baselineOutdoor, now);

describe('налуу (ramp)', () => {
  it('эхлэхээс өмнө from, дунд нь шугаман, дууссаны дараа to', () => {
    const ramp = { from: 0, to: 10, startAt: 100, endAt: 200 };
    expect(rampValue(ramp, 50)).toBe(0);
    expect(rampValue(ramp, 150)).toBe(5);
    expect(rampValue(ramp, 250)).toBe(10);
    expect(rampValue({ from: 1, to: 2, startAt: 5, endAt: 5 }, 5)).toBe(2);
  });
});

describe('суурь оролт', () => {
  it('суурь ачаалал, нэмэлт эх үүсвэргүй, S1-ийн гадна нөхцөл', () => {
    const inputs = base();
    const area = buildingConfig.areas['F07-A']!;
    expect(occupantsAt(inputs, area, T0)).toBe(area.occupancyCapacity * area.baselineOccupancy);
    expect(sourcesAt(inputs, area, T0)).toEqual({
      heatGain: 0,
      vocSource: 0,
      pmSource: 0,
      moistureSource: 0,
    });
    expect(outdoorAt(inputs, 420, T0)).toEqual(baselineOutdoor);
  });
});

describe('үйлдэл', () => {
  it("setOccupancy 'all' нь бүх бүсийг, налуугаар", () => {
    const inputs = apply(base(), {
      type: 'setOccupancy',
      areaIds: 'all',
      fraction: 0.1,
      rampMs: 10_000,
    });
    for (const area of Object.values(buildingConfig.areas)) {
      expect(occupantsAt(inputs, area, T0 + 10_000)).toBeCloseTo(area.occupancyCapacity * 0.1);
    }
    const f07 = buildingConfig.areas['F07-A']!;
    expect(occupantsAt(inputs, f07, T0 + 5_000)).toBeCloseTo(f07.occupancyCapacity * 0.35);
  });

  it('pulseSource зөвхөн заасан бүсэд, хугацааны турш; дууссаны дараа хасагдана', () => {
    const inputs = apply(base(), {
      type: 'pulseSource',
      areaIds: ['F06-A'],
      metric: 'voc',
      rate: 5,
      durationMs: 60_000,
    });
    const a = buildingConfig.areas['F06-A']!;
    const b = buildingConfig.areas['F06-B']!;
    expect(sourcesAt(inputs, a, T0 + 1_000).vocSource).toBe(5);
    expect(sourcesAt(inputs, b, T0 + 1_000).vocSource).toBe(0);
    expect(sourcesAt(inputs, a, T0 + 60_000).vocSource).toBe(0);
    expect(pruneInputs(inputs, T0 + 60_000).pulses).toHaveLength(0);
    expect(pruneInputs(inputs, T0 + 1_000)).toBe(inputs);
  });

  it('setHeatGain давхрын бүх бүсэд; setOutdoor заасан талбарыг л', () => {
    let inputs = apply(base(), { type: 'setHeatGain', floorIds: ['F12'], value: 0.5, rampMs: 0 });
    inputs = apply(inputs, { type: 'setOutdoor', values: { pm25: 55 }, rampMs: 30_000 });
    expect(sourcesAt(inputs, buildingConfig.areas['F12-B']!, T0).heatGain).toBe(0.5);
    expect(sourcesAt(inputs, buildingConfig.areas['F11-B']!, T0).heatGain).toBe(0);
    const outdoor = outdoorAt(inputs, 420, T0 + 15_000);
    expect(outdoor.pm25).toBeCloseTo((baselineOutdoor.pm25 + 55) / 2);
    expect(outdoor.temperature).toBe(baselineOutdoor.temperature);
  });

  it('restoreBaselineInputs одоогийн утгаас суурь руу налуугаар, импульсийг зогсооно', () => {
    let inputs = apply(base(), { type: 'setOccupancy', areaIds: ['F02-A'], fraction: 1 });
    inputs = apply(inputs, { type: 'setOutdoor', values: { pm25: 55 } });
    inputs = apply(inputs, {
      type: 'pulseSource',
      areaIds: ['F06-A'],
      metric: 'voc',
      rate: 5,
      durationMs: 1e6,
    });
    inputs = apply(inputs, { type: 'restoreBaselineInputs', rampMs: 30_000 }, T0 + 10_000);
    const f02 = buildingConfig.areas['F02-A']!;
    expect(occupantsAt(inputs, f02, T0 + 10_000)).toBeCloseTo(f02.occupancyCapacity);
    expect(occupantsAt(inputs, f02, T0 + 40_000)).toBeCloseTo(
      f02.occupancyCapacity * f02.baselineOccupancy,
    );
    expect(outdoorAt(inputs, 420, T0 + 40_000)).toEqual(baselineOutdoor);
    expect(inputs.pulses).toHaveLength(0);
  });
});
