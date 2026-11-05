// Сценарийн дэлгэцгүй интеграцийн тест (CLAUDE.md §7.2, §7.4, §9.5, §12.2 «Сценари эхлүүлэх ба эхнээс нь»).
// Runtime-ийг түр зогсоож, алхмыг `advance()`-ээр гараар урагшлуулна (timer-ээс хамаарахгүй).
import { describe, expect, it } from 'vitest';

import { createBuildingConfig } from '@/domain/config/building';
import { simulationConfig } from '@/domain/config/simulation';
import { mn } from '@/domain/i18n/mn';
import { scenarioDefinitions } from '@/domain/scenarios/definitions';
import type { LiveSnapshot, ScenarioId, SystemEvent } from '@/domain/types';

import { LocalSimulationRuntime } from './LocalSimulationRuntime';

async function paused(options?: ConstructorParameters<typeof LocalSimulationRuntime>[0]) {
  const runtime = new LocalSimulationRuntime(options);
  runtime.start();
  await runtime.dispatch({ type: 'simulation/pause' });
  runtime.advance(3);
  return runtime;
}

const lastSeq = (runtime: LocalSimulationRuntime) => runtime.getSnapshot().events.at(-1)?.seq ?? 0;
const eventsAfter = (runtime: LocalSimulationRuntime, seq: number): SystemEvent[] =>
  runtime.getSnapshot().events.filter((event) => event.seq > seq);

/** `expected` нь `actual`-ийн дэд дараалал эсэх (харьцангуй дараалал, §7.2) */
function isSubsequence(actual: readonly string[], expected: readonly string[]): boolean {
  let i = 0;
  for (const item of actual) if (item === expected[i]) i += 1;
  return i === expected.length;
}

const raisedKeys = (snapshot: LiveSnapshot) =>
  new Set([...snapshot.alerts.active, ...snapshot.alerts.recentResolved].map((alert) => alert.key));

async function runScenario(id: ScenarioId, steps: number) {
  const runtime = await paused();
  const seq = lastSeq(runtime);
  expect(await runtime.dispatch({ type: 'scenario/start', scenarioId: id })).toEqual({ ok: true });
  runtime.advance(steps);
  return { runtime, events: eventsAfter(runtime, seq) };
}

const STEPS: Record<Exclude<ScenarioId, 'recovery'>, number> = {
  'normal-operation': 20,
  'elevated-temperature': 130,
  'high-co2': 200,
  'voc-cleaning': 200,
  'poor-outdoor-air': 300,
  'fire-emergency': 40,
  'sensor-disconnection': 60,
};

