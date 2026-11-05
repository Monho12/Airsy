// Сонгосон давхрын харагдац (CLAUDE.md §8.6, D88) — цэвэр тооцоо, WebGL-гүй тестлэгдэнэ. Сонгосон давхрын дээрх
// бүхнийг сүүдэр болгох/нуухад таазны өндөр ба хонгилын хуваалтыг энд тооцно.
import type { FloorId } from '@/domain/types';

import type { BuildingLayout } from './layout';

/** Бүтэн өндрийн хайрцаг (хонгил, эвакуацийн шат) */
export type ShaftBox = BuildingLayout['core'];

/** Сонгосон давхрын тааз (дээрх давхрын шал), м; сонголтгүй бол null */
export function selectedCeilingY(
  layout: BuildingLayout,
  selectedFloorId: FloorId | null,
): number | null {
  if (selectedFloorId === null) return null;
  const floor = layout.floors.find((f) => f.id === selectedFloorId);
  if (floor === undefined) return null;
  return floor.elevation + layout.height / layout.floors.length;
}

/**
 * Бүтэн өндрийн хайрцгийг `cutY`-аар хоёр хуваана: доод хэсэг тунгалаг бус (ирмэгтэй), дээд хэсэг сүүдэр (D88).
 * `cutY` null бол бүгд доод хэсэгт; хайрцгийн гадна байвал хуваахгүй.
 */
export function splitShaftBoxes(
  boxes: readonly ShaftBox[],
  cutY: number | null,
): { solid: ShaftBox[]; ghost: ShaftBox[] } {
  const solid: ShaftBox[] = [];
  const ghost: ShaftBox[] = [];
  for (const box of boxes) {
    const [w, h, d] = box.size;
    const bottom = box.center.y - h / 2;
    const top = box.center.y + h / 2;
    if (cutY === null || cutY >= top) {
      solid.push(box);
      continue;
    }
    if (cutY <= bottom) {
      ghost.push(box);
      continue;
    }
    const part = (from: number, to: number): ShaftBox => ({
      center: { x: box.center.x, y: (from + to) / 2, z: box.center.z },
      size: [w, to - from, d],
    });
    solid.push(part(bottom, cutY));
    ghost.push(part(cutY, top));
  }
  return { solid, ghost };
}
