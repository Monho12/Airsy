import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';

import {
  coreFaceLines,
  DOOR_HEIGHT,
  floorInteriorGeometry,
  interiorLabels,
  labelHeight,
  selectedInteriorGeometry,
} from './interiorData';
import { createBuildingLayout, SLAB_THICKNESS } from './layout';

const layout = createBuildingLayout(buildingConfig);
const { floorHeight } = buildingConfig.building;
const halfW = buildingConfig.building.footprint.width / 2;
const halfD = buildingConfig.building.footprint.depth / 2;

/** Оройн y утгууд (x, y, z гурвалын дунд) */
const ys = (values: Float32Array) => values.filter((_, i) => i % 3 === 1);

describe('давхрын дотоод бүтцийн геометр (D86)', () => {
  const interior = buildingConfig.floors.F07!.interior;
  const elevation = 6 * floorHeight;
  const geometry = floorInteriorGeometry(interior, elevation, floorHeight);

  it('хана бүрт 2 гурвалжин, 4 контур шугам; коридор ба лифтний танхимын контур 4 + 4 шугам', () => {
    expect(geometry.wallTriangles.length).toBe(interior.walls.length * 6 * 3);
    expect(geometry.lines.wall.length).toBe((interior.walls.length * 4 + 4 + 4) * 6);
  });

  it('гарцын хүрээ шатны нүүрнээс коридор тийш (тунгалаг бус хонгилд далдлагдахгүй)', () => {
    const exitXs = geometry.lines.exit.filter((_, i) => i % 3 === 0);
    for (const x of exitXs) expect(Math.abs(x)).toBeLessThan(halfW - 3);
  });

  it('зөвхөн өрөөний хаалга хүрээтэй (3 шугам); гарц бүрт хүрээ + сум (5 шугам)', () => {
    const roomDoors = interior.doors.filter((d) => d.kind === 'room').length;
    expect(geometry.lines.door.length).toBe(roomDoors * 3 * 6);
    expect(geometry.lines.exit.length).toBe(interior.exits.length * 5 * 6);
  });

  it('хана тухайн давхрын шалнаас дээд хавтан хүртэл; хаалга 2.1 м', () => {
    const floorY = elevation + SLAB_THICKNESS;
    for (const y of ys(geometry.wallTriangles)) {
      // Float32Array-ийн нарийвчлал (~1e-6)
      expect(y).toBeGreaterThanOrEqual(floorY - 1e-4);
      expect(y).toBeLessThanOrEqual(elevation + floorHeight + 1e-4);
    }
    expect(Math.max(...ys(geometry.lines.door))).toBeCloseTo(floorY + DOOR_HEIGHT);
  });

  it('бүх орой footprint дотор', () => {
    const all = [
      geometry.wallTriangles,
      geometry.lines.wall,
      geometry.lines.door,
      geometry.lines.exit,
    ];
    for (const values of all) {
      for (let i = 0; i < values.length; i += 3) {
        expect(Math.abs(values[i]!)).toBeLessThanOrEqual(halfW + 1e-6);
        expect(Math.abs(values[i + 2]!)).toBeLessThanOrEqual(halfD + 1e-6);
      }
    }
  });

  it('лобби (F01): хана, хаалгагүй — коридорын контур ба гарц л', () => {
    const lobby = floorInteriorGeometry(buildingConfig.floors.F01!.interior, 0, floorHeight);
    expect(lobby.wallTriangles.length).toBe(0);
    expect(lobby.lines.door.length).toBe(0);
    expect(lobby.lines.wall.length).toBe(4 * 6);
    expect(lobby.lines.exit.length).toBeGreaterThan(0);
  });
});

describe('сонгосон давхрын дотоод бүтэц (D86: зөвхөн сонгосон давхарт)', () => {
  it('давхар сонгоогүй эсвэл тохиргоонд алга бол null', () => {
    expect(selectedInteriorGeometry(buildingConfig, layout, null)).toBeNull();
    expect(selectedInteriorGeometry(buildingConfig, layout, 'F99')).toBeNull();
  });

  it('сонгосон давхрын өндрөөр зурна', () => {
    const geometry = selectedInteriorGeometry(buildingConfig, layout, 'F03')!;
    const elevation = 2 * floorHeight;
    expect(Math.min(...ys(geometry.wallTriangles))).toBeCloseTo(elevation + SLAB_THICKNESS);
  });
});

