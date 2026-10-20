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
  shafts: { supply: Vec3; exhaust: Vec3 }; // босоо сувгийн x/z (y-г 3D тооцно), §5.1.1
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
