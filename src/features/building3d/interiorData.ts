// Давхрын дотоод бүтэц ба хонгилын хуваалтын 3D геометр (CLAUDE.md §8.6, D86) — цэвэр тооцоо, WebGL-гүй тестлэгдэнэ.
// Бүх утга тохиргооноос (`Floor.interior`, `Building.coreLayout`); энд зөвхөн зурах хэлбэр (өндөр, хүрээ) нэмнэ.
// Зөвхөн дүрслэл — шинэ бүс, мэдрэгч, сонголт биш.
import type { BuildingConfig } from '@/domain/config/building';
import type { AreaId, FloorId, FloorInteriorLayout, InteriorRoomKind, Vec3 } from '@/domain/types';

import { SLAB_THICKNESS, type BuildingLayout } from './layout';

/** Хаалганы хүрээний өндөр, м (шалнаас) */
export const DOOR_HEIGHT = 2.1;
/** Гарцын сумны өндөр (шалнаас) ба хэмжээ, м */
const EXIT_ARROW_HEIGHT = 2.5;
const EXIT_ARROW_SIZE = 0.5;
/** Сумны хошуу шатны нүүрнээс коридор тийш хэр зайтай (м) */
const EXIT_ARROW_GAP = 0.15;
/** Хонгилын нүүрэн дээрх шугамыг z-fighting-гүй зурах зай, м */
const FACE_OFFSET = 0.03;
/** Коридорын шалны контурыг хавтан дээр зурах өндөр, м */
const FLOOR_LINE_LIFT = 0.03;

/** Шугамын бүлэг — өнгө нь бүлгээр (§8.3-ын токен, Interior.tsx оноож өгнө) */
export type InteriorLineKind = 'wall' | 'door' | 'exit';

export interface InteriorGeometry {
  /** Хананы тунгалаг хавтгай: гурвалжин бүрийн 3 орой (x, y, z) */
  wallTriangles: Float32Array;
  /** Шугамын хэрчим: хос орой бүр нэг хэрчим (x, y, z) */
  lines: Record<InteriorLineKind, Float32Array>;
}

const pushQuad = (
  out: number[],
  [ax, az]: readonly [number, number],
  [bx, bz]: readonly [number, number],
  y0: number,
  y1: number,
) => {
  out.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
};

const pushLine = (out: number[], a: readonly number[], b: readonly number[]) => {
  out.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!);
};

/**
 * Нэг давхрын дотоод бүтцийн геометр (барилгын координат). Хана шалнаас дээд давхрын хавтангийн доод тал хүртэл;
 * өрөөний хаалга хүрээтэй, оффисын нүх хүрээгүй (хананы завсар л); гарц — хүрээ + гадагш чиглэсэн сум.
 */
