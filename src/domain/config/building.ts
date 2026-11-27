// Барилгын нийтлэг гэрээ (CLAUDE.md §5.2, §5.3, §10): ID-ийн дүрэм, хэмжигдэхүүн, `BuildingConfig` төрөл.
// ⚠️ Барилгын ӨГӨГДӨЛ (давхар, өрөө, бүс, мэдрэгч, 3D байрлал) энд БАЙХГҮЙ — зөвхөн backend-д
// (`api-worker/src/buildingData.ts`, D106). Frontend үүнийг эхлэхдээ `GET /api/config`-оос авна.
import type {
  Area,
  AreaId,
  Building,
  DeviceId,
  DeviceKind,
  Floor,
  FloorId,
  MetricType,
  Sensor,
  SensorId,
} from '@/domain/types';

/** Мэдрэгчийн хэмжигдэхүүний тогтмол дараалал (§5.3: бүс бүрт хэмжигдэхүүн тус бүрийн нэг мэдрэгч). */
export const METRICS: readonly MetricType[] = ['temperature', 'co2', 'humidity', 'pm25', 'voc'];

/** Гадна станцын хэмжигдэхүүн (§5.3). Гадна CO₂ нь мэдрэгч биш, тогтмол утга. */
export const OUTDOOR_METRICS: readonly MetricType[] = ['temperature', 'humidity', 'pm25'];

/** Төхөөрөмжийн төрлийн код (§5.2) */
export const DEVICE_CODES: Record<DeviceKind, string> = {
  supply_fan: 'SF',
  exhaust_fan: 'EF',
  outdoor_air_damper: 'OAD',
};

/** Гадна станцын суурь утга — S1-ийн гадна эхний нөхцөл (§7.2, §5.1.2). */
export const OUTDOOR_BASELINE = { temperature: 18.0, humidity: 55, pm25: 8 } as const;

// ---------- ID (§5.2) ----------
export const floorIdOf = (level: number): FloorId => `F${String(level).padStart(2, '0')}`;
export const areaIdOf = (floorId: FloorId, letter: string): AreaId => `${floorId}-${letter}`;
export const indoorSensorIdOf = (areaId: AreaId, metric: MetricType): SensorId =>
  `${areaId}-${metric}`;
export const outdoorSensorIdOf = (metric: MetricType): SensorId => `OUT-${metric}`;
export const deviceIdOf = (floorId: FloorId, kind: DeviceKind): DeviceId =>
  `${floorId}-${DEVICE_CODES[kind]}`;

/** Барилгын бүрэн тохиргоо: объект бүрийг ID-гаар, дарааллыг ID-ийн массиваар. */
export interface BuildingConfig {
  building: Building;
  floors: Record<FloorId, Floor>;
  areas: Record<AreaId, Area>;
  sensors: Record<SensorId, Sensor>;
  /** Төхөөрөмжийн ID → төрөл ба давхар (төлөв нь шууд snapshot-д, §10.2). */
  devices: Record<DeviceId, { id: DeviceId; floorId: FloorId; kind: DeviceKind }>;
}