describe('сценари бүр — хүлээгдэх дохио ба үйл явдлын дараалал (§7.2)', () => {
  for (const [id, steps] of Object.entries(STEPS) as [ScenarioId, number][]) {
    it(id, async () => {
      const { runtime, events } = await runScenario(id, steps);
      const def = scenarioDefinitions[id];
      const keys = raisedKeys(runtime.getSnapshot());
      for (const key of def.expected.alerts) expect(keys, key).toContain(key);
      const types = events.map((event) => event.type);
      expect(isSubsequence(types, def.expected.events), types.join(' ')).toBe(true);
      runtime.stop();
    });
  }

  it('S1: дохиогүй, төхөөрөмж суурьт, дуусна', async () => {
    const { runtime, events } = await runScenario('normal-operation', 20);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.alerts.active).toHaveLength(0);
    expect(events.filter((event) => event.type === 'DEVICE_STATE_CHANGED')).toHaveLength(0);
    expect(events.at(-1)?.type).toBe('SCENARIO_COMPLETED');
    expect(snapshot.simulation.activeScenario).toBeNull();
    runtime.stop();
  });

  it('S2: F12 ноцтой, SF «Хамгийн их», үнэгүй хөргөлтөөр OAD «Бүрэн нээлттэй»; бусад давхар хэвийн', async () => {
    const { runtime } = await runScenario('elevated-temperature', 120);
    const snapshot = runtime.getSnapshot();
    const alert = snapshot.alerts.active.find((a) => a.key === 'threshold:temperature-high:F12');
    expect(alert?.severity).toBe('critical');
    expect(snapshot.devices['F12-SF']!.state).toEqual({ kind: 'supply_fan', level: 'BOOST' });
    expect(snapshot.devices['F12-OAD']!.state).toEqual({
      kind: 'outdoor_air_damper',
      position: 'OPEN',
    });
    expect(snapshot.control.freeCoolingFloors).toContain('F12');
    expect(snapshot.alerts.active.map((a) => a.key)).toEqual(['threshold:temperature-high:F12']);
    runtime.stop();
  });

  it('S4: VOC ноцтой хүрч, хөнгөрч, шийдэгдэнэ; төхөөрөмж суурьт буцаж сценари дуусна', async () => {
    const { runtime, events } = await runScenario('voc-cleaning', 200);
    expect(events.some((e) => e.type === 'ALERT_ESCALATED' || e.type === 'ALERT_RAISED')).toBe(
      true,
    );
    expect(
      events.some((e) => e.type === 'DEVICE_STATE_CHANGED' && e.ruleId === 'R-IAQ-CRITICAL'),
    ).toBe(true);
    expect(runtime.getSnapshot().alerts.active).toHaveLength(0);
    expect(runtime.getSnapshot().simulation.activeScenario).toBeNull();
    runtime.stop();
  });

  it('S7: салсан мэдрэгч «Өгөгдөлгүй» (null, 0 биш), буруу утга invalid, F04 нөөц горимд SF «Дунд»', async () => {
    const { runtime } = await runScenario('sensor-disconnection', 40);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.readings['F04-A-co2']).toMatchObject({ value: null, status: 'offline' });
    expect(snapshot.readings['F04-A-co2']!.lastValidValue).not.toBeNull();
    expect(snapshot.readings['F04-A-humidity']!.status).toBe('invalid');
    expect(snapshot.control.fallbackFloors).toEqual(['F04']);
    expect(snapshot.devices['F04-SF']!.state).toEqual({ kind: 'supply_fan', level: 'MEDIUM' });
    runtime.stop();
  });
});

describe('S8 Сэргэлт (§7.2)', () => {
  it('S7-ийн дараа: мэдрэгч дахин холбогдож, нөөц горим ба дохио шийдэгдэж, бүгд хэвийн болоход дуусна', async () => {
    const { runtime } = await runScenario('sensor-disconnection', 60);
    const seq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'scenario/start', scenarioId: 'recovery' })).toEqual({
      ok: true,
    });
    runtime.advance(200);
    const types = eventsAfter(runtime, seq).map((e) => e.type);
    expect(
      isSubsequence(types, [
        'SCENARIO_STARTED',
        'SENSOR_RECONNECTED',
        'ALERT_RESOLVED',
        'CONTROL_FALLBACK_CLEARED',
        'SCENARIO_COMPLETED',
      ]),
      types.join(' '),
    ).toBe(true);
    // Сэргэлт шинэчлэлгүй — SCENARIO_STARTED-ийн өмнө DEVICE_STATE_CHANGED (шинэчлэл) байхгүй
    expect(types[0]).toBe('SCENARIO_STARTED');
    const snapshot = runtime.getSnapshot();
    expect(snapshot.alerts.active).toHaveLength(0);
    expect(snapshot.simulation.activeScenario).toBeNull();
    runtime.stop();
  });

  it('S2-ийн дараа: дохио гарах босгоор хөнгөрч шийдэгдэж, төхөөрөмж нэг нэг түвшингээр суурьт буцна', async () => {
    const { runtime } = await runScenario('elevated-temperature', 100);
    const seq = lastSeq(runtime);
    await runtime.dispatch({ type: 'scenario/start', scenarioId: 'recovery' });
    runtime.advance(300);
    const events = eventsAfter(runtime, seq);
    const types = events.map((e) => e.type);
    expect(
      isSubsequence(types, ['ALERT_DEESCALATED', 'ALERT_RESOLVED', 'SCENARIO_COMPLETED']),
    ).toBe(true);
    const sf = events.filter((e) => e.type === 'DEVICE_STATE_CHANGED' && e.deviceId === 'F12-SF');
    expect(sf.map((e) => (e.newState?.kind === 'supply_fan' ? e.newState.level : null))).toEqual([
      'HIGH',
      'MEDIUM',
      'LOW',
    ]);
    runtime.stop();
  });

  it('яаралтай байдал идэвхтэй үед Сэргэлт тайлбартай татгалзагдана', async () => {
    const { runtime } = await runScenario('fire-emergency', 5);
    expect(await runtime.dispatch({ type: 'scenario/start', scenarioId: 'recovery' })).toEqual({
      ok: false,
      reason: mn.scenarios.recoveryBlockedByEmergency,
    });
    runtime.stop();
  });
});

