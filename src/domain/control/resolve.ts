// Зөрчлийг шийдэх (CLAUDE.md §6.4, D12). Цэвэр функц.
// 3. Эрэлтийг нэгтгэх (сэнс — хамгийн өндөр, хаалт — хамгийн нээлттэй) → 4. дээд хязгаар (C-OUTDOOR-AIR)
// → 5. доод хязгаар (R-SENSOR-FALLBACK). Яаралтай байдал (1) ба гар удирдлага (2) нь engine-д.
import type { ConstraintId, ControlRequest, DeviceState, RuleId } from '@/domain/types';

import { maxState, sameState, stateRank } from './levels';

export interface ResolvedTarget {
  requestedState: DeviceState;
  constrainedState: DeviceState;
  winningRuleId: RuleId;
  contributingRuleIds: RuleId[];
  /** Энэ шатанд хэрэглэгдсэн хязгаарлалт (тэмдэглэлийн бичвэрийг engine нэмнэ) */
  constraintApplied: ConstraintId | null;
  minimumApplied: boolean;
  /** Эцсийн утгыг тогтоосон хүсэлтийн шалтгаан */
  winningReason: string;
}

const byPriorityThenId = (a: ControlRequest, b: ControlRequest) =>
  b.priority - a.priority || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0);

/** Ижил утга хүссэн хүсэлтүүдээс ялагч ба хувь нэмэр оруулагчид (тэнцвэл эрэмбэ, дараа нь ID-ийн цагаан толгой) */
function winnersFor(requests: readonly ControlRequest[], state: DeviceState) {
  const matching = requests.filter((r) => sameState(r.target, state)).sort(byPriorityThenId);
  const winner = matching[0]!;
  const contributing = [...new Set(matching.map((r) => r.ruleId))].filter(
    (id) => id !== winner.ruleId,
  );
  return { winner, contributing };
}

/**
 * Нэг төхөөрөмжийн эрэлт + доод хязгаараас зорилт. `demands` хоосон биш байх ёстой (R-BASELINE үргэлж байдаг).
 * `restricted` — C-OUTDOOR-AIR идэвхтэй эсэх (зөвхөн хаалтад нөлөөлнө).
 */
export function resolveTarget(
  demands: readonly ControlRequest[],
  minimums: readonly ControlRequest[],
  restricted: boolean,
): ResolvedTarget {
  if (demands.length === 0) throw new Error('resolveTarget: эрэлт хоосон (R-BASELINE байх ёстой)');
  const requested = demands.map((r) => r.target).reduce(maxState);
  const { winner, contributing } = winnersFor(demands, requested);

  let constrained = requested;
  let constraintApplied: ConstraintId | null = null;
  if (
    restricted &&
    constrained.kind === 'outdoor_air_damper' &&
    stateRank(constrained) > stateRank({ kind: 'outdoor_air_damper', position: 'MINIMUM' })
  ) {
    constrained = { kind: 'outdoor_air_damper', position: 'MINIMUM' };
    constraintApplied = 'C-OUTDOOR-AIR';
  }

  let minimumApplied = false;
  let winningRuleId: RuleId = winner.ruleId;
  let winningReason = winner.reason;
  let contributingRuleIds = contributing;
  for (const minimum of minimums) {
    // Доод хязгаар илүү их агааржуулалтыг хэзээ ч бууруулахгүй (§6.4-ийн 5)
    if (stateRank(minimum.target) > stateRank(constrained)) {
      constrained = minimum.target;
      minimumApplied = true;
      winningRuleId = minimum.ruleId;
      winningReason = minimum.reason;
      contributingRuleIds = [];
    }
  }

  return {
    requestedState: requested,
    constrainedState: constrained,
    winningRuleId,
    contributingRuleIds,
    constraintApplied,
    minimumApplied,
    winningReason,
  };
}
