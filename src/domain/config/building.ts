// «AERIS Tower» барилгын тохиргоо (CLAUDE.md §5.1, §5.1.1, §5.1.2, §5.2, §5.3).
// ⚠️ Тоон утгууд нь ПРОТОТИПИЙН ТААМАГ — жинхэнэ барилгын хэмжилт биш (§5.1.2, D50).
// 3D болон UI компонент барилгын өгөгдлийг энд л уншина; geometry-г компонентод хатуу бичихгүй.
import type {
  Area,
  AreaId,
  Building,
  CoreLayout,
  DeviceId,
  DoorOpening,
  EmergencyExit,
  DeviceKind,
  Floor,
  FloorId,
  FloorInteriorLayout,
  FloorVentilationLayout,
  InteriorRoom,
  MetricType,
  Rect2D,
  Segment2D,
  Sensor,
  SensorId,
  Vec3,
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
      // D80: 0.45 (S3-ын CO₂ анхааруулга хүрэхүйц — D68-ийн 5)
      { name: 'Их танхим', capacity: 160, baselineOccupancy: 0.45, baseline: BASELINE.conference },
      {
        name: 'Хурлын өрөөнүүд',
        capacity: 80,
        baselineOccupancy: 0.45,
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

// ---------- Дотоод бүтэц (D86, D87) — зөвхөн дүрслэлд; ⚠️ прототипийн таамаг утга ----------
// Төлөвлөлт (дээрээс, урд тал доор): арын хананд хонгилын хоёр талд ариун цэврийн өрөө ба гал тогоо; дөрвөн буланд
// хурлын өрөө 1, 2 (хойд), захирлын өрөө ба агуулах/сервер (урд); голд нээлттэй оффис А, Б; хонгилоос коридор хүртэл
// нээлттэй лифтний танхим; коридорын хоёр үзүүрт эвакуацийн шат. Бүх хана мэдрэгч, төхөөрөмж, supply/exhaust цэг ба
// агаарын урсгалын замаас ≥ 1 м (building.test.ts).
/** Коридорын хагас өргөн (коридор z −1.5…1.5) */
const CORRIDOR_HALF_WIDTH = 1.5;
/** Булангийн өрөөний өргөн (x чиглэлд); supply/exhaust цэгээс (x = ±14) 1 м зайтай */
const ROOM_WIDTH = 5;
const ROOM_DOOR_WIDTH = 1;
/** Эвакуацийн шат: коридорын үзүүрт, 3 × 3 м, бүх өндрөөр (D87) */
const EVAC_STAIR_SIZE = 3;
const EXIT_WIDTH = 1.2;
/** Урд талын нээлттэй оффис руу орох нүх: x = ±8, 2 м */
const OFFICE_OPENING_X = 8;
const OFFICE_OPENING_WIDTH = 2;
/** Арын хананы өрөө (ариун цэврийн өрөө, гал тогоо): хонгилын хоёр талд, x 8…14, z −12…−8 */
const BACK_ROOM = { inner: 8, outer: 14, front: -8 } as const;

/** Хонгилын хуваалт: 2 лифт (тус бүр 2 м) + шат (4 м); хаалга нь коридор талын нүүрэнд */
const CORE_LAYOUT: CoreLayout = {
  lifts: [
    { x: CORE.x, z: CORE.z, width: 2, depth: CORE.depth },
    { x: CORE.x + 2, z: CORE.z, width: 2, depth: CORE.depth },
  ],
  stair: { x: CORE.x + 4, z: CORE.z, width: CORE.width - 4, depth: CORE.depth },
  doorWidth: 1,
};

/** Эвакуацийн шатны хонгил: коридорын хоёр үзүүрт, гадна хананд наалдсан (D87) */
const EVACUATION_STAIRS: Rect2D[] = [-1, 1].map((side) => ({
  x: side < 0 ? -FOOTPRINT.width / 2 : FOOTPRINT.width / 2 - EVAC_STAIR_SIZE,
  z: -EVAC_STAIR_SIZE / 2,
  width: EVAC_STAIR_SIZE,
  depth: EVAC_STAIR_SIZE,
}));

/** Тэнхлэгийн дагуух хананаас хаалганы нүхийг хасна (`fixed` — хананы тогтмол координат) */
function wallWithGaps(
  axis: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  gaps: readonly { center: number; width: number }[],
): Segment2D[] {
  const segment = (a: number, b: number): Segment2D =>
    axis === 'x' ? { x1: a, z1: fixed, x2: b, z2: fixed } : { x1: fixed, z1: a, x2: fixed, z2: b };
  const sorted = [...gaps].sort((a, b) => a.center - b.center);
  const segments: Segment2D[] = [];
  let cursor = from;
  for (const gap of sorted) {
    const start = gap.center - gap.width / 2;
    if (start > cursor) segments.push(segment(cursor, start));
    cursor = gap.center + gap.width / 2;
  }
  if (cursor < to) segments.push(segment(cursor, to));
  return segments;
}

type Gap = { center: number; width: number; kind: DoorOpening['kind'] };

/** Нэг тэнхлэгийн хана + түүний хаалга (`axis` — хананы чиглэл) */
function wallLine(axis: 'x' | 'z', fixed: number, from: number, to: number, gaps: Gap[]) {
  return {
    walls: wallWithGaps(axis, fixed, from, to, gaps),
    doors: gaps.map((gap): DoorOpening => ({
      x: axis === 'x' ? gap.center : fixed,
      z: axis === 'x' ? fixed : gap.center,
      width: gap.width,
      axis,
      kind: gap.kind,
    })),
  };
}

/** Өрөөний агаарын урсгал: эхлэл → бага зэрэг доош хотойсон дунд цэг → төгсгөл (supply → exhaust, D87) */
const roomPath = (from: { x: number; z: number }, to: { x: number; z: number }): Vec3[] => [
  { x: from.x, y: 2.8, z: from.z },
  { x: (from.x + to.x) / 2, y: 2.0, z: (from.z + to.z) / 2 },
  { x: to.x, y: 2.8, z: to.z },
];

/** Захирлын өрөөний давхар (D88; хөгжүүлэгчийн сонголт) — барилгад ганц захирлын өрөө */
export const DIRECTOR_FLOOR_LEVEL = 10;

/** Ганц өрөөнүүдийн давхрын сонголт (D88) */
interface UniqueRoomFloors {
  /** Захирлын өрөө: 10-р давхар; давхар цөөн бол лоббиос бусад хамгийн дээд давхар */
  director: number | null;
  /** Сервер өрөө: хамгийн доод оффис давхар; оффис давхаргүй бол лоббиос бусад хамгийн доод давхар */
  server: number | null;
}

function uniqueRoomFloors(usageByLevel: readonly Usage[]): UniqueRoomFloors {
  const levels = usageByLevel.map((usage, i) => ({ level: i + 1, usage }));
  const rooms = levels.filter((l) => l.usage !== 'lobby');
  const offices = levels.filter((l) => l.usage === 'office');
  const director = rooms.some((l) => l.level === DIRECTOR_FLOOR_LEVEL)
    ? DIRECTOR_FLOOR_LEVEL
    : (rooms.at(-1)?.level ?? null);
  const server = offices[0]?.level ?? rooms[0]?.level ?? null;
  return { director, server };
}

/**
 * Давхрын дотоод бүтэц (D86, D87, D88). Лобби (F01) нээлттэй орон зай тул өрөө, хана, лифтний танхимгүй — коридорын
 * контур ба эвакуацийн шатны гарц л. Захирлын ба сервер өрөө барилгад ганц (`unique`); бусад давхарт тэр байрлалд
 * ажлын өрөө ба агуулах.
 */
function createInteriorLayout(
  usage: Usage,
  unique: { director: boolean; server: boolean },
): FloorInteriorLayout {
  const halfW = FOOTPRINT.width / 2;
  const halfD = FOOTPRINT.depth / 2;
  const c = CORRIDOR_HALF_WIDTH;
  const stairInner = halfW - EVAC_STAIR_SIZE; // эвакуацийн шатны коридор талын нүүр (±17)
  const corridor = { x: -stairInner, z: -c, width: 2 * stairInner, depth: 2 * c };
  // Гарц: шатны нүүрэн дээр, коридороос шат руу зугтана
  const exits: EmergencyExit[] = [-1, 1].map((side) => ({
    x: side * stairInner,
    z: 0,
    width: EXIT_WIDTH,
    outward: { x: side, z: 0 },
  }));
  if (usage === 'lobby') {
    return { corridor, liftLobby: null, rooms: [], walls: [], doors: [], exits, airflowPaths: [] };
  }

  const roomInner = halfW - ROOM_WIDTH; // булангийн өрөөний дотор талын хана (±15)
  const roomDoorX = (stairInner + roomInner) / 2; // ±16 — шат ба өрөөний ханын хооронд
  const coreFront = CORE.z + CORE.depth; // −8
  const liftLobby = { x: CORE.x, z: coreFront, width: CORE.width, depth: -c - coreFront };
  const corner = (xSide: number, zSide: number): Rect2D => ({
    x: xSide < 0 ? -halfW : roomInner,
    z: zSide < 0 ? -halfD : c,
    width: ROOM_WIDTH,
    depth: halfD - c,
  });
  const back = (xSide: number): Rect2D => ({
    x: xSide < 0 ? -BACK_ROOM.outer : BACK_ROOM.inner,
    z: -halfD,
    width: BACK_ROOM.outer - BACK_ROOM.inner,
    depth: BACK_ROOM.front + halfD,
  });
  const rooms: InteriorRoom[] = [
    { kind: 'meeting', number: 1, bounds: corner(-1, -1) },
    { kind: 'meeting', number: 2, bounds: corner(1, -1) },
    { kind: unique.director ? 'director' : 'workroom', number: null, bounds: corner(-1, 1) },
    { kind: unique.server ? 'server' : 'storage', number: null, bounds: corner(1, 1) },
    { kind: 'restroom', number: null, bounds: back(-1) },
    { kind: 'kitchen', number: null, bounds: back(1) },
  ];

  const backDoorX = (BACK_ROOM.inner + BACK_ROOM.outer) / 2; // ±11
  const lines = [
    // Коридорын хойд хана: булангийн өрөөний хаалга, лифтний танхим руу нээлттэй хэсэг
    wallLine('x', -c, -stairInner, stairInner, [
      { center: -roomDoorX, width: ROOM_DOOR_WIDTH, kind: 'room' },
      { center: 0, width: CORE.width, kind: 'office' },
      { center: roomDoorX, width: ROOM_DOOR_WIDTH, kind: 'room' },
    ]),
    // Коридорын урд хана: булангийн өрөөний хаалга, нээлттэй оффис Б руу 2 нүх
    wallLine('x', c, -stairInner, stairInner, [
      { center: -roomDoorX, width: ROOM_DOOR_WIDTH, kind: 'room' },
      { center: -OFFICE_OPENING_X, width: OFFICE_OPENING_WIDTH, kind: 'office' },
      { center: OFFICE_OPENING_X, width: OFFICE_OPENING_WIDTH, kind: 'office' },
      { center: roomDoorX, width: ROOM_DOOR_WIDTH, kind: 'room' },
    ]),
    // Булангийн өрөөний дотор хана
    ...[-roomInner, roomInner].flatMap((x) => [
      wallLine('z', x, -halfD, -c, []),
      wallLine('z', x, c, halfD, []),
    ]),
    // Арын өрөө (ариун цэврийн өрөө, гал тогоо): хоёр хажуу хана ба оффис руу хаалгатай урд хана
    ...[-1, 1].flatMap((side) => [
      wallLine('z', side * BACK_ROOM.inner, -halfD, BACK_ROOM.front, []),
      wallLine('z', side * BACK_ROOM.outer, -halfD, BACK_ROOM.front, []),
      wallLine(
        'x',
        BACK_ROOM.front,
        Math.min(side * BACK_ROOM.inner, side * BACK_ROOM.outer),
        Math.max(side * BACK_ROOM.inner, side * BACK_ROOM.outer),
        [{ center: side * backDoorX, width: ROOM_DOOR_WIDTH, kind: 'room' }],
      ),
    ]),
  ];

  // Өрөө бүрээс гарах агаарын урсгал: булангийн өрөөнд гадна хананаас коридор руу, арын өрөөнд хажуугаас хажуу руу
  const cornerX = halfW - ROOM_WIDTH / 2; // ±17.5
  const airflowPaths = [
    ...[-1, 1].flatMap((xSide) =>
      [-1, 1].map((zSide) =>
        roomPath(
          { x: xSide * cornerX, z: zSide * (halfD - 1) },
          { x: xSide * cornerX, z: zSide * (c + 1.5) },
        ),
      ),
    ),
    ...[-1, 1].map((side) =>
      roomPath(
        { x: side * (BACK_ROOM.outer - 1), z: -halfD + 1.5 },
        { x: side * (BACK_ROOM.inner + 1), z: -halfD + 1.5 },
      ),
    ),
  ];

  return {
    corridor,
    liftLobby,
    rooms,
    walls: lines.flatMap((line) => line.walls),
    doors: lines.flatMap((line) => line.doors),
    exits,
    airflowPaths,
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

  const usageByLevel = Array.from(
    { length: floorCount },
    (_, i) => (SPECIAL_FLOORS[i + 1] ?? OFFICE_TEMPLATE).usage,
  );
  const unique = uniqueRoomFloors(usageByLevel);

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
      interior: createInteriorLayout(template.usage, {
        director: level === unique.director,
        server: level === unique.server,
      }),
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
    coreLayout: {
      lifts: CORE_LAYOUT.lifts.map((lift) => ({ ...lift })),
      stair: { ...CORE_LAYOUT.stair },
      doorWidth: CORE_LAYOUT.doorWidth,
    },
    evacuationStairs: EVACUATION_STAIRS.map((stair) => ({ ...stair })),
  };

  return { building, floors, areas, sensors, devices };
}

/** Анхдагч 12 давхрын барилга (үзүүлэх сценарийн суурь, §5.1). */
export const buildingConfig: BuildingConfig = createBuildingConfig();
