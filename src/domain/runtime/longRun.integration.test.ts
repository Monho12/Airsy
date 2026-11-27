// Урт ажиллагааны санах ойн шалгалт (CLAUDE.md §11.4, §11.5, §13 Phase 7c). Бүх сценарийг дараалан олон удаа
// ажиллуулж, хязгаартай buffer-ууд (үйл явдал, шийдэгдсэн дохио, хандлага, шийдвэр) хэзээ ч хязгаараасаа хэтрэхгүйг,
// идэвхтэй дохионы тоо төгсгөлд суурь руу буцахыг шалгана. Дэлгэцгүй — timer-гүйгээр `advance`-аар.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { bufferLimits } from '@/domain/config/simulation';
import type { LiveSnapshot, ScenarioId } from '@/domain/types';

import { LocalSimulationRuntime } from './LocalSimulationRuntime';

afterEach(() => {
  vi.useRealTimers();
});

/** Сценари бүрийн дараа ажиллуулах алхам (симуляцийн секунд) */
const STEPS_PER_SCENARIO = 150;
const ROUNDS = 3;
const SEQUENCE: readonly ScenarioId[] = [
  'elevated-temperature',
  'high-co2',
  'voc-cleaning',
  'poor-outdoor-air',
  'fire-emergency',
  'sensor-disconnection',
  'recovery',
];

/** Snapshot-ийн хязгаартай хэсгүүд хязгаараасаа хэтрээгүй эсэх */
function expectBounded(snapshot: LiveSnapshot) {
  expect(snapshot.events.length).toBeLessThanOrEqual(bufferLimits.events);
  expect(snapshot.alerts.recentResolved.length).toBeLessThanOrEqual(
    bufferLimits.recentResolvedAlerts,
  );
  for (const series of Object.values(snapshot.history)) {
    for (const points of Object.values(series)) {
      expect(points.length).toBeLessThanOrEqual(bufferLimits.trendPointsPerSeries);
    }
  }
  // Шийдвэрийн мөр төхөөрөмж бүрт зөвхөн сүүлийнх (§11.4)
  expect(Object.keys(snapshot.decisions).length).toBeLessThanOrEqual(
    Object.keys(snapshot.devices).length,
  );
  // Үйл явдлын `seq` өссөөр (ring buffer хуучныг хаясан ч дараалал эвдрэхгүй)
  const seqs = snapshot.events.map((e) => e.seq);
  expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
}

describe('урт ажиллагаа (§11.4)', () => {
  it(`${ROUNDS} удаа бүх сценари (${ROUNDS * SEQUENCE.length * STEPS_PER_SCENARIO} алхам): buffer-ууд хязгаартай`, async () => {
    const runtime = new LocalSimulationRuntime();
    runtime.start();
    let maxActiveAlerts = 0;
    let lastSeq = 0;
    for (let round = 0; round < ROUNDS; round += 1) {
      for (const scenarioId of SEQUENCE) {
        if (scenarioId === 'recovery' && runtime.getSnapshot().control.emergency !== null) {
          // Сэргэлтийн өмнө яаралтай байдлыг дуусгана (§7.2 S8)
          expect(await runtime.dispatch({ type: 'emergency/end' })).toEqual({ ok: true });
        }
        expect(await runtime.dispatch({ type: 'scenario/start', scenarioId })).toEqual({
          ok: true,
        });
        runtime.advance(STEPS_PER_SCENARIO);
        const snapshot = runtime.getSnapshot();
        expectBounded(snapshot);
        maxActiveAlerts = Math.max(maxActiveAlerts, snapshot.alerts.active.length);
        const seq = snapshot.events.at(-1)?.seq ?? lastSeq;
        expect(seq).toBeGreaterThanOrEqual(lastSeq);
        lastSeq = seq;
      }
    }
    // Идэвхтэй дохио түлхүүр бүрт нэг тул бүсийн тоогоор хязгаартай байх ёстой (давхардал хуримтлагдахгүй)
    const areaCount = Object.keys(buildingConfig.areas).length;
    expect(maxActiveAlerts).toBeLessThan(areaCount * 5);
    // Үйл явдлын ring buffer дүүрсэн — хязгаарын зам бодитоор шалгагдсан
    expect(runtime.getSnapshot().events.length).toBe(bufferLimits.events);

    // Хатуу шинэчлэлийн дараа бүгд хоосорч, суурь руу буцна (§7.4 D)
    await runtime.dispatch({ type: 'simulation/reset' });
    const reset = runtime.getSnapshot();
    expect(reset.alerts).toEqual({ active: [], recentResolved: [] });
    expect(reset.events.map((e) => e.type)).toEqual(['SIMULATION_RESET']);
    runtime.stop();
  }, 120_000);
});