describe('яаралтай байдал (§6.9, §9.5)', () => {
  it('EMERGENCY_STARTED, R-EMERGENCY-ийн өөрчлөлт ба emergency дохио НЭГ алхамд; гар удирдлага татгалзана', async () => {
    const { runtime, events } = await runScenario('fire-emergency', 1);
    const started = events.find((e) => e.type === 'EMERGENCY_STARTED')!;
    const alert = events.find((e) => e.type === 'ALERT_RAISED')!;
    const firstDevice = events.findIndex(
      (e) => e.ruleId === 'R-EMERGENCY' && e.type === 'DEVICE_STATE_CHANGED',
    );
    expect(alert.timestamp).toBe(started.timestamp);
    expect(events.indexOf(started)).toBeLessThan(firstDevice);
    expect(firstDevice).toBeLessThan(events.indexOf(alert));
    const snapshot = runtime.getSnapshot();
    expect(snapshot.devices['F08-EF']!.state).toEqual({ kind: 'exhaust_fan', level: 'BOOST' });
    expect(snapshot.devices['F07-SF']!.state).toEqual({ kind: 'supply_fan', level: 'HIGH' });
    expect(snapshot.devices['F01-SF']!.state).toEqual({ kind: 'supply_fan', level: 'OFF' });
    expect(
      await runtime.dispatch({
        type: 'device/setManual',
        deviceId: 'F03-SF',
        state: { kind: 'supply_fan', level: 'HIGH' },
      }),
    ).toEqual({ ok: false, reason: mn.control.manualBlockedByEmergency });
    const emergencyAlert = snapshot.alerts.active.find((a) => a.type === 'emergency')!;
    expect(
      await runtime.dispatch({ type: 'alert/acknowledge', alertId: emergencyAlert.id }),
    ).toEqual({
      ok: false,
      reason: mn.scenarios.emergencyAlertCannotAck,
    });
    runtime.stop();
  });

  it('§7.4 A: EMERGENCY_ENDED → ALERT_RESOLVED → SCENARIO_STOPPED, ижил simTime; дараа нь давхар шийдэлт үгүй', async () => {
    const { runtime } = await runScenario('fire-emergency', 10);
    const alertId = runtime.getSnapshot().alerts.active.find((a) => a.type === 'emergency')!.id;
    const before = runtime.getSnapshot().simTime;
    const seq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'emergency/end' })).toEqual({ ok: true });
    const events = eventsAfter(runtime, seq);
    expect(events.map((e) => e.type)).toEqual([
      'EMERGENCY_ENDED',
      'ALERT_RESOLVED',
      'SCENARIO_STOPPED',
    ]);
    expect(events.every((e) => e.timestamp === before)).toBe(true);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.control.emergency).toBeNull();
    expect(snapshot.alerts.active.some((a) => a.type === 'emergency')).toBe(false);
    expect(snapshot.simulation.activeScenario).toBeNull();
    // Төхөөрөмж яаралтай төлөвтөө — дараагийн алхамд ердийн удирдлага
    expect(snapshot.devices['F08-EF']!.state).toEqual({ kind: 'exhaust_fan', level: 'BOOST' });
    runtime.advance(30);
    const resolvedForAlert = runtime
      .getSnapshot()
      .events.filter((e) => e.type === 'ALERT_RESOLVED' && e.alertId === alertId);
    expect(resolvedForAlert).toHaveLength(1);
    expect(runtime.getSnapshot().devices['F01-SF']!.state).toEqual({
      kind: 'supply_fan',
      level: 'LOW',
    });
    runtime.stop();
  });

  it('§7.4 B: яаралтай үед өөр сценари — SCENARIO_STOPPED → EMERGENCY_ENDED → ALERT_RESOLVED → … → SCENARIO_STARTED', async () => {
    const { runtime } = await runScenario('fire-emergency', 10);
    const alertId = runtime.getSnapshot().alerts.active.find((a) => a.type === 'emergency')!.id;
    const seq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'scenario/start', scenarioId: 'high-co2' })).toEqual({
      ok: true,
    });
    const events = eventsAfter(runtime, seq);
    const types = events.map((e) => e.type);
    expect(types.slice(0, 3)).toEqual(['SCENARIO_STOPPED', 'EMERGENCY_ENDED', 'ALERT_RESOLVED']);
    expect(types.at(-1)).toBe('SCENARIO_STARTED');
    expect(events.filter((e) => e.alertId === alertId)).toHaveLength(1);
    const snapshot = runtime.getSnapshot();
    expect(snapshot.alerts.active).toHaveLength(0);
    expect(snapshot.control.emergency).toBeNull();
    expect(snapshot.devices['F08-EF']!.state).toEqual({ kind: 'exhaust_fan', level: 'LOW' });
    expect(snapshot.simulation.activeScenario?.id).toBe('high-co2');
    runtime.stop();
  });
});

