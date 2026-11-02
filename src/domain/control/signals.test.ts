import { describe, expect, it } from 'vitest';

import { createAlertEvaluatorState, evaluateAlerts } from '@/domain/alerts/evaluator';
import { createBuildingConfig } from '@/domain/config/building';
import type { ControlState } from '@/domain/types';

import { controlSignalConditions } from './signals';

const config = createBuildingConfig(12);
const base: ControlState = {
  autoMode: true,
  outdoorAirRestricted: false,
  pmDilutionAllowed: true,
  fallbackFloors: [],
  freeCoolingFloors: [],
  emergency: null,
};
const evaluate6b = (
  state: ReturnType<typeof createAlertEvaluatorState>,
  control: ControlState,
  now: number,
) => evaluateAlerts(state, controlSignalConditions(config, control), now, { debounceSteps: 1 });

describe('6b — удирдлагын төлөвийн дохио (§9.5, §6.6)', () => {
  it('outdoor_air_restricted ба control_degraded эх төлөв идэвхжсэн алхамд шууд (debounce-гүй) үүсч, арилмагц шийдэгдэнэ', () => {
    const restricted = { ...base, outdoorAirRestricted: true, fallbackFloors: ['F04'] };
    const a = evaluate6b(createAlertEvaluatorState(), restricted, 1);
    expect(a.transitions.map((t) => [t.kind, t.alert.key])).toEqual([
      ['raised', 'control_degraded:F04'],
      ['raised', 'outdoor_air_restricted:aeris-tower'],
    ]);
    // Idempotent: ижил төлөвт үйл явдалгүй
    const b = evaluate6b(a.state, restricted, 2);
    expect(b.transitions).toEqual([]);
    const c = evaluate6b(b.state, base, 3);
    expect(c.transitions.map((t) => t.kind)).toEqual(['resolved', 'resolved']);
  });

  it('emergency дохиог зөвхөн үүсгэнэ: яаралтай байдал null болсон ч 6b шийдэхгүй (§9.5-ын эзэмшил)', () => {
    const active = { ...base, emergency: { fireFloorId: 'F08', startedAt: 0 } };
    const a = evaluate6b(createAlertEvaluatorState(), active, 1);
    expect(a.transitions).toHaveLength(1);
    expect(a.transitions[0]!.alert).toMatchObject({
      key: 'emergency:aeris-tower',
      severity: 'critical',
    });
    const b = evaluate6b(a.state, active, 2);
    expect(b.transitions).toEqual([]);
    const c = evaluate6b(b.state, base, 3);
    expect(c.transitions).toEqual([]);
    expect(c.state.active.map((x) => x.key)).toEqual(['emergency:aeris-tower']);
  });

  it('5-р үе шатны debounce тоолуурыг устгахгүй (хоёр дуудлага нэг төлөвийг хуваалцана)', () => {
    const threshold = {
      key: 'threshold:co2:F02',
      type: 'threshold' as const,
      scope: { floorId: 'F02' },
      level: 'warning' as const,
      title: 't',
      message: 'm',
      value: 1100,
      peak: 'max' as const,
    };
    let state = createAlertEvaluatorState();
    for (let i = 1; i <= 3; i += 1) {
      state = evaluateAlerts(state, [threshold], i).state;
      if (i < 3) state = evaluate6b(state, base, i).state;
    }
    expect(state.active.map((a) => a.key)).toEqual(['threshold:co2:F02']);
  });
});
