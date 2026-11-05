import { describe, expect, it } from 'vitest';

import { classifyReading } from '@/domain/classification';

import {
  METRICS,
  buildingConfig,
  createBuildingConfig,
  DIRECTOR_FLOOR_LEVEL,
  OUTDOOR_METRICS,
} from './building';
import { indoorThresholds } from './thresholds';

describe('createBuildingConfig (§5.1, §5.2, FR-B1)', () => {
  it('анхдагч 12 давхар: F01–F12, 24 бүс, 120 дотоод + 3 гадна мэдрэгч, 36 төхөөрөмж', () => {
    const { building, floors, areas, sensors, devices } = buildingConfig;
    expect(building.id).toBe('aeris-tower');
    expect(building.floorIds).toEqual(
      Array.from({ length: 12 }, (_, i) => `F${String(i + 1).padStart(2, '0')}`),
    );
    expect(Object.keys(floors)).toHaveLength(12);
    expect(Object.keys(areas)).toHaveLength(24);
    const all = Object.values(sensors);
    expect(all.filter((s) => s.location === 'indoor')).toHaveLength(120);
    expect(building.outdoorSensorIds).toEqual(OUTDOOR_METRICS.map((m) => `OUT-${m}`));
    expect(Object.keys(devices)).toHaveLength(36);
  });

  it('ID нь §5.2-ын загвартай бөгөөд объектуудын хооронд тууштай', () => {
    const { floors, areas, sensors, devices } = buildingConfig;
    const floor = floors.F07!;
    expect(floor.areaIds).toEqual(['F07-A', 'F07-B']);
    expect(floor.deviceIds).toEqual(['F07-SF', 'F07-EF', 'F07-OAD']);
    expect(devices['F07-OAD']).toEqual({
      id: 'F07-OAD',
      floorId: 'F07',
      kind: 'outdoor_air_damper',
    });
    for (const metric of METRICS) {
      expect(sensors[`F07-A-${metric}`]).toMatchObject({
        floorId: 'F07',
        areaId: 'F07-A',
        metric,
        location: 'indoor',
      });
    }
    for (const area of Object.values(areas)) {
      expect(floors[area.floorId]!.areaIds).toContain(area.id);
    }
  });

  it('§5.1-ийн давхрын нэр, хэрэглээ, бүс', () => {
    const { floors, areas } = buildingConfig;
    expect(floors.F01).toMatchObject({ name: 'Лобби ба хүлээн авах', usage: 'lobby' });
    expect(floors.F02).toMatchObject({ name: 'Хурлын төв', usage: 'conference' });
    expect(floors.F05).toMatchObject({ name: 'Оффис', usage: 'office' });
    expect(floors.F11).toMatchObject({ name: 'Судалгааны лаборатори', usage: 'lab' });
    expect(floors.F12).toMatchObject({ name: 'Дээд давхрын лоунж', usage: 'lounge' });
    expect([areas['F02-A']!.name, areas['F02-B']!.name]).toEqual(['Их танхим', 'Хурлын өрөөнүүд']);
  });

  it('6 давхар → хүснэгтийн эхний 6; 20 давхар → 13–20 нь «Оффис»', () => {
    expect(createBuildingConfig(6).building.floorIds).toEqual([
      'F01',
      'F02',
      'F03',
      'F04',
      'F05',
      'F06',
    ]);
    const tall = createBuildingConfig(20);
    expect(tall.building.floorIds).toHaveLength(20);
    for (const level of [13, 17, 20]) {
      const id = `F${level}`;
      expect(tall.floors[id]).toMatchObject({ name: 'Оффис', usage: 'office', level });
      expect(tall.areas[`${id}-A`]!.name).toBe('Нээлттэй оффис (хойд)');
      expect(tall.areas[`${id}-B`]!.name).toBe('Нээлттэй оффис (урд)');
    }
    expect(Object.keys(tall.sensors)).toHaveLength(20 * 2 * 5 + 3);
  });

  it.each([0, 21, 2.5, Number.NaN, -1])('давхрын тоо %s → RangeError', (count) => {
    expect(() => createBuildingConfig(count)).toThrow(RangeError);
  });
});

