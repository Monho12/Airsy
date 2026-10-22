// LocalSimulationRuntime (§9.4, §9.4.1, §9.5, §11.1, §12.2 «Runtime-ийн гэрээ», D69–D73). Дэлгэцгүй; timer-ийг
// `vi`-ийн fake timer-ээр (§9.3-ын 3-р дүрэм).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { baselineDeviceStates } from '@/domain/config/control';
import { bufferLimits, sensorNoiseAmplitude, simulationConfig } from '@/domain/config/simulation';
import { timingThresholds } from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import type { LiveSnapshot, MetricType } from '@/domain/types';

import type { AerisCommand } from './AerisRuntime';
import { LocalSimulationRuntime } from './LocalSimulationRuntime';

const N = timingThresholds.alertDebounceSteps;
const STEP = simulationConfig.stepMs;

afterEach(() => {
  vi.useRealTimers();
});

/** Эхэлсэн runtime ба publish-ийн бүртгэл */
function started(options?: ConstructorParameters<typeof LocalSimulationRuntime>[0]) {
  const runtime = new LocalSimulationRuntime(options);
  const published: LiveSnapshot[] = [];
  runtime.subscribe((snapshot) => published.push(snapshot));
  runtime.start();
  return { runtime, published };
}

const eventTypes = (snapshot: LiveSnapshot) => snapshot.events.map((e) => e.type);

describe('эхлэл (D73, §12.4)', () => {
  const snapshot = new LocalSimulationRuntime().getSnapshot();

  it('schemaVersion 1, startTime, ажиллаж буй, 1×, анхдагч seed, идэвхтэй сценаригүй', () => {
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.simTime).toBe(simulationConfig.startTime);
    expect(snapshot.simulation).toEqual({
      running: true,
      speed: 1,
      seed: simulationConfig.defaultSeed,
      activeScenario: null,
    });
  });

  it('бүх мэдрэгч (120 дотоод + 3 гадна) online, хэвийн; төхөөрөмж суурь төлөвт; дохио ба шийдвэргүй', () => {
    const readings = Object.values(snapshot.readings);
    expect(readings).toHaveLength(Object.keys(buildingConfig.sensors).length);
    expect(readings.every((r) => r.connection === 'online' && r.status === 'normal')).toBe(true);
    const devices = Object.values(snapshot.devices);
    expect(devices).toHaveLength(36);
    expect(
      devices.every((d) => d.state === baselineDeviceStates[d.kind] && d.mode === 'auto'),
    ).toBe(true);
    expect(snapshot.alerts).toEqual({ active: [], recentResolved: [] });
    expect(snapshot.decisions).toEqual({});
    expect(eventTypes(snapshot)).toEqual(['SIMULATION_STARTED']);
  });

  it('хандлагын цуваа бүр эхлэх агшны нэг цэгтэй', () => {
    for (const series of Object.values(snapshot.history)) {
      for (const points of Object.values(series)) expect(points).toHaveLength(1);
    }
  });
});

describe('S1-ийн суурь ажиллагаа (§7.2)', () => {
  it('10 минутын (600 алхам) дараа дохио, шинэ үйл явдалгүй; утга S1-ийн мужид (± шуугиан)', () => {
    const runtime = new LocalSimulationRuntime();
    runtime.advance(600);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.simTime).toBe(simulationConfig.startTime + 600 * STEP);
    expect(snapshot.alerts.active).toEqual([]);
    expect(eventTypes(snapshot)).toEqual(['SIMULATION_STARTED']);
    // §7.2 S1: температур 21–24, CO₂ 500–800, RH 40–50, PM2.5 3–8, VOC 80–120 (лабораторийн RH суурь нь 40 тул шуугиан)
    const ranges: Record<MetricType, [number, number]> = {
      temperature: [21, 24],
      co2: [500, 800],
      humidity: [40, 50],
      pm25: [3, 8],
      voc: [80, 120],
    };
    for (const sensor of Object.values(buildingConfig.sensors)) {
      if (sensor.location !== 'indoor') continue;
      const value = snapshot.readings[sensor.id]!.value!;
      const [min, max] = ranges[sensor.metric];
      const noise = sensorNoiseAmplitude[sensor.metric];
      expect(value).toBeGreaterThanOrEqual(min - noise);
      expect(value).toBeLessThanOrEqual(max + noise);
    }
  });
});

