// Тогтмол тохиргооны төрөл (CLAUDE.md §5.1, §5.1.1, §10) — ажиллах явцад хэзээ ч өөрчлөгдөхгүй.
import type { DeviceKind } from './devices';
import type { AreaId, BuildingId, DeviceId, FloorId, SensorId } from './ids';
import type { MetricType, MetricUnit } from './metrics';

/** Метр, Y дээш (§5.1.1) */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Давхрын координат, метрээр; `x`, `z` нь бага утгатай булан (§5.1.2, D50) */
export interface Rect2D {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface Building {
  id: BuildingId;
  name: string; // 'AERIS Tower'
  floorIds: FloorId[]; // доороос → дээш дарааллаар
  footprint: { width: number; depth: number }; // метрээр, 3D-д
  floorHeight: number; // метрээр
  outdoorSensorIds: SensorId[];
  shafts: { supply: Vec3; exhaust: Vec3 }; // агааржуулалтын босоо сувгийн x/z (y-г 3D тооцно), §5.1.1
  core: Rect2D; // лифт/шатны хонгил — давхрын координатаар, бүх өндрөөр; shafts-аас тусдаа (§5.1.1, D59)
  coreLayout: CoreLayout; // хонгилын дотоод хуваалт (лифт, шат) — зөвхөн дүрслэлд (D86)
  evacuationStairs: Rect2D[]; // коридорын хоёр үзүүрийн эвакуацийн шатны хонгил, бүх өндрөөр — зөвхөн дүрслэлд (D87)
}

/** Шулуун хэрчим, давхрын x/z координатаар (метр) */
export interface Segment2D {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

/**
 * Хаалганы нүх: хананы шугам дээрх төв ба өргөн (D86). `axis` — хананы чиглэл; `room` нь жижиг өрөөний хаалга
 * (хүрээтэй), `office` нь нээлттэй оффис руу орох нүх (хүрээгүй).
 */
export interface DoorOpening {
  x: number;
  z: number;
  width: number;
  axis: 'x' | 'z';
  kind: 'room' | 'office';
}

/**
 * Яаралтай гарц: эвакуацийн шатны хаалга (D87) — шатны хонгилын коридор талын нүүрэн дээрх төв, өргөн ба зугтах
 * чиглэл (коридороос шат руу). Төлөвгүй — хаалганы төлөв ба яаралтай үеийн дүрэм (С5, P4) хойшлогдсон.
 */
export interface EmergencyExit {
  x: number;
  z: number;
  width: number;
  outward: { x: number; z: number };
}

/**
 * Давхрын дотоод бүтэц — **зөвхөн дүрслэлд** (D86): коридор, жижиг өрөө, хана (хаалганы нүхийг хассан), хаалга,
 * яаралтай гарц. Шинэ бүс, мэдрэгч биш; симуляци ба бүсийн тоо (§5.1) өөрчлөгдөхгүй. Давхрын локал координат.
 */
export interface FloorInteriorLayout {
  corridor: Rect2D;
  /** Лифтний хаалганаас коридор хүртэлх нээлттэй танхим — хана байхгүй, шалны контур л (D87); лоббид null */
  liftLobby: Rect2D | null;
  rooms: InteriorRoom[];
  walls: Segment2D[];
  doors: DoorOpening[];
  exits: EmergencyExit[];
  /** Өрөөнөөс гарах агаарын урсгалын зам (D87) — зөвхөн дүрслэл, өрөө тусдаа агаарын төлөвгүй */
  airflowPaths: Vec3[][];
}

/** Өрөөний зориулалт (D87; бодит оффисын хэв маяг) — UI нэрийг `i18n/mn`-ээс */
export type InteriorRoomKind =
  'meeting' | 'director' | 'workroom' | 'storage' | 'server' | 'restroom' | 'kitchen';

export interface InteriorRoom {
  kind: InteriorRoomKind;
  /** Ижил зориулалттай өрөөний дугаар (жишээ нь «Хурлын өрөө 1»); ганц бол null */
  number: number | null;
  bounds: Rect2D;
}

/** Лифт/шатны хонгилын хуваалт (D86): `Building.core` дотор, хаалга нь хонгилын урд (z-ийн их) нүүрэнд */
export interface CoreLayout {
  lifts: Rect2D[];
  stair: Rect2D;
  doorWidth: number;
}

export interface Floor {
  id: FloorId;
  buildingId: BuildingId;
  level: number; // 1-ээс эхэлнэ
  name: string; // 'Оффис'
  usage: 'lobby' | 'conference' | 'office' | 'lab' | 'lounge';
  areaIds: AreaId[];
  deviceIds: DeviceId[];
  ventilation: FloorVentilationLayout;
  interior: FloorInteriorLayout; // зөвхөн дүрслэлд (D86)
}

/** Зөвхөн дүрслэлд; давхрын локал координат (§5.1.1) */
export interface FloorVentilationLayout {
  supplyPoints: Vec3[];
  exhaustPoints: Vec3[];
  devicePositions: Record<DeviceKind, Vec3>;
  airflowPaths: Vec3[][]; // зам бүр оруулахаас → гаргах руу чиглэсэн waypoint
}

export interface Area {
  id: AreaId;
  floorId: FloorId;
  name: string; // 'Нээлттэй оффис (хойд)'
  bounds: Rect2D;
  markerPosition: Vec3; // мэдрэгчийн зангилааны давхар доторх байрлал
  volumeM3: number; // симуляцид хэрэглэнэ
  occupancyCapacity: number;
  baselineOccupancy: number; // 0–1, тогтмол суурь ачаалал (§5.8)
  baseline: Record<MetricType, number>; // ердийн утга (VOC суурь ≈ 100)
}

export interface Sensor {
  id: SensorId;
  floorId: FloorId | null; // гадна мэдрэгчид null
  areaId: AreaId | null; // гадна мэдрэгчид null
  metric: MetricType;
  unit: MetricUnit;
  location: 'indoor' | 'outdoor';
}
