// «AERIS Tower» барилгын тохиргоо (CLAUDE.md §5.1, §5.1.1, §5.1.2, §5.2, §5.3).
// ⚠️ Тоон утгууд нь ПРОТОТИПИЙН ТААМАГ — жинхэнэ барилгын хэмжилт биш (§5.1.2, D50).
// 3D болон UI компонент барилгын өгөгдлийг энд л уншина; geometry-г компонентод хатуу бичихгүй.
import type {
  Area,
  AreaId,
  Building,
  DeviceId,
  DeviceKind,
  Floor,
  FloorId,
  FloorVentilationLayout,
  MetricType,
  Sensor,
  SensorId,
} from '@/domain/types';

import { metricSpecs } from './thresholds';

export const BUILDING_ID = 'aeris-tower';
export const DEFAULT_FLOOR_COUNT = 12;
export const MIN_FLOOR_COUNT = 1;
export const MAX_FLOOR_COUNT = 20;

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
const DEVICE_KINDS: readonly DeviceKind[] = ['supply_fan', 'exhaust_fan', 'outdoor_air_damper'];

// ---------- §5.1.2: барилгын хэмжээ (метр) ----------
const FOOTPRINT = { width: 40, depth: 24 } as const;
const FLOOR_HEIGHT = 3.6;
const CEILING_HEIGHT = 3.0; // зөвхөн эзлэхүүний тооцоонд
/**
 * Лифт/шатны хонгил (D59): арын хананд, хоёр агааржуулалтын сувгийн дунд; cutaway, төхөөрөмж, мэдрэгчийн тэмдэг,
 * агаарын урсгалын замаас ≥ 2 м зайтай. Зөвхөн дүрслэлд — бүсийн эзлэхүүн (`volumeM3`) үүнийг хасахгүй.
 */
const CORE = { x: -4, z: -12, width: 8, depth: 4 } as const;

type Usage = Floor['usage'];
type Baseline = Record<MetricType, number>;

/** §5.1.2-ын бүсийн суурь утга (хэрэглээгээр). */
const BASELINE = {
  office: { temperature: 22.5, co2: 650, humidity: 45, pm25: 5, voc: 100 },
  lobby: { temperature: 21.5, co2: 600, humidity: 42, pm25: 7, voc: 100 },
  cafe: { temperature: 22.0, co2: 700, humidity: 47, pm25: 6, voc: 110 },
  conference: { temperature: 22.0, co2: 700, humidity: 45, pm25: 5, voc: 100 },
  lab: { temperature: 21.5, co2: 600, humidity: 40, pm25: 4, voc: 115 },
  lounge: { temperature: 23.5, co2: 600, humidity: 44, pm25: 5, voc: 100 },
} satisfies Record<string, Baseline>;

/** Гадна станцын суурь утга — S1-ийн гадна эхний нөхцөл (§7.2, §5.1.2). */
export const OUTDOOR_BASELINE = { temperature: 18.0, humidity: 55, pm25: 8 } as const;

interface AreaTemplate {
  name: string;
  capacity: number;
  baselineOccupancy: number;
  baseline: Baseline;
}

interface FloorTemplate {
  name: string;
  usage: Usage;
  areas: readonly [AreaTemplate, AreaTemplate]; // [A (хойд), B (урд)]
}

const OFFICE_TEMPLATE: FloorTemplate = {
  name: 'Оффис',
  usage: 'office',
  areas: [
    {
      name: 'Нээлттэй оффис (хойд)',
      capacity: 48,
      baselineOccupancy: 0.6,
      baseline: BASELINE.office,
    },
    {
      name: 'Нээлттэй оффис (урд)',
      capacity: 48,
      baselineOccupancy: 0.6,
      baseline: BASELINE.office,
    },
  ],
};

/** §5.1-ийн хүснэгт (түвшингээр). Хүснэгтэд байхгүй түвшин (3–10, 13–20) — оффис. */
const SPECIAL_FLOORS: Record<number, FloorTemplate> = {
  1: {
    name: 'Лобби ба хүлээн авах',
    usage: 'lobby',
    areas: [
      { name: 'Төв лобби', capacity: 30, baselineOccupancy: 0.5, baseline: BASELINE.lobby },
      { name: 'Кафе', capacity: 60, baselineOccupancy: 0.5, baseline: BASELINE.cafe },
    ],
  },
  2: {
    name: 'Хурлын төв',
    usage: 'conference',
    areas: [
      { name: 'Их танхим', capacity: 160, baselineOccupancy: 0.5, baseline: BASELINE.conference },
      {
        name: 'Хурлын өрөөнүүд',
        capacity: 80,
        baselineOccupancy: 0.5,
        baseline: BASELINE.conference,
      },
    ],
  },
  11: {
    name: 'Судалгааны лаборатори',
    usage: 'lab',
    areas: [
      { name: 'Лабораторийн жигүүр', capacity: 24, baselineOccupancy: 0.5, baseline: BASELINE.lab },
      { name: 'Лабораторийн туслах', capacity: 24, baselineOccupancy: 0.5, baseline: BASELINE.lab },
    ],
  },
  12: {
    name: 'Дээд давхрын лоунж',
    usage: 'lounge',
    areas: [
      { name: 'Лоунж', capacity: 60, baselineOccupancy: 0.5, baseline: BASELINE.lounge },
      { name: 'Террас кафе', capacity: 50, baselineOccupancy: 0.5, baseline: BASELINE.lounge },
    ],
  },
};