describe('давтагдах байдал (§11.1, D69)', () => {
  it('ижил seed + ижил командыг ижил алхмын хооронд → яг ижил snapshot', async () => {
    const run = async () => {
      const { runtime } = started();
      runtime.advance(30);
      await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-A-co2' });
      runtime.advance(30);
      await runtime.dispatch({
        type: 'sensor/injectInvalid',
        sensorId: 'F04-A-humidity',
        value: 140,
      });
      runtime.advance(30);
      runtime.stop();
      return runtime.getSnapshot();
    };
    expect(await run()).toEqual(await run());
  });

  it('өөр seed → өөр шуугиан', () => {
    const a = new LocalSimulationRuntime();
    const b = new LocalSimulationRuntime({ seed: 1 });
    a.advance(5);
    b.advance(5);
    expect(a.getSnapshot().readings['F07-A-co2']!.value).not.toBe(
      b.getSnapshot().readings['F07-A-co2']!.value,
    );
  });
});

describe('structural sharing (§11.2)', () => {
  it('төхөөрөмж, удирдлага, шийдвэр, дохио, үйл явдал өөрчлөгдөөгүй бол ижил лавлагаа', () => {
    const runtime = new LocalSimulationRuntime();
    runtime.advance(1);
    const a = runtime.getSnapshot();
    runtime.advance(1);
    const b = runtime.getSnapshot();
    expect(b).not.toBe(a);
    expect(b.devices).toBe(a.devices);
    expect(b.control).toBe(a.control);
    expect(b.decisions).toBe(a.decisions);
    expect(b.alerts).toBe(a.alerts);
    expect(b.events).toBe(a.events);
    expect(b.simulation).toBe(a.simulation);
    expect(b.readings).not.toBe(a.readings);
  });

  it(`хандлагын цуваа ${bufferLimits.trendPointsPerSeries} цэгээр хязгаартай`, () => {
    const runtime = new LocalSimulationRuntime();
    runtime.advance(bufferLimits.trendPointsPerSeries + 20);
    expect(runtime.getSnapshot().history['F07']!.co2).toHaveLength(
      bufferLimits.trendPointsPerSeries,
    );
  });
});