describe('хонгилын нүүрэн дээрх лифт/шатны хуваалт (D86)', () => {
  it('бүтэн өндрийн 2 хуваалт + давхар бүрт 2 лифт × 4 шугам + шатны 2 шугам', () => {
    for (const count of [1, 6, 12, 20]) {
      const config = createBuildingConfig(count);
      const lines = coreFaceLines(config, createBuildingLayout(config));
      expect(lines.length).toBe((2 + count * (2 * 4 + 2)) * 6);
    }
  });

  it('хонгилын урд нүүрэнд (коридор тал), хонгилын x мужид, барилгын өндөр дотор', () => {
    const lines = coreFaceLines(buildingConfig, layout);
    const { core } = buildingConfig.building;
    for (let i = 0; i < lines.length; i += 3) {
      expect(lines[i]!).toBeGreaterThanOrEqual(core.x);
      expect(lines[i]!).toBeLessThanOrEqual(core.x + core.width);
      expect(lines[i + 1]!).toBeGreaterThanOrEqual(0);
      expect(lines[i + 1]!).toBeLessThanOrEqual(layout.core.size[1]);
      expect(lines[i + 2]!).toBeGreaterThan(core.z + core.depth);
    }
  });
});

describe('сонгосон давхрын шошго (D87)', () => {
  it('давхар сонгоогүй бол хоосон', () => {
    expect(interiorLabels(buildingConfig, layout, null)).toEqual([]);
  });

  it('оффис давхарт: 6 өрөө, лифт, шат, 2 гарц, 2 нээлттэй оффис; өвөрмөц түлхүүр', () => {
    const labels = interiorLabels(buildingConfig, layout, 'F07');
    const kinds = labels.map((l) => l.kind);
    expect(kinds.filter((k) => k === 'meeting')).toHaveLength(2);
    for (const kind of ['workroom', 'storage', 'restroom', 'kitchen', 'lift', 'stair'] as const) {
      expect(kinds.filter((k) => k === kind)).toHaveLength(1);
    }
    expect(kinds.filter((k) => k === 'exit')).toHaveLength(2);
    expect(labels.filter((l) => l.kind === 'office').map((l) => l.areaId)).toEqual([
      'F07-A',
      'F07-B',
    ]);
    expect(new Set(labels.map((l) => l.key)).size).toBe(labels.length);
  });

  it('шошго тухайн давхрын шал ба таазны хооронд, footprint дотор', () => {
    const elevation = 6 * floorHeight;
    for (const label of interiorLabels(buildingConfig, layout, 'F07')) {
      expect(label.position.y).toBeGreaterThan(elevation + SLAB_THICKNESS);
      expect(label.position.y).toBeLessThan(elevation + floorHeight);
      expect(Math.abs(label.position.x)).toBeLessThanOrEqual(halfW);
      expect(Math.abs(label.position.z)).toBeLessThanOrEqual(halfD);
    }
  });

  it('шошгоны өндөр гүнээр шатлана: арын шошго урдынхаас өндөр, шал ба таазны хооронд', () => {
    expect(labelHeight(-10)).toBeGreaterThan(labelHeight(0));
    expect(labelHeight(0)).toBeGreaterThan(labelHeight(9));
    for (const z of [-12, -6, 0, 6, 12]) {
      expect(labelHeight(z)).toBeGreaterThanOrEqual(0.6);
      expect(labelHeight(z)).toBeLessThan(floorHeight - SLAB_THICKNESS);
    }
  });

  it('лобби (F01): өрөөний шошгогүй — лифт, шат, гарц, бүс л', () => {
    const kinds = interiorLabels(buildingConfig, layout, 'F01').map((l) => l.kind);
    expect(kinds.sort()).toEqual(['exit', 'exit', 'lift', 'office', 'office', 'stair']);
  });
});

describe('хонгилын шугам сонгосон давхрын таазаар хязгаарлагдана (D88)', () => {
  it('тааз хүртэлх давхрын шугам л; бүх орой тааз хүртэл', () => {
    const maxY = 7 * floorHeight;
    const lines = coreFaceLines(buildingConfig, layout, maxY);
    expect(lines.length).toBe((2 + 7 * (2 * 4 + 2)) * 6);
    for (let i = 1; i < lines.length; i += 3) expect(lines[i]!).toBeLessThanOrEqual(maxY + 1e-6);
  });
});
