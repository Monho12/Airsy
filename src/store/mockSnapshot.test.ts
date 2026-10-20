import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig, OUTDOOR_BASELINE } from '@/domain/config/building';
import { simulationConfig } from '@/domain/config/simulation';
import { indoorThresholds, timingThresholds } from '@/domain/config/thresholds';

import { createMockSnapshot, MOCK_OFFSETS, MOCK_SAMPLE } from './mockSnapshot';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('mockSnapshot — давтагдах байдал (D45)', () => {
  it('хоёр удаа үүсгэхэд яг ижил', () => {
    expect(createMockSnapshot()).toEqual(createMockSnapshot());
  });

  it('машины цаг ба Math.random-аас хамаарахгүй', () => {
    const random = vi.spyOn(Math, 'random');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    const a = createMockSnapshot();
    vi.setSystemTime(new Date('2099-12-31T23:59:59Z'));
    const b = createMockSnapshot();
    expect(a).toEqual(b);
    expect(random).not.toHaveBeenCalled();
  });

  it('хугацаа нь startTime-аас тогтмол офсетоор', () => {
    const snapshot = createMockSnapshot();
    const start = simulationConfig.startTime;
    expect(snapshot.simTime).toBe(start + MOCK_OFFSETS.simTimeAfterStartMs);
    expect(snapshot.events.map((e) => e.timestamp)).toEqual([
      start,
      snapshot.simTime - MOCK_OFFSETS.co2AlertBeforeMs,
      snapshot.simTime - MOCK_OFFSETS.disconnectBeforeMs,
      snapshot.simTime -
        MOCK_OFFSETS.disconnectBeforeMs +
        timingThresholds.alertDebounceSteps * 1000,
    ]);
    expect(snapshot.events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });
});

describe('mockSnapshot — агуулга (§13 Phase 2)', () => {
  const snapshot = createMockSnapshot();

  it('гэрээ: schemaVersion 1, бүх мэдрэгч ба төхөөрөмж, decisions хоосон', () => {
    expect(snapshot.schemaVersion).toBe(1);
    expect(Object.keys(snapshot.readings)).toEqual(Object.keys(buildingConfig.sensors));
    expect(Object.keys(snapshot.devices)).toEqual(Object.keys(buildingConfig.devices));
    expect(snapshot.decisions).toEqual({});
    expect(snapshot.simulation.running).toBe(false);
  });

  it('нэг анхааруулгатай давхар (F02) — бусад бүх утга normal эсвэл холболтгүй нэг мэдрэгч', () => {
    const notNormal = Object.values(snapshot.readings).filter((r) => r.status !== 'normal');
    expect(Object.fromEntries(notNormal.map((r) => [r.sensorId, r.status]))).toEqual({
      [MOCK_SAMPLE.warningSensorId]: 'warning',
      [MOCK_SAMPLE.offlineSensorId]: 'offline',
    });
    expect(MOCK_SAMPLE.warningValue).toBeGreaterThanOrEqual(indoorThresholds.co2.warningEnter);
    expect(MOCK_SAMPLE.warningValue).toBeLessThan(indoorThresholds.co2.criticalEnter);
  });

  it('холболтгүй мэдрэгч: value null (хэзээ ч 0 биш), сүүлийн зөв утга хадгалагдана', () => {
    const offline = snapshot.readings[MOCK_SAMPLE.offlineSensorId]!;
    expect(offline.value).toBeNull();
    expect(offline.value).not.toBe(0);
    expect(offline).toMatchObject({
      connection: 'offline',
      status: 'offline',
      levels: null,
      condition: null,
    });
    expect(offline.lastValidValue).toBe(buildingConfig.areas['F04-A']!.baseline.co2);
    expect(offline.lastValidAt).toBe(snapshot.simTime - MOCK_OFFSETS.disconnectBeforeMs);
    expect(offline.timestamp).toBe(offline.lastValidAt);
  });

  it('бусад утга §5.1.2-ын прототипийн суурь утгатай (тохиргооноос)', () => {
    expect(snapshot.readings['F11-A-voc']!.value).toBe(115);
    expect(snapshot.readings['F07-B-temperature']!.value).toBe(
      buildingConfig.areas['F07-B']!.baseline.temperature,
    );
    expect(snapshot.readings['OUT-pm25']).toMatchObject({
      value: OUTDOOR_BASELINE.pm25,
      levels: null,
    });
  });

  it('төхөөрөмж суурь төлөвт (SF LOW, EF LOW, OAD MINIMUM), автомат горим', () => {
    for (const device of Object.values(snapshot.devices)) {
      expect(device.mode).toBe('auto');
      expect(device.manualOverride).toBeNull();
    }
    expect(snapshot.devices['F07-SF']!.state).toEqual({ kind: 'supply_fan', level: 'LOW' });
    expect(snapshot.devices['F07-OAD']!.state).toEqual({
      kind: 'outdoor_air_damper',
      position: 'MINIMUM',
    });
    expect(snapshot.devices['F07-SF']!.name).toBe('Агаар оруулах сэнс F07');
  });

  it('дохио: §5.2-ын түлхүүрүүд, давтагдашгүй ID, тайлбар нь ангиллынхтай ижил', () => {
    const { active } = snapshot.alerts;
    expect(active.map((a) => a.key)).toEqual(['threshold:co2:F02', 'sensor_offline:F04-A-co2']);
    expect(new Set(active.map((a) => a.id)).size).toBe(active.length);
    expect(active[0]!.message).toBe(snapshot.readings[MOCK_SAMPLE.warningSensorId]!.explanation);
    expect(active[0]!.title).toBe('CO₂ өндөр — 2-р давхар');
    expect(active.every((a) => a.status === 'active')).toBe(true);
  });

  it('гадна PM2.5 8 < 10 тул pmDilutionAllowed; бусад удирдлагын төлөв суурь (§7.4)', () => {
    expect(snapshot.control).toEqual({
      autoMode: true,
      outdoorAirRestricted: false,
      pmDilutionAllowed: true,
      fallbackFloors: [],
      freeCoolingFloors: [],
      emergency: null,
    });
  });
});