describe('§7.4 C — зөөлөн шинэчлэл', () => {
  it('дараалал, simTime буцахгүй, түүх хадгалагдана, матрицын төлөв суурьт', async () => {
    const { runtime } = await runScenario('poor-outdoor-air', 30);
    await runtime.dispatch({
      type: 'device/setManual',
      deviceId: 'F05-SF',
      state: { kind: 'supply_fan', level: 'HIGH' },
    });
    await runtime.dispatch({ type: 'control/setAutoMode', enabled: false });
    const before = runtime.getSnapshot();
    const seq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'scenario/start', scenarioId: 'high-co2' })).toEqual({
      ok: true,
    });
    const events = eventsAfter(runtime, seq);
    expect(events.map((e) => e.type)).toEqual([
      'SCENARIO_STOPPED',
      'MANUAL_OVERRIDE_CLEARED',
      'AUTO_MODE_ENABLED',
      'DEVICE_STATE_CHANGED',
      'ALERT_RESOLVED',
      'CONTROL_CONSTRAINT_CLEARED',
      'SCENARIO_STARTED',
    ]);
    expect(events.every((e) => e.timestamp === before.simTime)).toBe(true);
    const after = runtime.getSnapshot();
    expect(after.simTime).toBe(before.simTime);
    // Үйл явдал ба хандлагын түүх хадгалагдана (нэмэгдэнэ)
    expect(after.events.slice(0, before.events.length)).toEqual(before.events);
    expect(after.history).toBe(before.history);
    expect(after.alerts.active).toHaveLength(0);
    expect(after.alerts.recentResolved.length).toBeGreaterThan(before.alerts.recentResolved.length);
    expect(after.control).toEqual({
      autoMode: true,
      outdoorAirRestricted: false,
      pmDilutionAllowed: true,
      fallbackFloors: [],
      freeCoolingFloors: [],
      emergency: null,
    });
    expect(after.decisions).toEqual({});
    for (const device of Object.values(after.devices)) {
      expect(device).toMatchObject({
        mode: 'auto',
        manualOverride: null,
        lastChangedAt: after.simTime,
        lastChangeReason: mn.scenarios.resetReason,
        lastRuleId: null,
      });
    }
    for (const reading of Object.values(after.readings)) {
      expect(reading).toMatchObject({
        connection: 'online',
        status: 'normal',
        timestamp: after.simTime,
        lastValidAt: after.simTime,
      });
    }
    runtime.stop();
  });
});

