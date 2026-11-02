// Төхөөрөмжийн анимацийн цэвэр тооцоо (CLAUDE.md §8.5, §8.6, §11.3, FR-B8, D78). WebGL-гүй тестлэгдэнэ.
// Сэнсний эргэлтийн хурд ба бөөмсийн тоо/хурд нь агаарын урсгалын коэффициентод (§5.7) пропорциональ.
import type { BuildingConfig } from '@/domain/config/building';
import { fanAirflow } from '@/domain/config/control';
import type { FanLevel, FloorId, LiveSnapshot, Vec3 } from '@/domain/types';

import type { BuildingLayout } from './layout';

/** BOOST-ийн эргэлтийн хурд, рад/с (дүрслэлийн утга — 1.5 эргэлт/с) */
export const FAN_MAX_ANGULAR_SPEED = Math.PI * 3;
/** BOOST үеийн бөөмсийн хурд, м/с (дүрслэлийн утга) */
export const PARTICLE_MAX_SPEED = 6;
/** Нийт бөөмсийн дээд хязгаар ба давхар бүрийн дээд хязгаар (§8.6, §11.3) */
export const PARTICLE_TOTAL_BUDGET = 2000;
export const PARTICLE_FLOOR_CAP = 200;

/** Сэнсний эргэлтийн хурд (рад/с): урсгалын коэффициент × хамгийн их хурд; OFF → 0 */
export const fanAngularSpeed = (level: FanLevel): number =>
  fanAirflow[level] * FAN_MAX_ANGULAR_SPEED;

/** Давхар бүрийн бөөмсийн дээд тоо: `min(200, floor(2000 / floorCount))` (§8.6) */
export const particleBudgetPerFloor = (floorCount: number): number =>
  Math.min(PARTICLE_FLOOR_CAP, Math.floor(PARTICLE_TOTAL_BUDGET / Math.max(1, floorCount)));

/** Тухайн давхрын идэвхтэй бөөмс: дээд тоо × урсгалын коэффициент (OFF үед 0) */
export const particleCount = (budget: number, airflow: number): number =>
  Math.round(budget * Math.max(0, Math.min(1, airflow)));

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

/** Замын `u ∈ [0, 1)` хэсэг дэх цэг (уртаар жигд). `out`-ийг дахин ашиглана — frame бүрт объект үүсгэхгүй (§11.3). */
export function pointOnPath(path: readonly Vec3[], length: number, u: number, out: Vec3): Vec3 {
  if (path.length === 0) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  let remaining = (((u % 1) + 1) % 1) * length;
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining <= segment || i === path.length - 1) {
      const t = segment === 0 ? 0 : Math.min(1, remaining / segment);
      out.x = a.x + (b.x - a.x) * t;
      out.y = a.y + (b.y - a.y) * t;
      out.z = a.z + (b.z - a.z) * t;
      return out;
    }
    remaining -= segment;
  }
  const last = path[path.length - 1]!;
  out.x = last.x;
  out.y = last.y;
  out.z = last.z;
  return out;
}

/** Бөөм бүрийн тогтмол фаз (алтан харьцаагаар тараасан) — тоо өөрчлөгдөхөд бусад бөөм үсрэхгүй */
export const particlePhase = (index: number): number => (index * 0.618_033_988_75) % 1;

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