describe('командын гэрээ (§9.4.1)', () => {
  it('start()-аас өмнө ба stop()-ийн дараа татгалзана, үйл явдалгүй', async () => {
    const runtime = new LocalSimulationRuntime();
    expect(await runtime.dispatch({ type: 'simulation/pause' })).toEqual({
      ok: false,
      reason: mn.common.runtime.notRunning,
    });
    runtime.start();
    runtime.stop();
    expect(await runtime.dispatch({ type: 'simulation/pause' })).toMatchObject({ ok: false });
    expect(eventTypes(runtime.getSnapshot())).toEqual(['SIMULATION_STARTED']);
  });

  it('FIFO; нэг цэвэрлэгээнд нэг publish; бүх үйл явдал одоогийн simTime-тай; дараа нь Promise шийдэгдэнэ', async () => {
    const { runtime, published } = started();
    runtime.advance(5);
    published.length = 0;
    const simTime = runtime.getSnapshot().simTime;
    const results = await Promise.all([
      runtime.dispatch({ type: 'simulation/pause' }),
      runtime.dispatch({ type: 'simulation/setSpeed', speed: 5 }),
      runtime.dispatch({ type: 'simulation/play' }),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(published).toHaveLength(1);
    const added = published[0]!.events.slice(-3);
    expect(added.map((e) => e.type)).toEqual([
      'SIMULATION_PAUSED',
      'SPEED_CHANGED',
      'SIMULATION_STARTED',
    ]);
    expect(added.every((e) => e.timestamp === simTime && e.actor === 'operator')).toBe(true);
    expect(published[0]!.simulation).toMatchObject({ running: true, speed: 5 });
    runtime.stop();
  });

  it('төлөв өөрчлөгдөөгүй команд (давтан pause, ижил хурд) publish ба үйл явдал үүсгэхгүй', async () => {
    const { runtime, published } = started();
    await runtime.dispatch({ type: 'simulation/setSpeed', speed: 1 });
    await runtime.dispatch({ type: 'simulation/play' });
    expect(published).toHaveLength(0);
    runtime.stop();
  });

  it('дэмжигдээгүй хурд татгалзана', async () => {
    const { runtime } = started();
    const result = await runtime.dispatch({
      type: 'simulation/setSpeed',
      speed: 3 as unknown as 1,
    });
    expect(result).toEqual({ ok: false, reason: mn.common.runtime.invalidSpeed });
    runtime.stop();
  });

  it('Phase 4-т хэрэгжээгүй командууд (D71) Монгол шалтгаантай татгалзаж, төлөв ба үйл явдал өөрчлөхгүй', async () => {
    const { runtime, published } = started();
    const before = runtime.getSnapshot();
    const commands: AerisCommand[] = [
      { type: 'simulation/reset' },
      { type: 'scenario/start', scenarioId: 'high-co2' },
      { type: 'scenario/stop' },
      { type: 'emergency/end' },
      { type: 'control/setAutoMode', enabled: false },
      {
        type: 'device/setManual',
        deviceId: 'F07-SF',
        state: { kind: 'supply_fan', level: 'HIGH' },
      },
      { type: 'device/returnToAuto', deviceId: 'F07-SF' },
      { type: 'alert/acknowledge', alertId: 'A-0001' },
    ];
    for (const command of commands) {
      expect(await runtime.dispatch(command)).toEqual({
        ok: false,
        reason: mn.common.runtime.notAvailableYet,
      });
    }
    expect(published).toHaveLength(0);
    expect(runtime.getSnapshot()).toBe(before);
    runtime.stop();
  });

  it('listener дотроос дуудсан dispatch дараагийн цэвэрлэгээнд орно', async () => {
    const runtime = new LocalSimulationRuntime();
    let nested: Promise<unknown> | null = null;
    const seen: LiveSnapshot['simulation'][] = [];
    runtime.subscribe((snapshot) => {
      seen.push(snapshot.simulation);
      if (nested === null) nested = runtime.dispatch({ type: 'simulation/setSpeed', speed: 2 });
    });
    runtime.start();
    await runtime.dispatch({ type: 'simulation/pause' });
    await nested;
    // Эхний цэвэрлэгээ зөвхөн pause-ийг; дотоод команд тусдаа (дараагийн) цэвэрлэгээнд, өөрийн publish-тэй
    expect(seen).toEqual([
      { running: false, speed: 1, seed: simulationConfig.defaultSeed, activeScenario: null },
      { running: false, speed: 2, seed: simulationConfig.defaultSeed, activeScenario: null },
    ]);
    runtime.stop();
  });

  it('үл мэдэгдэх мэдрэгч татгалзана', async () => {
    const { runtime } = started();
    expect(await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F99-A-co2' })).toEqual({
      ok: false,
      reason: mn.common.runtime.unknownSensor('F99-A-co2'),
    });
    runtime.stop();
  });
});

describe('мэдрэгчийн эвдрэл → дохио (FR-S5, §9.4.1, D72)', () => {
  it('салгалт түр зогссон үед ч тэр даруй offline (бүх талбар), дохио debounce-ийн дараа', async () => {
    const { runtime } = started();
    await runtime.dispatch({ type: 'simulation/pause' });
    const simTime = runtime.getSnapshot().simTime;
    await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-A-co2' });
    const snapshot = runtime.getSnapshot();
    const reading = snapshot.readings['F04-A-co2']!;
    expect(reading).toMatchObject({
      connection: 'offline',
      status: 'offline',
      value: null,
      levels: null,
      condition: null,
      explanation: mn.classification.offline,
    });
    expect(reading.lastValidValue).not.toBeNull();
    expect(snapshot.simTime).toBe(simTime); // түр зогссон — алхам ахиагүй
    expect(snapshot.events.at(-1)).toMatchObject({
      type: 'SENSOR_DISCONNECTED',
      timestamp: simTime,
      sensorId: 'F04-A-co2',
      floorId: 'F04',
    });
    expect(snapshot.alerts.active).toEqual([]); // дохио дараагийн алхмуудад

    runtime.advance(N - 1);
    expect(runtime.getSnapshot().alerts.active).toEqual([]);
    runtime.advance(1);
    const alert = runtime.getSnapshot().alerts.active[0]!;
    expect(alert).toMatchObject({
      key: 'sensor_offline:F04-A-co2',
      type: 'sensor_offline',
      severity: 'warning',
    });
    // Нэг CO₂ мэдрэгч зөв хэвээр тул давхрын нэгтгэл байгаа — босгын дохиогүй
    expect(runtime.getSnapshot().alerts.active).toHaveLength(1);
    runtime.stop();
  });

  it('дахин холбоход SENSOR_RECONNECTED; утга дараагийн алхамд online, дохио шийдэгдэнэ', async () => {
    const { runtime } = started();
    await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-A-co2' });
    runtime.advance(N);
    await runtime.dispatch({ type: 'sensor/reconnect', sensorId: 'F04-A-co2' });
    let snapshot = runtime.getSnapshot();
    expect(snapshot.events.at(-1)!.type).toBe('SENSOR_RECONNECTED');
    expect(snapshot.readings['F04-A-co2']!.connection).toBe('offline'); // дараагийн алхам хүртэл
    runtime.advance(1);
    snapshot = runtime.getSnapshot();
    expect(snapshot.readings['F04-A-co2']!.connection).toBe('online');
    expect(snapshot.alerts.active).toEqual([]);
    expect(snapshot.alerts.recentResolved[0]).toMatchObject({
      key: 'sensor_offline:F04-A-co2',
      status: 'resolved',
    });
    expect(eventTypes(snapshot).slice(-1)).toEqual(['ALERT_RESOLVED']);
    runtime.stop();
  });

  it('буруу утга: команд publish хийхгүй; дараагийн алхамд invalid + SENSOR_INVALID_READING; debounce-ийн дараа дохио', async () => {
    const { runtime, published } = started();
    await runtime.dispatch({
      type: 'sensor/injectInvalid',
      sensorId: 'F04-A-humidity',
      value: 140,
    });
    expect(published).toHaveLength(0);
    runtime.advance(1);
    const reading = runtime.getSnapshot().readings['F04-A-humidity']!;
    expect(reading).toMatchObject({ value: 140, status: 'invalid', connection: 'online' });
    expect(reading.lastValidValue).not.toBe(140);
    expect(runtime.getSnapshot().events.at(-1)).toMatchObject({
      type: 'SENSOR_INVALID_READING',
      sensorId: 'F04-A-humidity',
    });
    runtime.advance(N - 1);
    expect(runtime.getSnapshot().alerts.active.map((a) => a.key)).toEqual([
      'sensor_invalid:F04-A-humidity',
    ]);
    runtime.stop();
  });

  it('F04-ийн бүх CO₂ салвал босгын CO₂ нөхцөл үнэлэгдэхгүй (тэг биш) — зөвхөн мэдрэгчийн дохио', async () => {
    const { runtime } = started();
    await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-A-co2' });
    await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-B-co2' });
    runtime.advance(N + 5);
    const keys = runtime.getSnapshot().alerts.active.map((a) => a.key);
    expect(keys).toEqual(['sensor_offline:F04-A-co2', 'sensor_offline:F04-B-co2']);
    expect(runtime.getSnapshot().history['F04']!.co2.at(-1)!.value).toBeNull();
    runtime.stop();
  });

  it('reconnect "all" нь бүх эвдрэлийг цуцалж, мэдрэгч бүрт нэг үйл явдал', async () => {
    const { runtime } = started();
    await runtime.dispatch({ type: 'sensor/disconnect', sensorId: 'F04-A-co2' });
    await runtime.dispatch({ type: 'sensor/injectInvalid', sensorId: 'OUT-pm25', value: -5 });
    await runtime.dispatch({ type: 'sensor/reconnect', sensorId: 'all' });
    const reconnected = runtime
      .getSnapshot()
      .events.filter((e) => e.type === 'SENSOR_RECONNECTED')
      .map((e) => e.sensorId);
    expect(reconnected).toEqual(['F04-A-co2', 'OUT-pm25']);
    runtime.advance(1);
    expect(runtime.getSnapshot().readings['OUT-pm25']!.status).toBe('normal');
    runtime.stop();
  });
});

describe('timer (D70, §11.1)', () => {
  it('start() давтан дуудахад ганц timer; stop() устгана', () => {
    vi.useFakeTimers();
    const runtime = new LocalSimulationRuntime();
    runtime.start();
    runtime.start();
    expect(vi.getTimerCount()).toBe(1);
    runtime.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() эцсийн (§9.4.1): дараа нь start() дахин эхлүүлэхгүй, dispatch татгалзсаар, алхам ахихгүй', async () => {
    vi.useFakeTimers();
    const { runtime, published } = started();
    runtime.stop();
    const before = runtime.getSnapshot();
    runtime.start();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(runtime.getSnapshot()).toBe(before);
    expect(published).toHaveLength(0);
    expect(await runtime.dispatch({ type: 'simulation/pause' })).toEqual({
      ok: false,
      reason: mn.common.runtime.notRunning,
    });
  });

  it.each([
    [1, 1, 1],
    [2, 2, 2],
    [5, 5, 5],
    [10, 10, 5], // 10×: tick бүрт 2 алхам, publish ≤ 5 Hz
  ] as const)('%i× → бодит секундэд %i алхам, %i publish', async (speed, steps, publishes) => {
    vi.useFakeTimers();
    const { runtime, published } = started();
    await runtime.dispatch({ type: 'simulation/setSpeed', speed });
    published.length = 0;
    const before = runtime.getSnapshot().simTime;
    vi.advanceTimersByTime(1000);
    expect(runtime.getSnapshot().simTime - before).toBe(steps * STEP);
    expect(published.length).toBe(speed === 1 ? 1 : publishes);
    runtime.stop();
  });

  it('түр зогссон үед алхам ахихгүй; хуримтлал түр зогсоход 0 болно (нөхөхгүй)', async () => {
    vi.useFakeTimers();
    const { runtime } = started();
    const t0 = runtime.getSnapshot().simTime;
    vi.advanceTimersByTime(600); // 3 tick → хуримтлал 3/5
    expect(runtime.getSnapshot().simTime).toBe(t0);
    await runtime.dispatch({ type: 'simulation/pause' });
    vi.advanceTimersByTime(5000);
    expect(runtime.getSnapshot().simTime).toBe(t0);
    await runtime.dispatch({ type: 'simulation/play' });
    vi.advanceTimersByTime(800); // хуримтлал 0-оос эхэлсэн тул 4 tick-д алхам байхгүй
    expect(runtime.getSnapshot().simTime).toBe(t0);
    vi.advanceTimersByTime(200);
    expect(runtime.getSnapshot().simTime).toBe(t0 + STEP);
    runtime.stop();
  });

  it('хурд солиход хуримтлал 0 болно', async () => {
    vi.useFakeTimers();
    const { runtime } = started();
    const t0 = runtime.getSnapshot().simTime;
    vi.advanceTimersByTime(800); // хуримтлал 4/5
    await runtime.dispatch({ type: 'simulation/setSpeed', speed: 2 });
    vi.advanceTimersByTime(400); // 2 tick × 2 = 4 < 5
    expect(runtime.getSnapshot().simTime).toBe(t0);
    vi.advanceTimersByTime(200);
    expect(runtime.getSnapshot().simTime).toBe(t0 + STEP);
    runtime.stop();
  });
});