describe('§7.4 D — хатуу шинэчлэл', () => {
  it('зөвхөн SIMULATION_RESET, эхлэх цаг, түүх хоосон, seq өссөөр, ALERT_RESOLVED байхгүй', async () => {
    const { runtime } = await runScenario('fire-emergency', 10);
    await runtime.dispatch({ type: 'simulation/setSpeed', speed: 5 });
    const maxSeq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'simulation/reset' })).toEqual({ ok: true });
    const snapshot = runtime.getSnapshot();
    expect(snapshot.simTime).toBe(simulationConfig.startTime);
    expect(snapshot.events.map((e) => e.type)).toEqual(['SIMULATION_RESET']);
    expect(snapshot.events[0]!.seq).toBeGreaterThan(maxSeq);
    expect(snapshot.events[0]!.message).toBe(
      mn.scenarios.simulationReset(scenarioDefinitions['fire-emergency'].name, true),
    );
    expect(snapshot.alerts).toEqual({ active: [], recentResolved: [] });
    expect(snapshot.control.emergency).toBeNull();
    expect(snapshot.simulation).toMatchObject({ speed: 1, running: false, activeScenario: null });
    expect(Object.values(snapshot.history.F01!).every((series) => series.length === 0)).toBe(true);
    for (const device of Object.values(snapshot.devices)) {
      expect(device.manualOverride).toBeNull();
      expect(device.lastChangedAt).toBe(simulationConfig.startTime);
    }
    // Шинэчлэлийн дараах алхмуудад emergency дохио дахин гарахгүй, давхар шийдэлт байхгүй
    runtime.advance(10);
    const types = runtime.getSnapshot().events.map((e) => e.type);
    expect(types).not.toContain('ALERT_RESOLVED');
    expect(types).not.toContain('ALERT_RAISED');
    runtime.stop();
  });
});

describe('deterministic replay (§7.4)', () => {
  /** Харьцуулахаас хасах талбар: simTime ба хугацааны тэмдэг (харьцангуйгаар), seq, ID, хурд, түүх */
  function comparable(runtime: LocalSimulationRuntime) {
    const s = runtime.getSnapshot();
    const start = s.simulation.activeScenario?.startedAt ?? 0;
    return {
      progress: [s.simulation.activeScenario?.id, s.simulation.activeScenario?.progress],
      relTime: s.simTime - start,
      readings: Object.fromEntries(
        Object.entries(s.readings).map(([id, r]) => [
          id,
          [r.value, r.status, r.levels, r.condition, r.connection, r.explanation, r.lastValidValue],
        ]),
      ),
      devices: Object.fromEntries(
        Object.entries(s.devices).map(([id, d]) => [
          id,
          [d.state, d.mode, d.lastChangeReason, d.lastRuleId, d.lastChangedAt - start],
        ]),
      ),
      decisions: Object.fromEntries(
        Object.entries(s.decisions).map(([id, d]) => [id, [d.outcome, d.winningRuleId, d.reason]]),
      ),
      control: s.control,
      alerts: s.alerts.active.map((a) => [
        a.key,
        a.severity,
        a.status,
        a.message,
        a.raisedAt - start,
      ]),
      events: s.events
        .filter((e) => e.timestamp > start)
        .map((e) => [e.type, e.message, e.timestamp - start]),
    };
  }

  it('«хатуу шинэчлэл → S3» ба «S5 → S3» нь заасан талбараас бусдаар ижил', async () => {
    const a = await paused();
    await a.dispatch({ type: 'simulation/reset' });
    await a.dispatch({ type: 'scenario/start', scenarioId: 'high-co2' });
    a.advance(150);

    const b = await paused();
    await b.dispatch({ type: 'scenario/start', scenarioId: 'poor-outdoor-air' });
    b.advance(60);
    await b.dispatch({ type: 'scenario/start', scenarioId: 'high-co2' });
    b.advance(150);

    const ca = comparable(a);
    const cb = comparable(b);
    for (const key of Object.keys(ca) as (keyof typeof ca)[]) expect(cb[key], key).toEqual(ca[key]);
    a.stop();
    b.stop();
  });
});