export function floorInteriorGeometry(
  interior: FloorInteriorLayout,
  elevation: number,
  floorHeight: number,
): InteriorGeometry {
  const floorY = elevation + SLAB_THICKNESS;
  const ceilingY = elevation + floorHeight;
  const triangles: number[] = [];
  const wall: number[] = [];
  const door: number[] = [];
  const exit: number[] = [];

  for (const s of interior.walls) {
    pushQuad(triangles, [s.x1, s.z1], [s.x2, s.z2], floorY, ceilingY);
    // Хананы контур: доод, дээд ирмэг ба хоёр үзүүр
    pushLine(wall, [s.x1, floorY, s.z1], [s.x2, floorY, s.z2]);
    pushLine(wall, [s.x1, ceilingY, s.z1], [s.x2, ceilingY, s.z2]);
    pushLine(wall, [s.x1, floorY, s.z1], [s.x1, ceilingY, s.z1]);
    pushLine(wall, [s.x2, floorY, s.z2], [s.x2, ceilingY, s.z2]);
  }

  // Коридор ба лифтний танхимын шалны контур (хана байхгүй хэсэг ч уншигдана; лоббид коридор л)
  const y = floorY + FLOOR_LINE_LIFT;
  for (const rect of [interior.corridor, interior.liftLobby]) {
    if (rect === null) continue;
    const { x, z, width, depth } = rect;
    const corners = [
      [x, y, z],
      [x + width, y, z],
      [x + width, y, z + depth],
      [x, y, z + depth],
    ] as const;
    corners.forEach((corner, i) => pushLine(wall, corner, corners[(i + 1) % corners.length]!));
  }

  // Өрөөний хаалганы хүрээ: хоёр багана + толгой
  const topY = floorY + DOOR_HEIGHT;
  for (const d of interior.doors) {
    if (d.kind !== 'room') continue;
    const half = d.width / 2;
    const [a, b] =
      d.axis === 'x'
        ? [
            [d.x - half, d.z],
            [d.x + half, d.z],
          ]
        : [
            [d.x, d.z - half],
            [d.x, d.z + half],
          ];
    pushLine(door, [a[0]!, floorY, a[1]!], [a[0]!, topY, a[1]!]);
    pushLine(door, [b[0]!, floorY, b[1]!], [b[0]!, topY, b[1]!]);
    pushLine(door, [a[0]!, topY, a[1]!], [b[0]!, topY, b[1]!]);
  }

  // Гарц (D87): эвакуацийн шатны хаалганы хүрээ (шатны нүүрнээс коридор тийш бага зэрэг — тунгалаг бус хонгилд
  // далдлагдахгүй) + коридорт хаалга руу заасан сум (›)
  for (const e of interior.exits) {
    const half = e.width / 2;
    const along = Math.abs(e.outward.x) > 0 ? { x: 0, z: 1 } : { x: 1, z: 0 };
    const face = { x: e.x - e.outward.x * FACE_OFFSET, z: e.z - e.outward.z * FACE_OFFSET };
    const a = { x: face.x - along.x * half, z: face.z - along.z * half };
    const b = { x: face.x + along.x * half, z: face.z + along.z * half };
    pushLine(exit, [a.x, floorY, a.z], [a.x, topY, a.z]);
    pushLine(exit, [b.x, floorY, b.z], [b.x, topY, b.z]);
    pushLine(exit, [a.x, topY, a.z], [b.x, topY, b.z]);
    const tip = {
      x: e.x - e.outward.x * EXIT_ARROW_GAP,
      y: floorY + EXIT_ARROW_HEIGHT,
      z: e.z - e.outward.z * EXIT_ARROW_GAP,
    };
    const back = {
      x: tip.x - e.outward.x * EXIT_ARROW_SIZE,
      z: tip.z - e.outward.z * EXIT_ARROW_SIZE,
    };
    for (const sign of [-1, 1]) {
      pushLine(
        exit,
        [
          back.x + along.x * sign * EXIT_ARROW_SIZE,
          tip.y,
          back.z + along.z * sign * EXIT_ARROW_SIZE,
        ],
        [tip.x, tip.y, tip.z],
      );
    }
  }

  return {
    wallTriangles: new Float32Array(triangles),
    lines: {
      wall: new Float32Array(wall),
      door: new Float32Array(door),
      exit: new Float32Array(exit),
    },
  };
}

/** Шошгоны төрөл (D87): өрөөний зориулалт, лифт, шат, гарц, нээлттэй оффис (бүсийн нэр) */
export type InteriorLabelKind = InteriorRoomKind | 'lift' | 'stair' | 'exit' | 'office';

export interface InteriorLabel {
  key: string;
  kind: InteriorLabelKind;
  /** Хурлын өрөөний дугаар; бусад null */
  number: number | null;
  /** `office` шошгонд бүсийн ID (нэрийг тохиргооноос) */
  areaId: AreaId | null;
  position: Vec3;
}

/**
 * Шошгоны өндөр (шалнаас) гүнээр шатлана: арын (z бага) шошго таазны ойролцоо, урдынх шалны ойролцоо. Анхдагч камер
 * бараг хэвтээ (D60) тул ижил өндөрт байвал гүн дагуух шошгууд дэлгэцэн дээр давхарладаг.
 */
export const labelHeight = (z: number): number => Math.min(3.0, Math.max(0.6, 1.6 - 0.13 * z));

/**
 * Сонгосон давхрын шошго (D87): өрөө бүр (төвд), лифт ба шат (хонгилын урд), гарц (коридорт хаалганы өмнө),
 * нээлттэй оффис (бүс бүрт, коридор ба урсгалын замын хооронд). Давхар сонгоогүй бол хоосон.
 */
