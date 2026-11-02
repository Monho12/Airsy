import { describe, expect, it } from 'vitest';

import type { ControlRequest, DeviceState, RuleId } from '@/domain/types';

import { resolveTarget } from './resolve';
import { RULE_PRIORITY } from './rules';
import { applySafeguards } from './safeguards';

const req = (
  ruleId: RuleId,
  target: DeviceState,
  role: ControlRequest['role'] = 'demand',
): ControlRequest => ({
  ruleId,
  priority: RULE_PRIORITY[ruleId],
  deviceKind: target.kind,
  target,
  role,
  reason: ruleId,
});
const sf = (level: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BOOST'): DeviceState => ({
  kind: 'supply_fan',
  level,
});
const oad = (position: 'CLOSED' | 'MINIMUM' | 'PARTIAL' | 'OPEN'): DeviceState => ({
  kind: 'outdoor_air_damper',
  position,
});

describe('зөрчлийг шийдэх (§6.4)', () => {
  it('сэнс: эрэлтийн хамгийн өндөр түвшин (R-THERMAL BOOST + R-IAQ-WARNING HIGH → BOOST)', () => {
    const r = resolveTarget(
      [
        req('R-BASELINE', sf('LOW')),
        req('R-IAQ-WARNING', sf('HIGH')),
        req('R-THERMAL', sf('BOOST')),
      ],
      [],
      false,
    );
    expect(r.constrainedState).toEqual(sf('BOOST'));
    expect(r.winningRuleId).toBe('R-THERMAL');
  });

  it('тэнцвэл өндөр эрэмбийн дүрэм ялагч, бусад нь contributing; ижил оролт → ижил үр дүн', () => {
    const demands = [
      req('R-THERMAL', sf('HIGH')),
      req('R-IAQ-WARNING', sf('HIGH')),
      req('R-BASELINE', sf('LOW')),
    ];
    const a = resolveTarget(demands, [], false);
    const b = resolveTarget([...demands].reverse(), [], false);
    expect(a.winningRuleId).toBe('R-IAQ-WARNING');
    expect(a.contributingRuleIds).toEqual(['R-THERMAL']);
    expect(b).toEqual(a);
  });

  it('хаалт: хамгийн нээлттэй эрэлт (CO₂ PARTIAL + дулааны MINIMUM → PARTIAL), дараа нь C-OUTDOOR-AIR', () => {
    const demands = [req('R-THERMAL', oad('MINIMUM')), req('R-IAQ-WARNING', oad('PARTIAL'))];
    expect(resolveTarget(demands, [], false).constrainedState).toEqual(oad('PARTIAL'));
    const restricted = resolveTarget(demands, [], true);
    expect(restricted.requestedState).toEqual(oad('PARTIAL'));
    expect(restricted.constrainedState).toEqual(oad('MINIMUM'));
    expect(restricted.constraintApplied).toBe('C-OUTDOOR-AIR');
  });

  it('R-SENSOR-FALLBACK доод хязгаар: бууруулахгүй (BOOST хэвээр), бусад үед MEDIUM хүртэл өсгөнө', () => {
    const minimum = [req('R-SENSOR-FALLBACK', sf('MEDIUM'), 'minimum')];
    const critical = resolveTarget(
      [req('R-BASELINE', sf('LOW')), req('R-IAQ-CRITICAL', sf('BOOST'))],
      minimum,
      false,
    );
    expect(critical.constrainedState).toEqual(sf('BOOST'));
    expect(critical.minimumApplied).toBe(false);
    const quiet = resolveTarget([req('R-BASELINE', sf('LOW'))], minimum, false);
    expect(quiet.constrainedState).toEqual(sf('MEDIUM'));
    expect(quiet.minimumApplied).toBe(true);
    expect(quiet.winningRuleId).toBe('R-SENSOR-FALLBACK');
  });
});

describe('тогтвортой байдлын шүүлтүүр (§6.6)', () => {
  const HOLD = 30_000;
  it('ижил бол команд үгүй; өсөлт тэр даруй', () => {
    expect(applySafeguards(sf('LOW'), sf('LOW'), 0, 1000, HOLD)).toEqual({ kind: 'unchanged' });
    expect(applySafeguards(sf('LOW'), sf('BOOST'), 0, 1000, HOLD)).toEqual({
      kind: 'apply',
      state: sf('BOOST'),
      steppedDown: false,
    });
  });

  it('бууралт барих хугацаа хүртэл хориотой, дараа нь нэг түвшингээр (сэнс ба хаалт)', () => {
    expect(applySafeguards(sf('BOOST'), sf('LOW'), 0, HOLD - 1, HOLD)).toEqual({
      kind: 'held_by_dwell',
    });
    expect(applySafeguards(sf('BOOST'), sf('LOW'), 0, HOLD, HOLD)).toEqual({
      kind: 'apply',
      state: sf('HIGH'),
      steppedDown: true,
    });
    expect(applySafeguards(oad('OPEN'), oad('MINIMUM'), 0, HOLD, HOLD)).toEqual({
      kind: 'apply',
      state: oad('PARTIAL'),
      steppedDown: true,
    });
  });
});