describe('бусад гэрээ', () => {
  it('нийцэхгүй тохиргоонд сценари тайлбартай татгалзаж, юу ч өөрчлөхгүй (§5.1)', async () => {
    const runtime = await paused({ config: createBuildingConfig(6) });
    const before = runtime.getSnapshot();
    const result = await runtime.dispatch({ type: 'scenario/start', scenarioId: 'fire-emergency' });
    expect(result.ok).toBe(false);
    expect(runtime.getSnapshot()).toBe(before);
    runtime.stop();
  });

  it('simTime зөвхөн хатуу шинэчлэлд буурна', async () => {
    const runtime = await paused();
    const times: number[] = [];
    const record = () => times.push(runtime.getSnapshot().simTime);
    await runtime.dispatch({ type: 'scenario/start', scenarioId: 'fire-emergency' });
    record();
    runtime.advance(5);
    record();
    await runtime.dispatch({ type: 'emergency/end' });
    record();
    await runtime.dispatch({ type: 'scenario/start', scenarioId: 'voc-cleaning' });
    record();
    runtime.advance(5);
    record();
    await runtime.dispatch({ type: 'scenario/stop' });
    record();
    expect(times).toEqual([...times].sort((x, y) => x - y));
    runtime.stop();
  });

  it('дохиог хүлээн авах: active → acknowledged, ALERT_ACKNOWLEDGED; давтан бол татгалзана', async () => {
    const { runtime } = await runScenario('sensor-disconnection', 30);
    const alert = runtime.getSnapshot().alerts.active.find((a) => a.type === 'sensor_offline')!;
    const seq = lastSeq(runtime);
    expect(await runtime.dispatch({ type: 'alert/acknowledge', alertId: alert.id })).toEqual({
      ok: true,
    });
    const acknowledged = runtime.getSnapshot().alerts.active.find((a) => a.id === alert.id)!;
    expect(acknowledged.status).toBe('acknowledged');
    expect(acknowledged.acknowledgedAt).toBe(runtime.getSnapshot().simTime);
    expect(eventsAfter(runtime, seq).map((e) => [e.type, e.alertId])).toEqual([
      ['ALERT_ACKNOWLEDGED', alert.id],
    ]);
    expect(await runtime.dispatch({ type: 'alert/acknowledge', alertId: alert.id })).toEqual({
      ok: false,
      reason: mn.scenarios.alertNotActive,
    });
    runtime.stop();
  });

  it('activeScenario: явц өсөж, дуусахад null; scenario/stop нөхцөлийг хэвээр үлдээнэ', async () => {
    const { runtime } = await runScenario('sensor-disconnection', 30);
    expect(runtime.getSnapshot().simulation.activeScenario).toMatchObject({
      id: 'sensor-disconnection',
      progress: 0.5,
    });
    const seq = lastSeq(runtime);
    await runtime.dispatch({ type: 'scenario/stop' });
    expect(eventsAfter(runtime, seq).map((e) => e.type)).toEqual(['SCENARIO_STOPPED']);
    expect(runtime.getSnapshot().simulation.activeScenario).toBeNull();
    runtime.advance(5);
    // Нөхцөл хэвээр: мэдрэгч салсан хэвээр
    expect(runtime.getSnapshot().readings['F04-A-co2']!.status).toBe('offline');
    runtime.stop();
  });
});
