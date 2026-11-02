// Төхөөрөмжийн төлөвийн дараалал ба харьцуулалт (CLAUDE.md §6.4, §6.6). Цэвэр функц.
// Сэнс: OFF < LOW < MEDIUM < HIGH < BOOST; хаалт: CLOSED < MINIMUM < PARTIAL < OPEN.
import { damperPositionOrder, fanLevelOrder } from '@/domain/config/control';
import { mn } from '@/domain/i18n/mn';
import type { DeviceKind, DeviceState } from '@/domain/types';

/** Төлөвийн дарааллын индекс (их = илүү их агааржуулалт / илүү нээлттэй) */
export function stateRank(state: DeviceState): number {
  return state.kind === 'outdoor_air_damper'
    ? damperPositionOrder.indexOf(state.position)
    : fanLevelOrder.indexOf(state.level);
}

/** Индексээс тухайн төрлийн төлөв */
export function stateAtRank(kind: DeviceKind, rank: number): DeviceState {
  if (kind === 'outdoor_air_damper') {
    const max = damperPositionOrder.length - 1;
    return { kind, position: damperPositionOrder[Math.max(0, Math.min(max, rank))]! };
  }
  const max = fanLevelOrder.length - 1;
  return { kind, level: fanLevelOrder[Math.max(0, Math.min(max, rank))]! };
}

export function sameState(a: DeviceState, b: DeviceState): boolean {
  return a.kind === b.kind && stateRank(a) === stateRank(b);
}

/** Хоёр төлөвийн их нь (сэнс — өндөр түвшин, хаалт — илүү нээлттэй, §6.4) */
export function maxState(a: DeviceState, b: DeviceState): DeviceState {
  return stateRank(b) > stateRank(a) ? b : a;
}

/** Одоогийн төлөвөөс зорилт руу нэг алхам доош (§6.6 «алхам алхмаар буурах») */
export function stepToward(current: DeviceState, target: DeviceState): DeviceState {
  const from = stateRank(current);
  const to = stateRank(target);
  if (to >= from) return target;
  return stateAtRank(current.kind, from - 1);
}

export const stateLabel = (state: DeviceState): string => mn.devices.stateLabel(state);