describe('§5.1.2-ын прототипийн утга (D50)', () => {
  const { building, areas, floors } = buildingConfig;

  it('барилга: 40 × 24 м, 3.6 м давхар, сувгууд арын хэсэгт (cutaway-ээс гадна)', () => {
    expect(building.footprint).toEqual({ width: 40, depth: 24 });
    expect(building.floorHeight).toBe(3.6);
    for (const shaft of [building.shafts.supply, building.shafts.exhaust])
      expect(shaft.z).toBeLessThan(0);
  });

  it('бүс: footprint дотор, тэмдэг бүсийн дотор ба x < 0 (cutaway-ийн ард нуугдахгүй), эзлэхүүн 1440 м³', () => {
    for (const area of Object.values(areas)) {
      const { bounds, markerPosition } = area;
      expect(bounds.x).toBeGreaterThanOrEqual(-building.footprint.width / 2);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(building.footprint.width / 2);
      expect(bounds.z).toBeGreaterThanOrEqual(-building.footprint.depth / 2);
      expect(bounds.z + bounds.depth).toBeLessThanOrEqual(building.footprint.depth / 2);
      expect(markerPosition.x).toBeGreaterThan(bounds.x);
      expect(markerPosition.x).toBeLessThan(0);
      expect(markerPosition.z).toBeGreaterThan(bounds.z);
      expect(markerPosition.z).toBeLessThan(bounds.z + bounds.depth);
      expect(area.volumeM3).toBe(1440);
      // §5.1.2: 0.5–0.7; F02 нь 0.45 (D80)
      expect(area.baselineOccupancy).toBeGreaterThanOrEqual(area.floorId === 'F02' ? 0.45 : 0.5);
      expect(area.baselineOccupancy).toBeLessThanOrEqual(0.7);
    }
  });

  it('суурь утга S1-ийн дотоод мужид (§7.2, зориуд бэхэлсэн) ба анхааруулгын босгоос доош (normal)', () => {
    const s1: Record<string, [number, number]> = {
      temperature: [21, 24],
      co2: [500, 800],
      humidity: [40, 50],
      pm25: [3, 8],
      voc: [80, 120],
    };
    for (const area of Object.values(areas)) {
      for (const metric of METRICS) {
        const value = area.baseline[metric];
        const [min, max] = s1[metric]!;
        expect(value, `${area.id} ${metric}`).toBeGreaterThanOrEqual(min);
        expect(value, `${area.id} ${metric}`).toBeLessThanOrEqual(max);
        expect(classifyReading(metric, value, 'online', null, indoorThresholds).status).toBe(
          'normal',
        );
      }
    }
  });

  it('лабораторийн VOC суурь 115 (D50); бусад оффис 100', () => {
    expect(areas['F11-A']!.baseline.voc).toBe(115);
    expect(areas['F11-B']!.baseline.voc).toBe(115);
    expect(areas['F07-A']!.baseline.voc).toBe(100);
  });

  it('агааржуулалтын байрлал давхар бүрт ижил, бүс бүрт нэг урсгалын зам', () => {
    const layouts = Object.values(floors).map((floor) => floor.ventilation);
    for (const layout of layouts) expect(layout).toEqual(layouts[0]);
    expect(layouts[0]!.airflowPaths).toHaveLength(2);
  });
});

