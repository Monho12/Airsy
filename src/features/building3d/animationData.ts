// Төхөөрөмжийн анимацийн цэвэр тооцоо (CLAUDE.md §8.5, §8.6, §11.3, FR-B8, D78, D85). WebGL-гүй тестлэгдэнэ.
// Сэнсний эргэлтийн хурд ба агаарын урсгалын шугамын тоо/тод байдал/хурд нь урсгалын коэффициентод (§5.7)
// пропорциональ. Урсгалын шугамын geometry-ийн өгөгдлийг энд бэлтгэнэ (Airflow.tsx нь зөвхөн GPU руу дамжуулна).
import { CatmullRomCurve3, Vector3 } from 'three';

import type { BuildingConfig } from '@/domain/config/building';
import { fanAirflow } from '@/domain/config/control';
import type { FanLevel, FloorId, LiveSnapshot, Vec3 } from '@/domain/types';

import type { BuildingLayout } from './layout';

/** BOOST-ийн эргэлтийн хурд, рад/с (дүрслэлийн утга — 1.5 эргэлт/с) */
export const FAN_MAX_ANGULAR_SPEED = Math.PI * 3;
/** Гэрлийн зураасны хурд — зам дагуух хувь/с (дүрслэлийн утга; ~28 м-ийн замд LOW ≈ 9 м/с, BOOST ≈ 20 м/с) */
export const STREAMLINE_STREAK_MIN_SPEED = 0.2;
export const STREAMLINE_STREAK_MAX_SPEED = 0.7;
/** Шугам бүрийн дагуу зэрэг гүйх гэрлийн зураасны тоо (shader-ийн `STREAKS`) */
export const STREAMLINE_STREAKS = 2;
/** Нэг замын багц дахь шугамын тоо (D85: ~8) */
export const STREAMLINES_PER_PATH = 8;
/** Шугам бүрийн дээжийн хэрчим (муруйг жигд зурах) */
export const STREAMLINE_SEGMENTS = 40;
/** Багцын хамгийн их хажуугийн зай, м — бүсийн дотор (бүсийн гүн 12 м, зам бүсийн төвөөр) */
export const STREAMLINE_SPREAD = 1.4;
/** Хөдөлгөөн багасгах үеийн чиглэлийн сумны далавчны урт (м) ба өнцөг */
export const ARROW_WING_LENGTH = 1.2;
export const ARROW_WING_ANGLE = (35 * Math.PI) / 180;
/** Давхрын тодрол (D85): сонгосон давхар бүрэн, бусад ~30%; давхар сонгоогүй үед бүгд дунд зэрэг */
export const STREAMLINE_EMPHASIS = { selected: 1, other: 0.3, none: 0.6 } as const;

/** Сэнсний эргэлтийн хурд (рад/с): урсгалын коэффициент × хамгийн их хурд; OFF → 0 */
export const fanAngularSpeed = (level: FanLevel): number =>
  fanAirflow[level] * FAN_MAX_ANGULAR_SPEED;

/**
 * Харагдах шугамын тоо: урсгалтай өсөх ба урсгал байвал багцын дор хаяж ~25% (суурь LOW төлөвт ч урсгал тод
 * харагдана); OFF үед 0. §5.7-ын коэффициентоор: LOW 4 · MEDIUM 5 · HIGH 7 · BOOST 8.
 */
export function streamlineCount(airflow: number, perPath = STREAMLINES_PER_PATH): number {
  if (!(airflow > 0)) return 0;
  const share = 0.25 + 0.75 * Math.min(1, airflow);
  return Math.min(perPath, Math.max(1, Math.round(perPath * share)));
}

/**
 * Гэрлийн зураасны хурд (зам дагуух хувь/с): урсгал байвал «Бага» үед ч тод хөдөлж, урсгалтай шугаман хурдасна;
 * OFF (эсвэл мэдэгдэхгүй) үед 0 — хөдөлгөөнгүй.
 */
export function streamlineStreakSpeed(airflow: number): number {
  if (!(airflow > 0)) return 0;
  const a = Math.min(1, airflow);
  return (
    STREAMLINE_STREAK_MIN_SPEED + (STREAMLINE_STREAK_MAX_SPEED - STREAMLINE_STREAK_MIN_SPEED) * a
  );
}

/** Давхрын шугамын тод байдлын коэффициент (D85) */
export function floorEmphasis(floorId: FloorId, selectedFloorId: FloorId | null): number {
  if (selectedFloorId === null) return STREAMLINE_EMPHASIS.none;
  return floorId === selectedFloorId ? STREAMLINE_EMPHASIS.selected : STREAMLINE_EMPHASIS.other;
}

