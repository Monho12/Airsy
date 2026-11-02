// Тогтвортой байдлын шүүлтүүр (CLAUDE.md §6.6, FR-C3, FR-C4). Цэвэр функц.
// Нэмэгдүүлэх — тэр даруй; бууруулах — `minStateHoldMs` өнгөрсний дараа, нэг удаад нэг түвшингээр.
import { controlConfig } from '@/domain/config/control';
import type { DeviceState, SimTimeMs } from '@/domain/types';

import { sameState, stateRank, stepToward } from './levels';

export type SafeguardResult =
  | { kind: 'unchanged' }
  | { kind: 'apply'; state: DeviceState; steppedDown: boolean }
  | { kind: 'held_by_dwell' };

export function applySafeguards(
  current: DeviceState,
  target: DeviceState,
  lastChangedAt: SimTimeMs,
  now: SimTimeMs,
  holdMs: number = controlConfig.minStateHoldMs,
): SafeguardResult {
  if (sameState(current, target)) return { kind: 'unchanged' };
  if (stateRank(target) > stateRank(current)) {
    return { kind: 'apply', state: target, steppedDown: false };
  }
  if (now - lastChangedAt < holdMs) return { kind: 'held_by_dwell' };
  const next = stepToward(current, target);
  return { kind: 'apply', state: next, steppedDown: !sameState(next, target) };
}
