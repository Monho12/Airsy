// Барилгын 3D layout-ийг тохиргооноос гаргана (CLAUDE.md §5.1, §5.1.1, §8.6, FR-B1). Цэвэр, тодорхой функц —
// ижил тохиргоо → ижил layout; барилга/давхар/бүсийн өгөгдлийг энд давхардуулахгүй, зөвхөн дүрслэлийн хэмжээ нэмнэ.
// Координат (§5.1.1): метр, Y дээш, эх цэг нь 1-р давхрын шалны төв, X баруун тийш, Z урагш (анхдагч камер руу).
import type { BuildingConfig } from '@/domain/config/building';
import type { AreaId, FloorId, Vec3 } from '@/domain/types';

// ---------- Дүрслэлийн хэмжээ (барилгын өгөгдөл биш — зөвхөн зурах хэлбэр) ----------
/** Давхрын хавтангийн зузаан, м */
export const SLAB_THICKNESS = 0.3;
/** Бүсийн хавтгайг хавтангийн ирмэг ба хөрш бүсээс тусгаарлах зай, м (бүс хоорондын зураас харагдана) */
export const ZONE_INSET = 0.4;
/** Бүсийн хавтгайг хавтан дээр z-fighting-гүй зурах өндөр, м */
export const ZONE_LIFT = 0.02;

export interface FloorLayout {
  id: FloorId;
  level: number;
  /** Шалны өндөр: (level − 1) × floorHeight (§5.1.1) */
  elevation: number;
  slab: { center: Vec3; size: [width: number, height: number, depth: number] };
  zones: ZoneLayout[];
}

export interface ZoneLayout {
  id: AreaId;
  floorId: FloorId;
  /** Хавтгайн төв (барилгын координат) */
  center: Vec3;
  /** x ба z чиглэлийн хэмжээ */
  size: [width: number, depth: number];
}

/** Нүүрний шилэн хавтан; урд-баруун дөрөвний нэг (x > 0, z > 0) нь cutaway тул хавтангүй (§5.1.1, §8.6). */
export interface FacadePanel {
  side: 'back' | 'left' | 'front-left' | 'right-back';
  center: Vec3;
  width: number;
  height: number;
  /** Y тэнхлэгийн эргэлт, радиан (хавтгай анхдагчаар +Z руу харна) */
  rotationY: number;
}

export interface BuildingLayout {
  width: number;
  depth: number;
  /** Нийт өндөр = давхрын тоо × floorHeight (дээврийн хавтангийн доод тал) */
  height: number;
  floors: FloorLayout[];
  roofSlab: { center: Vec3; size: [number, number, number] };
  /** Лифт/шатны хонгил — `Building.core`-оос, газраас дээврийн хавтангийн дээд тал хүртэл (D59; shafts биш) */
  core: { center: Vec3; size: [width: number, height: number, depth: number] };
  facade: FacadePanel[];
  /** Анхдагч харагдац: урд-баруун талаас, дээрээс (cutaway тал руу, §5.1.1) */
  camera: { position: Vec3; target: Vec3 };
}

/** Камерын босоо харах өнцөг, градус (Building3D-ийн Canvas ижил утгыг ашиглана) */
export const CAMERA_FOV_DEG = 40;
/**
 * Анхдагч камерын чиглэл: урд-баруун (x > 0, z > 0, §5.1.1), бага зэрэг дээрээс (босоо өнцөг ≈ 83°).
 * y = 0.2 (D60): өмнөх 0.6 (≈ 70°) үед дээд давхрын хавтан мэдрэгчийн тэмдгийн 17/24-ийг бүрэн халхалж байсан.
 */
export const CAMERA_DIRECTION: Vec3 = { x: 1, y: 0.2, z: 1.35 };
/** Барилгын эргэн тойронд үлдээх зай (1 = яг багтана) */
const CAMERA_FIT_MARGIN = 1.05;

const slabAt = (elevation: number, width: number, depth: number) => ({
  center: { x: 0, y: elevation + SLAB_THICKNESS / 2, z: 0 },
  size: [width, SLAB_THICKNESS, depth] as [number, number, number],
});

export function createBuildingLayout(config: BuildingConfig): BuildingLayout {
  const { building, floors, areas } = config;
  const { width, depth } = building.footprint;
  const height = building.floorIds.length * building.floorHeight;

  const floorLayouts = building.floorIds.map((floorId): FloorLayout => {
    const floor = floors[floorId];
    if (floor === undefined) throw new Error(`Давхар тохиргоонд алга: ${floorId}`);
    const elevation = (floor.level - 1) * building.floorHeight;
    const zones = floor.areaIds.map((areaId): ZoneLayout => {
      const area = areas[areaId];
      if (area === undefined) throw new Error(`Бүс тохиргоонд алга: ${areaId}`);
      const { x, z, width: w, depth: d } = area.bounds; // x, z — бага утгатай булан (D50)
      return {
        id: areaId,
        floorId,
        center: { x: x + w / 2, y: elevation + SLAB_THICKNESS + ZONE_LIFT, z: z + d / 2 },
        size: [w - 2 * ZONE_INSET, d - 2 * ZONE_INSET],
      };
    });
    return {
      id: floorId,
      level: floor.level,
      elevation,
      slab: slabAt(elevation, width, depth),
      zones,
    };
  });

  const halfW = width / 2;
  const halfD = depth / 2;
  const midY = height / 2;
  const facade: FacadePanel[] = [
    { side: 'back', center: { x: 0, y: midY, z: -halfD }, width, height, rotationY: Math.PI },
    {
      side: 'left',
      center: { x: -halfW, y: midY, z: 0 },
      width: depth,
      height,
      rotationY: -Math.PI / 2,
    },
    // Урд нүүрний зөвхөн зүүн тал (x < 0), баруун нүүрний зөвхөн арын тал (z < 0) — cutaway
    {
      side: 'front-left',
      center: { x: -halfW / 2, y: midY, z: halfD },
      width: halfW,
      height,
      rotationY: 0,
    },
    {
      side: 'right-back',
      center: { x: halfW, y: midY, z: -halfD / 2 },
      width: halfD,
      height,
      rotationY: Math.PI / 2,
    },
  ];

  // Барилгыг бүхэлд нь багтаах бөмбөрцгийг босоо FOV-д багтаана (давхрын тоо 1–20 бүгдэд кадраас гарахгүй)
  const target: Vec3 = { x: 0, y: midY, z: 0 };
  const radius = Math.hypot(width, height + SLAB_THICKNESS, depth) / 2;
  const distance = (radius / Math.sin((CAMERA_FOV_DEG * Math.PI) / 360)) * CAMERA_FIT_MARGIN;
  const norm = Math.hypot(CAMERA_DIRECTION.x, CAMERA_DIRECTION.y, CAMERA_DIRECTION.z);
  const position: Vec3 = {
    x: target.x + (CAMERA_DIRECTION.x / norm) * distance,
    y: target.y + (CAMERA_DIRECTION.y / norm) * distance,
    z: target.z + (CAMERA_DIRECTION.z / norm) * distance,
  };

  const { core } = building; // x, z — бага утгатай булан (Rect2D, D50)
  const coreHeight = height + SLAB_THICKNESS;

  return {
    width,
    depth,
    height,
    floors: floorLayouts,
    roofSlab: slabAt(height, width, depth),
    core: {
      center: { x: core.x + core.width / 2, y: coreHeight / 2, z: core.z + core.depth / 2 },
      size: [core.width, coreHeight, core.depth],
    },
    facade,
    camera: { position, target },
  };
}