/**
 * Багц дахь шугамын замаас хазайх зай (`t ∈ [0, 1]` зам дагуу, `slot` — шугамын дугаар). Хоёр үзүүрт нийлж,
 * дунд хэсэгт дэлгэрнэ; бага зэргийн долгион нь шугамуудыг яг зэрэгцээ биш, салхи мэт болгоно (§8.6, D85).
 */
export function bundleOffset(
  t: number,
  slot: number,
  perPath = STREAMLINES_PER_PATH,
): { lateral: number; vertical: number } {
  const bulge = Math.sin(Math.PI * t);
  const profile = 0.3 + 0.7 * bulge;
  const spread = perPath <= 1 ? 0 : (slot / (perPath - 1)) * 2 - 1;
  return {
    lateral: spread * STREAMLINE_SPREAD * profile,
    vertical:
      0.22 * Math.sin(slot * 2.4 + 0.5) * profile +
      0.12 * Math.sin(2 * Math.PI * t * 1.3 + slot * 1.7) * bulge,
  };
}

/** Тасархай шугамын урт */
export function pathLength(path: readonly Vec3[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!;
    const b = path[i]!;
    length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return length;
}

export interface FloorAirflowLayout {
  floorId: FloorId;
  /** Барилгын координатаар (давхрын шалны өндрийг нэмсэн), оруулахаас → гаргах руу (§5.1.1) */
  paths: { points: Vec3[]; length: number }[];
}

export function createAirflowLayout(
  config: BuildingConfig,
  layout: BuildingLayout,
): FloorAirflowLayout[] {
  return layout.floors.map((floorLayout) => {
    const floor = config.floors[floorLayout.id];
    if (floor === undefined) throw new Error(`Давхар тохиргоонд алга: ${floorLayout.id}`);
    const paths = floor.ventilation.airflowPaths.map((path) => {
      const points = path.map(({ x, y, z }) => ({ x, y: floorLayout.elevation + y, z }));
      return { points, length: pathLength(points) };
    });
    return { floorId: floor.id, paths };
  });
}

/**
 * Урсгалын шугамын ribbon-ийн GPU өгөгдөл (D85). Шугам бүр нь `(segments + 1) × 2` оройтой нимгэн тууз: орой бүр
 * замын цэг, шүргэгч чиглэл ба тал (`side` = ±1) — өргөнийг vertex shader дэлгэцийн пикселээр тооцно. Нэг geometry
 * бүх давхрыг агуулна (нэг draw call). `kind`: 0 — урсгалын шугам, 1 — хөдөлгөөн багасгах үеийн чиглэлийн сум.
 */
export interface StreamlineData {
  position: Float32Array;
  tangent: Float32Array;
  side: Float32Array;
  /** Зам дагуух байрлал [0, 1] (supply → exhaust); сумд 1 */
  along: Float32Array;
  floor: Float32Array;
  slot: Float32Array;
  /** Шугам бүрийн тогтмол фаз [0, 1) — долгион шугам бүрт өөр агшинд гүйнэ */
  seed: Float32Array;
  kind: Float32Array;
  index: Uint32Array;
  lineCount: number;
  arrowCount: number;
}

/** Шугам бүрийн тогтмол фаз (алтан харьцаагаар тараасан) */
export const streamlineSeed = (index: number): number => (index * 0.618_033_988_75) % 1;

interface Ribbon {
  points: Vector3[];
  tangents: Vector3[];
  along: number[];
  floor: number;
  slot: number;
  seed: number;
  kind: 0 | 1;
}

const UP = new Vector3(0, 1, 0);

function bundleRibbons(
  floorIndex: number,
  path: { points: Vec3[] },
  perPath: number,
  segments: number,
  seedStart: number,
): Ribbon[] {
  const curve = new CatmullRomCurve3(
    path.points.map((p) => new Vector3(p.x, p.y, p.z)),
    false,
    'centripetal',
  );
  const ribbons: Ribbon[] = [];
  for (let slot = 0; slot < perPath; slot += 1) {
    const points: Vector3[] = [];
    const along: number[] = [];
    for (let k = 0; k <= segments; k += 1) {
      const t = k / segments;
      const base = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      // Хажуугийн чиглэл: шүргэгчид перпендикуляр хэвтээ вектор
      const lateral = new Vector3().crossVectors(tangent, UP).normalize();
      const { lateral: l, vertical: v } = bundleOffset(t, slot, perPath);
      points.push(base.addScaledVector(lateral, l).addScaledVector(UP, v));
      along.push(t);
    }
    // Хазайлтын дараах бодит шүргэгч (дэлгэцэн дээрх өргөний чиглэлд)
    const tangents = points.map((_point, k) => {
      const prev = points[Math.max(0, k - 1)]!;
      const next = points[Math.min(points.length - 1, k + 1)]!;
      return new Vector3().subVectors(next, prev).normalize();
    });
    ribbons.push({
      points,
      tangents,
      along,
      floor: floorIndex,
      slot,
      seed: streamlineSeed(seedStart + slot),
      kind: 0,
    });
  }

  // Чиглэлийн сум (›): exhaust үзүүрт, урсгалын чиглэл ба босоо тэнхлэгийн хавтгайд хоёр далавч
  const tip = curve.getPointAt(0.97);
  const dir = curve.getTangentAt(1).normalize();
  for (const sign of [1, -1]) {
    const back = dir
      .clone()
      .multiplyScalar(-Math.cos(ARROW_WING_ANGLE))
      .addScaledVector(UP, sign * Math.sin(ARROW_WING_ANGLE));
    const end = tip.clone().addScaledVector(back, ARROW_WING_LENGTH);
    const tangent = new Vector3().subVectors(tip, end).normalize();
    ribbons.push({
      points: [end, tip.clone()],
      tangents: [tangent, tangent.clone()],
      along: [1, 1],
      floor: floorIndex,
      slot: 0,
      seed: 0,
      kind: 1,
    });
  }
  return ribbons;
}

export function createStreamlineData(
  floors: readonly FloorAirflowLayout[],
  perPath = STREAMLINES_PER_PATH,
  segments = STREAMLINE_SEGMENTS,
): StreamlineData {
  const ribbons: Ribbon[] = [];
  floors.forEach((floor, floorIndex) => {
    floor.paths.forEach((path) => {
      ribbons.push(...bundleRibbons(floorIndex, path, perPath, segments, ribbons.length));
    });
  });

  const vertexCount = ribbons.reduce((sum, r) => sum + r.points.length * 2, 0);
  const quadCount = ribbons.reduce((sum, r) => sum + (r.points.length - 1), 0);
  const data: StreamlineData = {
    position: new Float32Array(vertexCount * 3),
    tangent: new Float32Array(vertexCount * 3),
    side: new Float32Array(vertexCount),
    along: new Float32Array(vertexCount),
    floor: new Float32Array(vertexCount),
    slot: new Float32Array(vertexCount),
    seed: new Float32Array(vertexCount),
    kind: new Float32Array(vertexCount),
    index: new Uint32Array(quadCount * 6),
    lineCount: ribbons.filter((r) => r.kind === 0).length,
    arrowCount: ribbons.filter((r) => r.kind === 1).length,
  };

  let v = 0;
  let i = 0;
  for (const ribbon of ribbons) {
    const first = v;
    ribbon.points.forEach((point, k) => {
      const tangent = ribbon.tangents[k]!;
      for (const side of [-1, 1]) {
        data.position.set([point.x, point.y, point.z], v * 3);
        data.tangent.set([tangent.x, tangent.y, tangent.z], v * 3);
        data.side[v] = side;
        data.along[v] = ribbon.along[k]!;
        data.floor[v] = ribbon.floor;
        data.slot[v] = ribbon.slot;
        data.seed[v] = ribbon.seed;
        data.kind[v] = ribbon.kind;
        v += 1;
      }
    });
    for (let k = 0; k < ribbon.points.length - 1; k += 1) {
      const a = first + k * 2;
      data.index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i);
      i += 6;
    }
  }
  return data;
}

/**
 * Давхрын агаарын урсгалын коэффициент: SF ба EF-ийн их нь (§5.7). Аль нэг нь ажиллаж байвал урсгал харагдана
 * (жишээ нь яаралтай байдлын үед галтай давхарт SF OFF, EF BOOST). Төлөв мэдэгдэхгүй бол 0 — таамаглахгүй.
 */
export function floorAirflow(
  devices: LiveSnapshot['devices'] | null,
  config: BuildingConfig,
  floorId: FloorId,
): number {
  let airflow = 0;
  for (const deviceId of config.floors[floorId]?.deviceIds ?? []) {
    const state = devices?.[deviceId]?.state;
    if (state === undefined || state.kind === 'outdoor_air_damper') continue;
    airflow = Math.max(airflow, fanAirflow[state.level]);
  }
  return airflow;
}