describe('§5.1.2: лифт/шатны хонгил (D59)', () => {
  const { building, areas, floors } = buildingConfig;
  const { core } = building;
  const CLEARANCE = 2; // м — D59-ийн шаардлага
  /** Цэгээс core-ийн тэгш өнцөгт хүртэлх хэвтээ зай (дотор бол 0) */
  const distanceToCore = ({ x, z }: { x: number; z: number }) =>
    Math.hypot(
      Math.max(core.x - x, 0, x - (core.x + core.width)),
      Math.max(core.z - z, 0, z - (core.z + core.depth)),
    );

  it('D59-ийн батлагдсан утга', () => {
    expect(core).toEqual({ x: -4, z: -12, width: 8, depth: 4 });
  });

  it('footprint дотор, урд-баруун cutaway-аас (x > 0, z > 0) гадна', () => {
    const { width, depth } = building.footprint;
    expect(core.x).toBeGreaterThanOrEqual(-width / 2);
    expect(core.x + core.width).toBeLessThanOrEqual(width / 2);
    expect(core.z).toBeGreaterThanOrEqual(-depth / 2);
    expect(core.z + core.depth).toBeLessThanOrEqual(depth / 2);
    expect(core.z + core.depth).toBeLessThanOrEqual(0);
  });

  it('агааржуулалтын суваг (shafts) — тусдаа объект, core-той давхцахгүй', () => {
    for (const shaft of [building.shafts.supply, building.shafts.exhaust]) {
      expect(distanceToCore(shaft)).toBeGreaterThanOrEqual(CLEARANCE);
    }
  });

  it('төхөөрөмж, supply/exhaust цэг, мэдрэгчийн тэмдэгтэй давхцахгүй (≥ 2 м)', () => {
    const points = [
      ...Object.values(floors).flatMap((floor) => [
        ...Object.values(floor.ventilation.devicePositions),
        ...floor.ventilation.supplyPoints,
        ...floor.ventilation.exhaustPoints,
      ]),
      ...Object.values(areas).map((area) => area.markerPosition),
    ];
    for (const point of points) expect(distanceToCore(point)).toBeGreaterThanOrEqual(CLEARANCE);
  });

  it('агаарын урсгалын замын хэрчим бүр core-оос ≥ 2 м (airflowPaths өөрчлөгдөөгүй)', () => {
    for (const floor of Object.values(floors)) {
      for (const path of floor.ventilation.airflowPaths) {
        for (let i = 1; i < path.length; i += 1) {
          const [a, b] = [path[i - 1]!, path[i]!];
          // Хэрчмийг нягт түүвэрлэж шалгана (замууд шулуун, богино)
          for (let t = 0; t <= 1; t += 0.01) {
            const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
            expect(distanceToCore(point)).toBeGreaterThanOrEqual(CLEARANCE);
          }
        }
      }
    }
  });

  it.each([1, 6, 20])('давхрын тооноос хамаарахгүй (%i давхар)', (count) => {
    expect(createBuildingConfig(count).building.core).toEqual(core);
  });
});

