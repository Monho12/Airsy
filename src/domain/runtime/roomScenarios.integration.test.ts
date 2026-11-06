// Өрөөний сценари (С7, D93) — дэлгэцгүй интеграцийн тест: загвар бүр тохирох өрөөнд хүлээгдэх дохио ба үйл явдлыг
// гаргаж, эх үүсвэр зогссоны дараа «бүгд хэвийн» болоод дуусна; техникийн өрөөний сценари давхрын сэнсийг өөрчлөхгүй.
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';
import { createRoomScenario } from '@/domain/scenarios/rooms';
import type { LiveSnapshot, RoomScenarioId, SystemEvent } from '@/domain/types';

import { LocalSimulationRuntime } from './LocalSimulationRuntime';

async function paused() {
  const runtime = new LocalSimulationRuntime();
  runtime.start();
  await runtime.dispatch({ type: 'simulation/pause' });
  runtime.advance(3);
  return runtime;
}

const lastSeq = (runtime: LocalSimulationRuntime) => runtime.getSnapshot().events.at(-1)?.seq ?? 0;

function isSubsequence(actual: readonly string[], expected: readonly string[]): boolean {
  let i = 0;
  for (const item of actual) if (item === expected[i]) i += 1;
  return i === expected.length;
}

const raisedKeys = (snapshot: LiveSnapshot) =>
  new Set([...snapshot.alerts.active, ...snapshot.alerts.recentResolved].map((alert) => alert.key));

/** Сценарийг эхлүүлж, дуустал (дээд тал нь `maxSteps`) урагшлуулна */
async function runRoom(id: RoomScenarioId, areaId: string, maxSteps = 1200) {
  const runtime = await paused();
  const seq = lastSeq(runtime);
  expect(await runtime.dispatch({ type: 'scenario/startRoom', scenarioId: id, areaId })).toEqual({
    ok: true,
  });
  const start = runtime.getSnapshot().simulation.activeScenario;
  let floorDevicesChanged = false;
  const floorId = buildingConfig.areas[areaId]!.floorId;
  let steps = 0;
  while (steps < maxSteps && runtime.getSnapshot().simulation.activeScenario !== null) {
    runtime.advance(10);
    steps += 10;
    const devices = Object.values(runtime.getSnapshot().devices).filter(
      (device) => device.floorId === floorId,
    );
    if (
      devices.some((device) => device.lastRuleId !== null && device.lastRuleId !== 'R-BASELINE')
    ) {
      floorDevicesChanged = true;
    }
  }
  const events: SystemEvent[] = runtime.getSnapshot().events.filter((event) => event.seq > seq);
  return { runtime, events, start, steps, floorDevicesChanged };
}

const CASES: [RoomScenarioId, string][] = [
  ['room-meeting', 'F07-C'],
  ['room-server-overheat', 'F03-F'],
  ['room-kitchen-cooking', 'F07-H'],
  ['room-restroom-humidity', 'F07-G'],
  ['room-sensor-disconnect', 'F07-C'],
  ['room-sensor-disconnect', 'F07-H'],
];

describe('өрөөний сценари — хүлээгдэх дохио, үйл явдал, дуусалт (С7, D93)', () => {
  for (const [id, areaId] of CASES) {
    it(`${id} @ ${areaId}`, { timeout: 30_000 }, async () => {
      const def = createRoomScenario(id, areaId, buildingConfig)!;
      const { runtime, events, start, steps } = await runRoom(id, areaId);
      expect(start).toMatchObject({ id, targetAreaId: areaId });
      const keys = raisedKeys(runtime.getSnapshot());
      for (const key of def.expected.alerts) expect(keys, key).toContain(key);
      const types = events.map((event) => event.type);
      expect(isSubsequence(types, def.expected.events), types.join(',')).toBe(true);
      // Дууссан: идэвхтэй сценари алга, дохио шийдэгдсэн
      expect(runtime.getSnapshot().simulation.activeScenario).toBeNull();
      expect(runtime.getSnapshot().alerts.active).toEqual([]);
      expect(steps).toBeLessThan(1200);
      expect(events.find((e) => e.type === 'SCENARIO_STARTED')!.message).toBe(
        mn.scenarios.started(def.name),
      );
    });
  }

  it('техникийн өрөөний сценари (сервер, гал тогоо) давхрын сэнсийг өөрчлөхгүй; хурлын өрөөнийх өөрчилнө', async () => {
    expect((await runRoom('room-server-overheat', 'F03-F')).floorDevicesChanged).toBe(false);
    expect((await runRoom('room-kitchen-cooking', 'F07-H')).floorDevicesChanged).toBe(false);
    expect((await runRoom('room-meeting', 'F07-C')).floorDevicesChanged).toBe(true);
  }, 60_000);

  it('эх үүсвэр t = 0-д эхэлсэн ч дохио гарахаас өмнө шууд дуусахгүй (minMs)', async () => {
    const runtime = await paused();
    await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: 'room-kitchen-cooking',
      areaId: 'F07-H',
    });
    runtime.advance(5);
    expect(runtime.getSnapshot().simulation.activeScenario).toMatchObject({
      id: 'room-kitchen-cooking',
    });
  });
});

describe('scenario/startRoom — татгалзал ба шинэчлэл', () => {
  it('нээлттэй оффис, тохирохгүй загвар, үл мэдэгдэх бүс тайлбартай татгалзаж, юу ч өөрчлөхгүй', async () => {
    const runtime = await paused();
    const before = runtime.getSnapshot();
    const office = await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: 'room-meeting',
      areaId: 'F07-A',
    });
    expect(office).toEqual({
      ok: false,
      reason: mn.scenarios.room.notApplicable(
        mn.scenarios.room.name['room-meeting'],
        buildingConfig.areas['F07-A']!.name,
      ),
    });
    const wrongKind = await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: 'room-server-overheat',
      areaId: 'F07-H',
    });
    expect(wrongKind.ok).toBe(false);
    const unknown = await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: 'room-meeting',
      areaId: 'F99-C',
    });
    expect(unknown).toEqual({ ok: false, reason: mn.scenarios.room.unknownArea('F99-C') });
    expect(runtime.getSnapshot()).toBe(before);
  });

  it('өөр сценари идэвхтэй үед зогсоож, зөөлөн шинэчилж эхэлнэ (§7.4 C)', async () => {
    const runtime = await paused();
    await runtime.dispatch({ type: 'scenario/start', scenarioId: 'high-co2' });
    runtime.advance(5);
    const seq = lastSeq(runtime);
    await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: 'room-meeting',
      areaId: 'F07-C',
    });
    const types = runtime
      .getSnapshot()
      .events.filter((event) => event.seq > seq)
      .map((event) => event.type);
    expect(types[0]).toBe('SCENARIO_STOPPED');
    expect(types.at(-1)).toBe('SCENARIO_STARTED');
  });
});