// ---------- §5.1.2: бүс ба агааржуулалтын байрлал (давхрын локал координат, метр) ----------
const AREA_GEOMETRY = [
  {
    letter: 'A',
    bounds: { x: -20, z: -12, width: 40, depth: 12 },
    markerPosition: { x: -10, y: 1.2, z: -6 },
  },
  {
    letter: 'B',
    bounds: { x: -20, z: 0, width: 40, depth: 12 },
    markerPosition: { x: -10, y: 1.2, z: 6 },
  },
] as const;

/** Давхар бүрт ижил агааржуулалтын байрлал (нэг туслах функцээс, §5.1.1). */
function createVentilationLayout(): FloorVentilationLayout {
  const zs = [-6, 6];
  return {
    supplyPoints: zs.map((z) => ({ x: -14, y: 2.8, z })),
    exhaustPoints: zs.map((z) => ({ x: 14, y: 2.8, z })),
    devicePositions: {
      supply_fan: { x: -6, y: 3.0, z: -8 },
      exhaust_fan: { x: 6, y: 3.0, z: -8 },
      outdoor_air_damper: { x: -6, y: 3.0, z: -11 },
    },
    airflowPaths: zs.map((z) => [
      { x: -14, y: 2.8, z },
      { x: 0, y: 1.5, z },
      { x: 14, y: 2.8, z },
    ]),
  };
}

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

/**
 * Тохиргооноос барилгыг үүсгэнэ (FR-B1, §5.1). Давхрын тоо 1–20 (layout/дүрслэлийн туршилтад);
 * 12-оос цөөн бол хүснэгтийн эхний N давхар, 13–20 нь «Оффис». Үзүүлэх сценари 12 давхарт зориулагдсан.
 */
export function createBuildingConfig(floorCount: number = DEFAULT_FLOOR_COUNT): BuildingConfig {
  if (
    !Number.isInteger(floorCount) ||
    floorCount < MIN_FLOOR_COUNT ||
    floorCount > MAX_FLOOR_COUNT
  ) {
    throw new RangeError(
      `Давхрын тоо ${MIN_FLOOR_COUNT}–${MAX_FLOOR_COUNT} хоорондох бүхэл тоо байх ёстой: ${floorCount}`,
    );
  }

  const floors: Record<FloorId, Floor> = {};
  const areas: Record<AreaId, Area> = {};
  const sensors: Record<SensorId, Sensor> = {};
  const devices: BuildingConfig['devices'] = {};
  const floorIds: FloorId[] = [];

  for (let level = 1; level <= floorCount; level += 1) {
    const template = SPECIAL_FLOORS[level] ?? OFFICE_TEMPLATE;
    const floorId = floorIdOf(level);
    floorIds.push(floorId);

    const areaIds = AREA_GEOMETRY.map((geometry, index) => {
      const areaTemplate = template.areas[index]!;
      const areaId = areaIdOf(floorId, geometry.letter);
      areas[areaId] = {
        id: areaId,
        floorId,
        name: areaTemplate.name,
        bounds: { ...geometry.bounds },
        markerPosition: { ...geometry.markerPosition },
        volumeM3: geometry.bounds.width * geometry.bounds.depth * CEILING_HEIGHT,
        occupancyCapacity: areaTemplate.capacity,
        baselineOccupancy: areaTemplate.baselineOccupancy,
        baseline: { ...areaTemplate.baseline },
      };
      for (const metric of METRICS) {
        const sensorId = indoorSensorIdOf(areaId, metric);
        sensors[sensorId] = {
          id: sensorId,
          floorId,
          areaId,
          metric,
          unit: metricSpecs[metric].unit,
          location: 'indoor',
        };
      }
      return areaId;
    });

    const deviceIds = DEVICE_KINDS.map((kind) => {
      const deviceId = deviceIdOf(floorId, kind);
      devices[deviceId] = { id: deviceId, floorId, kind };
      return deviceId;
    });

    floors[floorId] = {
      id: floorId,
      buildingId: BUILDING_ID,
      level,
      name: template.name,
      usage: template.usage,
      areaIds,
      deviceIds,
      ventilation: createVentilationLayout(),
    };
  }

  const outdoorSensorIds = OUTDOOR_METRICS.map((metric) => {
    const sensorId = outdoorSensorIdOf(metric);
    sensors[sensorId] = {
      id: sensorId,
      floorId: null,
      areaId: null,
      metric,
      unit: metricSpecs[metric].unit,
      location: 'outdoor',
    };
    return sensorId;
  });

  const building: Building = {
    id: BUILDING_ID,
    name: 'AERIS Tower',
    floorIds,
    footprint: { ...FOOTPRINT },
    floorHeight: FLOOR_HEIGHT,
    outdoorSensorIds,
    shafts: { supply: { x: -6, y: 0, z: -6 }, exhaust: { x: 6, y: 0, z: -6 } },
    core: { ...CORE },
  };

  return { building, floors, areas, sensors, devices };
}

/** Анхдагч 12 давхрын барилга (үзүүлэх сценарийн суурь, §5.1). */
export const buildingConfig: BuildingConfig = createBuildingConfig();