describe('дотоод бүтэц, хонгил, эвакуацийн шат (D86, D87)', () => {
  const { building, areas, floors } = buildingConfig;
  const halfW = building.footprint.width / 2;
  const halfD = building.footprint.depth / 2;
  type Rect = { x: number; z: number; width: number; depth: number };
  const inside = (r: Rect, p: { x: number; z: number }) =>
    p.x > r.x && p.x < r.x + r.width && p.z > r.z && p.z < r.z + r.depth;
  const overlaps = (a: Rect, b: Rect) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.z < b.z + b.depth && b.z < a.z + a.depth;
  /** Цэгээс хэрчим хүртэлх хэвтээ зай */
  const distanceToSegment = (
    p: { x: number; z: number },
    s: { x1: number; z1: number; x2: number; z2: number },
  ) => {
    const dx = s.x2 - s.x1;
    const dz = s.z2 - s.z1;
    const t = Math.max(
      0,
      Math.min(1, ((p.x - s.x1) * dx + (p.z - s.z1) * dz) / (dx * dx + dz * dz)),
    );
    return Math.hypot(p.x - (s.x1 + dx * t), p.z - (s.z1 + dz * t));
  };
  /** Замын хэрчмийг нягт түүвэрлэнэ */
  const samplePath = (path: { x: number; z: number }[]) =>
    path.slice(1).flatMap((b, i) => {
      const a = path[i]!;
      return Array.from({ length: 51 }, (_, k) => ({
        x: a.x + ((b.x - a.x) * k) / 50,
        z: a.z + ((b.z - a.z) * k) / 50,
      }));
    });
  const solids = [building.core, ...building.evacuationStairs];

  it('оффис давхар: 6 өрөө (хурлын 1, 2, ажлын өрөө, агуулах, ариун цэврийн, гал тогоо), лифтний танхим, 2 гарц', () => {
    const interior = floors.F07!.interior;
    expect(interior.rooms.map((r) => `${r.kind}${r.number ?? ''}`)).toEqual([
      'meeting1',
      'meeting2',
      'workroom',
      'storage',
      'restroom',
      'kitchen',
    ]);
    expect(interior.liftLobby).not.toBeNull();
    expect(interior.exits).toHaveLength(2);
    expect(interior.airflowPaths).toHaveLength(6);
    expect(interior.doors.filter((d) => d.kind === 'room')).toHaveLength(6);
  });

  it('лобби (F01): өрөө, хана, лифтний танхим, өрөөний урсгалгүй; коридор ба гарц л', () => {
    const interior = floors.F01!.interior;
    expect(interior.rooms).toEqual([]);
    expect(interior.walls).toEqual([]);
    expect(interior.doors).toEqual([]);
    expect(interior.liftLobby).toBeNull();
    expect(interior.airflowPaths).toEqual([]);
    expect(interior.exits).toHaveLength(2);
  });

  it('өрөө footprint дотор, хоорондоо ба хонгил/шаттай давхцахгүй', () => {
    for (const floor of Object.values(floors)) {
      const rects = floor.interior.rooms.map((r) => r.bounds);
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(-halfW);
        expect(r.x + r.width).toBeLessThanOrEqual(halfW);
        expect(r.z).toBeGreaterThanOrEqual(-halfD);
        expect(r.z + r.depth).toBeLessThanOrEqual(halfD);
        for (const solid of solids) expect(overlaps(r, solid)).toBe(false);
      }
      rects.forEach((a, i) =>
        rects.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)),
      );
    }
  });

  it('эвакуацийн шат коридорын хоёр үзүүрт, гарц шатны нүүрэнд, зугтах чиглэл шат руу', () => {
    expect(building.evacuationStairs).toHaveLength(2);
    for (const floor of Object.values(floors)) {
      const { exits, corridor } = floor.interior;
      for (const exit of exits) {
        const stair = building.evacuationStairs.find((s) =>
          inside(
            { x: s.x - 0.01, z: s.z, width: s.width + 0.02, depth: s.depth },
            { x: exit.x, z: exit.z },
          ),
        );
        expect(stair).toBeDefined();
        expect(Math.abs(exit.x)).toBe(corridor.x + corridor.width);
        // Гарцаас зугтах чиглэлд нэг алхам — шатны дотор
        expect(inside(stair!, { x: exit.x + exit.outward.x, z: exit.z + exit.outward.z })).toBe(
          true,
        );
      }
    }
  });

  it('хаалганы нүх хананд таслагдсан (нүхний төвөөс хана ≥ хагас өргөн)', () => {
    const { walls, doors } = floors.F07!.interior;
    for (const door of doors) {
      // Зөвхөн хаалгатай ижил шугам дээрх хана (эсрэг талын хана хамаарахгүй)
      const sameLine = walls.filter((w) =>
        door.axis === 'x' ? w.z1 === door.z && w.z2 === door.z : w.x1 === door.x && w.x2 === door.x,
      );
      expect(sameLine.length).toBeGreaterThan(0);
      for (const wall of sameLine) {
        expect(distanceToSegment(door, wall)).toBeGreaterThanOrEqual(door.width / 2 - 1e-9);
      }
    }
  });

  it('мэдрэгчийн тэмдэг, supply/exhaust цэг, төхөөрөмж өрөөн дотор биш ба хананаас ≥ 1 м', () => {
    for (const floor of Object.values(floors)) {
      const points = [
        ...floor.areaIds.map((id) => areas[id]!.markerPosition),
        ...floor.ventilation.supplyPoints,
        ...floor.ventilation.exhaustPoints,
        ...Object.values(floor.ventilation.devicePositions),
      ];
      for (const p of points) {
        for (const room of floor.interior.rooms) expect(inside(room.bounds, p)).toBe(false);
        for (const wall of floor.interior.walls) {
          expect(distanceToSegment(p, wall)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('оффисын ба өрөөний агаарын урсгалын зам хананаас ≥ 1 м', () => {
    for (const floor of Object.values(floors)) {
      const paths = [...floor.ventilation.airflowPaths, ...floor.interior.airflowPaths];
      for (const path of paths) {
        for (const p of samplePath(path)) {
          for (const wall of floor.interior.walls) {
            expect(distanceToSegment(p, wall)).toBeGreaterThanOrEqual(1 - 1e-9);
          }
        }
      }
    }
  });

  it('өрөөний урсгал тухайн өрөөн дотор (өрөө бүрт нэг)', () => {
    const { rooms, airflowPaths } = floors.F07!.interior;
    for (const room of rooms) {
      const own = airflowPaths.filter((path) => path.every((p) => inside(room.bounds, p)));
      expect(own).toHaveLength(1);
    }
  });

  it('хонгил: 2 лифт + шат core-ийг давхцалгүй бүрэн хуваана', () => {
    const { core, coreLayout } = building;
    const parts = [...coreLayout.lifts, coreLayout.stair];
    expect(coreLayout.lifts).toHaveLength(2);
    expect(parts.reduce((sum, p) => sum + p.width * p.depth, 0)).toBe(core.width * core.depth);
    const sorted = [...parts].sort((a, b) => a.x - b.x);
    expect(sorted[0]!.x).toBe(core.x);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]!.x).toBe(sorted[i - 1]!.x + sorted[i - 1]!.width);
    }
    expect(sorted.at(-1)!.x + sorted.at(-1)!.width).toBe(core.x + core.width);
  });

  it('эвакуацийн шат footprint дотор, урсгалын зам, мэдрэгч, төхөөрөмжөөс хол', () => {
    for (const stair of building.evacuationStairs) {
      expect(stair.x).toBeGreaterThanOrEqual(-halfW);
      expect(stair.x + stair.width).toBeLessThanOrEqual(halfW);
      for (const floor of Object.values(floors)) {
        const points = [
          ...floor.areaIds.map((id) => areas[id]!.markerPosition),
          ...floor.ventilation.supplyPoints,
          ...floor.ventilation.exhaustPoints,
          ...[...floor.ventilation.airflowPaths, ...floor.interior.airflowPaths].flatMap(
            samplePath,
          ),
        ];
        for (const p of points) expect(inside(stair, p)).toBe(false);
      }
    }
  });

  it.each([1, 6, 20])('давхрын тоо бүрт дотоод бүтэцтэй (%i давхар)', (count) => {
    const config = createBuildingConfig(count);
    expect(config.building.evacuationStairs).toEqual(building.evacuationStairs);
    for (const floor of Object.values(config.floors)) {
      expect(floor.interior.exits).toHaveLength(2);
      expect(floor.interior.rooms).toHaveLength(floor.usage === 'lobby' ? 0 : 6);
    }
  });
});

describe('ганц өрөө: захирлын өрөө ба сервер өрөө (D88)', () => {
  const countKind = (config: ReturnType<typeof createBuildingConfig>, kind: string) =>
    Object.values(config.floors).flatMap((f) =>
      f.interior.rooms.filter((r) => r.kind === kind).map(() => f.id),
    );

  it('12 давхарт: захирлын өрөө зөвхөн F10, сервер өрөө зөвхөн F03 (хамгийн доод оффис давхар)', () => {
    expect(DIRECTOR_FLOOR_LEVEL).toBe(10);
    expect(countKind(buildingConfig, 'director')).toEqual(['F10']);
    expect(countKind(buildingConfig, 'server')).toEqual(['F03']);
    // Бусад давхарт тэр байрлалд ажлын өрөө ба агуулах
    expect(countKind(buildingConfig, 'workroom')).toHaveLength(10);
    expect(countKind(buildingConfig, 'storage')).toHaveLength(10);
  });

  it.each([
    [20, 'F10', 'F03'],
    [6, 'F06', 'F03'],
    [2, 'F02', 'F02'],
    [1, null, null],
  ] as const)('%i давхарт: захирал %s, сервер %s — ганц', (count, director, server) => {
    const config = createBuildingConfig(count);
    expect(countKind(config, 'director')).toEqual(director === null ? [] : [director]);
    expect(countKind(config, 'server')).toEqual(server === null ? [] : [server]);
  });
});
