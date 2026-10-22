// Дохионы амьдралын мөчлөг (§4.4, §6.6, D72). Нийлэг нөхцлөөр — debounce, хүндрэх, хөнгөрөх, шийдэгдэх, дахин үүсэх.
import { describe, expect, it } from 'vitest';

import { timingThresholds } from '@/domain/config/thresholds';

import {
  createAlertEvaluatorState,
  evaluateAlerts,
  type AlertCondition,
  type AlertEvaluatorState,
  type ConditionLevel,
} from './evaluator';

const N = timingThresholds.alertDebounceSteps;
const T0 = 1_000_000;

const condition = (level: ConditionLevel | null, value: number | null = 1100): AlertCondition => ({
  key: 'threshold:co2:F02',
  type: 'threshold',
  scope: { floorId: 'F02', metric: 'co2', condition: 'co2' },
  level,
  title: 'CO₂ өндөр — 2-р давхар',
  message: `CO₂ ${value} ppm`,
  value,
  peak: 'max',
});

/** Түвшний дарааллаар алхам бүрийг үнэлж, шилжилтийн жагсаалтыг буцаана */
function runLevels(levels: (ConditionLevel | null)[], start = createAlertEvaluatorState()) {
  let state: AlertEvaluatorState = start;
  const log: string[] = [];
  levels.forEach((level, i) => {
    const result = evaluateAlerts(state, [condition(level, 1000 + i)], T0 + i * 1000);
    state = result.state;
    for (const t of result.transitions)
      log.push(`${i}:${t.kind}:${t.alert.severity}:${t.alert.id}`);
  });
  return { state, log };
}

describe('үүсэх (§4.4)', () => {
  it(`анхааруулга дараалсан ${N} алхмын дараа л үүснэ (өмнө нь биш)`, () => {
    expect(runLevels(Array(N - 1).fill('warning')).log).toEqual([]);
    const { state, log } = runLevels(Array(N).fill('warning'));
    expect(log).toEqual([`${N - 1}:raised:warning:A-0001`]);
    expect(state.active[0]).toMatchObject({ status: 'active', raisedAt: T0 + (N - 1) * 1000 });
  });

  it('тасалдвал debounce шинээр эхэлнэ', () => {
    expect(runLevels(['warning', 'warning', 'normal', 'warning', 'warning']).log).toEqual([]);
  });

  it(`ноцтой нь ${N} алхам үргэлжилсэн бол шууд ноцтой болж үүснэ`, () => {
    expect(runLevels(Array(N).fill('critical')).log).toEqual([`${N - 1}:raised:critical:A-0001`]);
  });
});

describe('хүндрэх, хөнгөрөх, шийдэгдэх, дахин үүсэх (§4.4)', () => {
  it(`warning → critical нь дараалсан ${N} алхмын дараа; тэр хооронд анхааруулга хэвээр`, () => {
    const { log } = runLevels([
      ...Array(N).fill('warning'),
      'critical',
      'critical',
      'warning', // тасалдал → тоолуур дахин
      ...Array(N).fill('critical'),
    ]);
    expect(log).toEqual([
      `${N - 1}:raised:warning:A-0001`,
      `${N + 2 + N}:escalated:critical:A-0001`,
    ]);
  });

  it('critical → warning тэр даруй (debounce-гүй); normal болмогц шийдэгдэнэ', () => {
    const { state, log } = runLevels([...Array(N).fill('critical'), 'warning', 'normal']);
    expect(log).toEqual([
      `${N - 1}:raised:critical:A-0001`,
      `${N}:deescalated:warning:A-0001`,
      `${N + 1}:resolved:warning:A-0001`,
    ]);
    expect(state.active).toEqual([]);
    expect(state.recentResolved[0]).toMatchObject({
      status: 'resolved',
      resolvedAt: T0 + (N + 1) * 1000,
    });
  });

  it('шийдэгдсэний дараа дахин үүсэхэд debounce-оос эхэлж, шинэ AlertId', () => {
    const { log } = runLevels([...Array(N).fill('warning'), 'normal', ...Array(N).fill('warning')]);
    expect(log).toEqual([
      `${N - 1}:raised:warning:A-0001`,
      `${N}:resolved:warning:A-0001`,
      `${2 * N}:raised:warning:A-0002`,
    ]);
  });

  it('хүлээн авсан дохио хүндрэхэд active руу буцна (acknowledgedAt: null)', () => {
    const raised = runLevels(Array(N).fill('warning')).state;
    const acknowledged: AlertEvaluatorState = {
      ...raised,
      active: raised.active.map((a) => ({ ...a, status: 'acknowledged', acknowledgedAt: T0 })),
    };
    const { state } = runLevels(Array(N).fill('critical'), acknowledged);
    expect(state.active[0]).toMatchObject({
      severity: 'critical',
      status: 'active',
      acknowledgedAt: null,
    });
  });
});

describe('өгөгдөлгүй нөхцөл (level: null)', () => {
  it('идэвхтэй дохиог хадгална (шийдэгдсэн гэж үзэхгүй), шинээр үүсгэхгүй, debounce-ийг дахин эхлүүлнэ', () => {
    const { state, log } = runLevels([...Array(N).fill('warning'), null, null]);
    expect(log).toEqual([`${N - 1}:raised:warning:A-0001`]);
    expect(state.active).toHaveLength(1);
    expect(runLevels(['warning', 'warning', null, 'warning']).log).toEqual([]);
  });
});

describe('оргил утга, хязгаар, structural sharing', () => {
  it('peakValue нь хамгийн их утгыг хадгална', () => {
    const { state } = runLevels([...Array(N).fill('warning'), 'warning', 'warning']);
    expect(state.active[0]!.peakValue).toBe(1000 + N + 1);
  });

  it('өөрчлөлтгүй алхамд массивын лавлагаа хэвээр', () => {
    const start = createAlertEvaluatorState();
    const { state } = evaluateAlerts(start, [condition('normal')], T0);
    expect(state.active).toBe(start.active);
    expect(state.recentResolved).toBe(start.recentResolved);
  });

  it('recentResolved хязгаартай — хамгийн хуучныг хаяна', () => {
    let state = createAlertEvaluatorState();
    for (let cycle = 0; cycle < 5; cycle += 1) {
      for (const level of [...Array(N).fill('warning'), 'normal'] as ConditionLevel[]) {
        state = evaluateAlerts(state, [condition(level)], T0, { recentResolvedLimit: 3 }).state;
      }
    }
    expect(state.recentResolved.map((a) => a.id)).toEqual(['A-0003', 'A-0004', 'A-0005']);
  });
});