export function interiorLabels(
  config: BuildingConfig,
  layout: BuildingLayout,
  selectedFloorId: FloorId | null,
): InteriorLabel[] {
  if (selectedFloorId === null) return [];
  const floor = config.floors[selectedFloorId];
  const floorLayout = layout.floors.find((f) => f.id === selectedFloorId);
  if (floor === undefined || floorLayout === undefined) return [];
  const floorY = floorLayout.elevation + SLAB_THICKNESS;
  const at = (x: number, z: number): Vec3 => ({ x, y: floorY + labelHeight(z), z });
  const { core, coreLayout } = config.building;
  const coreFront = core.z + core.depth;
  const centerOf = (r: { x: number; z: number; width: number; depth: number }) => ({
    x: r.x + r.width / 2,
    z: r.z + r.depth / 2,
  });
  const labels: InteriorLabel[] = [];

  floor.interior.rooms.forEach((room, i) => {
    const c = centerOf(room.bounds);
    labels.push({
      key: `room-${i}`,
      kind: room.kind,
      number: room.number,
      areaId: null,
      position: at(c.x, c.z),
    });
  });
  const lifts = coreLayout.lifts;
  const liftsX = (lifts[0]!.x + lifts.at(-1)!.x + lifts.at(-1)!.width) / 2;
  labels.push({
    key: 'lift',
    kind: 'lift',
    number: null,
    areaId: null,
    position: at(liftsX, coreFront + 0.6),
  });
  labels.push({
    key: 'stair',
    kind: 'stair',
    number: null,
    areaId: null,
    position: at(centerOf(coreLayout.stair).x, coreFront + 0.6),
  });
  floor.interior.exits.forEach((exit, i) => {
    labels.push({
      key: `exit-${i}`,
      kind: 'exit',
      number: null,
      areaId: null,
      position: at(exit.x - exit.outward.x * 1.2, exit.z - exit.outward.z * 1.2),
    });
  });
  // Нээлттэй оффис: бүсийн баруун хэсэгт, коридор ба урсгалын замын (z = ±6) хооронд
  for (const areaId of floor.areaIds) {
    const area = config.areas[areaId];
    if (area === undefined) continue;
    const { x, z, width, depth } = area.bounds;
    const north = z + depth <= 0;
    labels.push({
      key: `office-${areaId}`,
      kind: 'office',
      number: null,
      areaId,
      position: at(x + width * 0.72, north ? z + depth - 4.5 : z + depth - 3),
    });
  }
  return labels;
}

/** Сонгосон давхрын дотоод бүтэц (D86: зөвхөн сонгосон давхарт); давхар сонгоогүй эсвэл тохиргоонд алга бол null */
export function selectedInteriorGeometry(
  config: BuildingConfig,
  layout: BuildingLayout,
  selectedFloorId: FloorId | null,
): InteriorGeometry | null {
  if (selectedFloorId === null) return null;
  const floor = config.floors[selectedFloorId];
  const floorLayout = layout.floors.find((f) => f.id === selectedFloorId);
  if (floor === undefined || floorLayout === undefined) return null;
  return floorInteriorGeometry(floor.interior, floorLayout.elevation, config.building.floorHeight);
}

/**
 * Лифт/шатны хонгилын урд (коридор талын) нүүрэн дээрх шугам — бүх давхарт (D86): лифт ба шатны хоорондын босоо
 * хуваалт (бүтэн өндөр), давхар бүрт лифтний хаалганы хүрээ ба шатны зигзаг (хоёр хэсэгтэй). Хонгил тунгалаг бус тул
 * хуваалтыг нүүрэн дээр зурна.
 */
export function coreFaceLines(config: BuildingConfig, layout: BuildingLayout): Float32Array {
  const { core, coreLayout, floorHeight } = config.building;
  const faceZ = core.z + core.depth + FACE_OFFSET;
  const top = layout.core.size[1];
  const out: number[] = [];
  const parts = [...coreLayout.lifts, coreLayout.stair].sort((a, b) => a.x - b.x);
  for (let i = 1; i < parts.length; i += 1) {
    const x = parts[i]!.x;
    pushLine(out, [x, 0, faceZ], [x, top, faceZ]);
  }
  const { stair } = coreLayout;
  const margin = 0.3;
  for (const floor of layout.floors) {
    const floorY = floor.elevation + SLAB_THICKNESS;
    const doorTop = floorY + DOOR_HEIGHT;
    for (const lift of coreLayout.lifts) {
      const cx = lift.x + lift.width / 2;
      const half = coreLayout.doorWidth / 2;
      pushLine(out, [cx - half, floorY, faceZ], [cx - half, doorTop, faceZ]);
      pushLine(out, [cx + half, floorY, faceZ], [cx + half, doorTop, faceZ]);
      pushLine(out, [cx - half, doorTop, faceZ], [cx + half, doorTop, faceZ]);
      // Лифтний хоёр хаалт (дунд нь хуваалт)
      pushLine(out, [cx, floorY, faceZ], [cx, doorTop, faceZ]);
    }
    // Шат: зүүнээс баруун тийш өгсөөд (хагас давхар), буцаж зүүн тийш өгсөнө
    const x0 = stair.x + margin;
    const x1 = stair.x + stair.width - margin;
    const mid = floor.elevation + floorHeight / 2 + SLAB_THICKNESS / 2;
    const next = floor.elevation + floorHeight;
    pushLine(out, [x0, floorY, faceZ], [x1, mid, faceZ]);
    pushLine(out, [x1, mid, faceZ], [x0, next, faceZ]);
  }
  return new Float32Array(out);
}
