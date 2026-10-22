// Мэдрэгчийн утга, холболт, эвдрэл (§5.3–5.6, §9.4.1, FR-M5, FR-S5, D69).
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { sensorNoiseAmplitude, simulationConfig } from '@/domain/config/simulation';
import { metricSpecs, timingThresholds } from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import type { SensorReading } from '@/domain/types';

import { createRng } from './rng';
import { connectionStatus, disconnectedReading, emitValue, nextReading } from './sensors';

const t0 = simulationConfig.startTime;
const co2Sensor = buildingConfig.sensors['F02-A-co2']!;
const outdoorPm = buildingConfig.sensors['OUT-pm25']!;

const read = (value: number, previous: SensorReading | null = null, now = t0, sensor = co2Sensor) =>
  nextReading({ sensor, previous, measured: value, fault: null, now });

describe('connectionStatus (§5.5)', () => {
  const { sensorStaleAfterMs: stale, sensorOfflineAfterMs: offline } = timingThresholds;
  it.each([
    [0, 'online'],
    [stale, 'online'],
    [stale + 1, 'stale'],
    [offline, 'stale'],
    [offline + 1, 'offline'],
  ] as const)('сүүлийн утгаас хойш %i ms → %s', (age, expected) => {
    expect(connectionStatus(t0 + age, t0)).toBe(expected);
  });
});

describe('emitValue — шуугиан ба clamp (D69, §5.8)', () => {
  it('шуугиан ±a-аас хэтрэхгүй; ижил seed → ижил утга', () => {
    const a = createRng(20261019);
    const b = createRng(20261019);
    for (let i = 0; i < 1000; i += 1) {
      const value = emitValue(650, 'co2', a);
      expect(Math.abs(value - 650)).toBeLessThanOrEqual(sensorNoiseAmplitude.co2);
      expect(emitValue(650, 'co2', b)).toBe(value);
    }
  });

  it('боломжит мужаар clamp: 100%-д ойр чийгшил 100-аас хэтрэхгүй', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i += 1) {
      expect(emitValue(99.95, 'humidity', rng)).toBeLessThanOrEqual(metricSpecs.humidity.validMax);
    }
  });
});

describe('nextReading', () => {
  it('хэвийн утга: online, хугацаа = now, сүүлийн зөв утга шинэчлэгдэнэ', () => {
    const reading = read(650);
    expect(reading).toMatchObject({
      value: 650,
      connection: 'online',
      status: 'normal',
      timestamp: t0,
      lastValidValue: 650,
      lastValidAt: t0,
      source: 'simulated',
    });
  });

  it('hysteresis өмнөх ангиллаар (D49): 1000-д анхааруулга, 990-д анхааруулга хэвээр, 940-д хэвийн', () => {
    const entered = read(1000);
    expect(entered.status).toBe('warning');
    const held = read(990, entered, t0 + 1000);
    expect(held.status).toBe('warning');
    expect(read(940, held, t0 + 2000).status).toBe('normal');
  });

  it('буруу утгын эвдрэл: status invalid, сүүлийн зөв утга хадгалагдана', () => {
    const before = read(650);
    const invalid = nextReading({
      sensor: co2Sensor,
      previous: before,
      measured: 655,
      fault: { kind: 'invalid', value: 0 }, // CO₂ = 0 нь буруу (§5.4)
      now: t0 + 1000,
    });
    expect(invalid).toMatchObject({
      value: 0,
      status: 'invalid',
      connection: 'online',
      lastValidValue: 650,
      lastValidAt: t0,
    });
  });

  it('салгалтын эвдрэл: offline, value null (0 биш), сүүлийн зөв утга ба хугацаа хадгалагдана', () => {
    const before = read(650);
    const offline = nextReading({
      sensor: co2Sensor,
      previous: before,
      measured: 655,
      fault: { kind: 'disconnected' },
      now: t0 + 5000,
    });
    expect(offline).toMatchObject({
      value: null,
      connection: 'offline',
      status: 'offline',
      levels: null,
      condition: null,
      explanation: mn.classification.offline,
      lastValidValue: 650,
      lastValidAt: t0,
      timestamp: t0,
    });
  });

  it('гадна мэдрэгч зөвхөн зөв эсэхээр (levels: null, §5.5)', () => {
    const reading = read(80, null, t0, outdoorPm);
    expect(reading).toMatchObject({ status: 'normal', levels: null, condition: null });
  });
});

describe('disconnectedReading (§9.4.1-ийн инвариант)', () => {
  it('connection ба status хоёулаа offline — хэзээ ч зөрөхгүй', () => {
    const warning = read(1200);
    const offline = disconnectedReading(warning);
    expect(offline.connection).toBe('offline');
    expect(offline.status).toBe('offline');
    expect(offline.value).toBeNull();
    expect(offline.lastValidValue).toBe(1200);
  });
});
