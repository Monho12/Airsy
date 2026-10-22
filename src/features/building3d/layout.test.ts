// Тохиргоо → 3D layout (FR-B1, §5.1, §5.1.1, §5.1.2). Хүлээгдэх утгыг тохиргооноос авна (хуулсан тоо биш, §5.5).
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';

import {
  CAMERA_DIRECTION,
  CAMERA_FOV_DEG,
  createBuildingLayout,
  SLAB_THICKNESS,
  ZONE_INSET,
} from './layout';

describe('createBuildingLayout — давхар ба бүс (FR-B1)', () => {
  it.each([6, 12, 20])('%i давхрын тохиргоо → яг тэр тооны давхар, давхар бүрт 2 бүс', (count) => {
    const config = createBuildingConfig(count);
    const layout = createBuildingLayout(config);

    expect(layout.floors.map((floor) => floor.id)).toEqual(config.building.floorIds);
    expect(layout.floors.flatMap((floor) => floor.zones.map((zone) => zone.id))).toEqual(
      config.building.floorIds.flatMap((id) => config.floors[id]!.areaIds),
    );
    expect(layout.height).toBeCloseTo(count * config.building.floorHeight);
  });

  it('анхдагч барилга: 12 давхар, 24 бүс', () => {
    const layout = createBuildingLayout(buildingConfig);
    expect(layout.floors).toHaveLength(12);
    expect(layout.floors.flatMap((floor) => floor.zones)).toHaveLength(24);
  });

  it('давхрын өндөр = (level − 1) × floorHeight, хавтан тэр өндөр дээр (§5.1.1)', () => {
    const layout = createBuildingLayout(buildingConfig);
    const { floorHeight, footprint } = buildingConfig.building;
    for (const floor of layout.floors) {
      const level = buildingConfig.floors[floor.id]!.level;
      expect(floor.level).toBe(level);
      expect(floor.elevation).toBeCloseTo((level - 1) * floorHeight);
      expect(floor.slab.center.y).toBeCloseTo(floor.elevation + SLAB_THICKNESS / 2);
      expect(floor.slab.size).toEqual([footprint.width, SLAB_THICKNESS, footprint.depth]);
    }
    expect(layout.roofSlab.center.y).toBeCloseTo(layout.height + SLAB_THICKNESS / 2);
  });

  it('бүсийн байрлал нь Area.bounds-оос (x, z — бага утгатай булан, D50), хавтан дээр', () => {
    const layout = createBuildingLayout(buildingConfig);
    for (const floor of layout.floors) {
      for (const zone of floor.zones) {
        const { bounds } = buildingConfig.areas[zone.id]!;
        expect(zone.floorId).toBe(floor.id);
        expect(zone.center.x).toBeCloseTo(bounds.x + bounds.width / 2);
        expect(zone.center.z).toBeCloseTo(bounds.z + bounds.depth / 2);
        expect(zone.center.y).toBeGreaterThan(floor.elevation + SLAB_THICKNESS);
        expect(zone.center.y).toBeLessThan(floor.elevation + SLAB_THICKNESS + 0.1);
        expect(zone.size).toEqual([bounds.width - 2 * ZONE_INSET, bounds.depth - 2 * ZONE_INSET]);
      }
    }
  });

  it('хөрш бүсүүд давхцахгүй, хооронд нь харагдах зай үлдэнэ; бүс хавтангаас хэтрэхгүй', () => {
    const { footprint } = buildingConfig.building;
    for (const floor of createBuildingLayout(buildingConfig).floors) {
      const spans = floor.zones
        .map(
          (zone) => [zone.center.z - zone.size[1] / 2, zone.center.z + zone.size[1] / 2] as const,
        )
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i += 1) {
        expect(spans[i]![0] - spans[i - 1]![1]).toBeCloseTo(2 * ZONE_INSET);
      }
      for (const zone of floor.zones) {
        expect(Math.abs(zone.center.x) + zone.size[0] / 2).toBeLessThanOrEqual(footprint.width / 2);
        expect(Math.abs(zone.center.z) + zone.size[1] / 2).toBeLessThanOrEqual(footprint.depth / 2);
      }
    }
  });
});

describe('createBuildingLayout — лифт/шатны хонгил (D59)', () => {
  it.each([1, 12, 20])(
    '%i давхар: Building.core-оос, газраас дээврийн хавтангийн дээд тал хүртэл',
    (count) => {
      const config = createBuildingConfig(count);
      const { core: rect } = config.building;
      const { core, height } = createBuildingLayout(config);
      expect(core.center.x).toBeCloseTo(rect.x + rect.width / 2);
      expect(core.center.z).toBeCloseTo(rect.z + rect.depth / 2);
      expect(core.size[0]).toBe(rect.width);
      expect(core.size[2]).toBe(rect.depth);
      expect(core.center.y - core.size[1] / 2).toBeCloseTo(0);
      expect(core.center.y + core.size[1] / 2).toBeCloseTo(height + SLAB_THICKNESS);
    },
  );

  it('агааржуулалтын сувгаас (shafts) тусдаа — core нь shafts-ийн байрлалаас гаргагдаагүй', () => {
    const config = createBuildingConfig(12);
    const moved = {
      ...config,
      building: {
        ...config.building,
        shafts: { supply: { x: -15, y: 0, z: 9 }, exhaust: { x: 15, y: 0, z: 9 } },
      },
    };
    expect(createBuildingLayout(moved).core).toEqual(createBuildingLayout(config).core);
  });
});

describe('createBuildingLayout — cutaway нүүр ба анхдагч харагдац (§5.1.1, §8.6, FR-B2, FR-B3)', () => {
  it('нүүрний хавтан урд-баруун дөрөвний нэгийг (x > 0, z > 0) бүрхэхгүй', () => {
    const layout = createBuildingLayout(buildingConfig);
    expect(layout.facade).toHaveLength(4);
    for (const panel of layout.facade) {
      // Хавтгай анхдагчаар X дагуу; ±90° эргэвэл Z дагуу
      const alongZ = Math.abs(Math.sin(panel.rotationY)) > 0.5;
      const half = panel.width / 2;
      const xMax = alongZ ? panel.center.x : panel.center.x + half;
      const zMax = alongZ ? panel.center.z + half : panel.center.z;
      // Хавтангийн хэвтээ хэрчимд x > 0 ба z > 0 цэг байвал cutaway-ийг бүрхэнэ
      expect(xMax > 1e-9 && zMax > 1e-9, panel.side).toBe(false);
      expect(panel.height).toBeCloseTo(layout.height);
    }
  });

  it('анхдагч камер урд-баруун талаас, дээрээс барилгын төв рүү', () => {
    const { camera, height } = createBuildingLayout(buildingConfig);
    expect(camera.target).toEqual({ x: 0, y: height / 2, z: 0 });
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.z).toBeGreaterThan(0);
    expect(camera.position.y).toBeGreaterThan(camera.target.y);
  });

  it('D60: анхдагч чиглэл (1, 0.2, 1.35) — босоо өнцөг ≈ 83.2°, камерын хязгаар (5°–85°) дотор', () => {
    expect(CAMERA_DIRECTION).toEqual({ x: 1, y: 0.2, z: 1.35 });
    const { camera } = createBuildingLayout(buildingConfig);
    const offset = {
      x: camera.position.x - camera.target.x,
      y: camera.position.y - camera.target.y,
      z: camera.position.z - camera.target.z,
    };
    const distance = Math.hypot(offset.x, offset.y, offset.z);
    const norm = Math.hypot(CAMERA_DIRECTION.x, CAMERA_DIRECTION.y, CAMERA_DIRECTION.z);
    expect(offset.x / distance).toBeCloseTo(CAMERA_DIRECTION.x / norm);
    expect(offset.y / distance).toBeCloseTo(CAMERA_DIRECTION.y / norm);
    expect(offset.z / distance).toBeCloseTo(CAMERA_DIRECTION.z / norm);
    const polarDeg = (Math.acos(offset.y / distance) * 180) / Math.PI;
    expect(polarDeg).toBeCloseTo(83.2, 1);
    expect(polarDeg).toBeGreaterThan(5);
    expect(polarDeg).toBeLessThan(85);
  });

  it.each([1, 6, 12, 20])('%i давхартай барилга анхдагч харагдацад бүхэлдээ багтана', (count) => {
    const { camera, width, depth, height } = createBuildingLayout(createBuildingConfig(count));
    const distance = Math.hypot(
      camera.position.x - camera.target.x,
      camera.position.y - camera.target.y,
      camera.position.z - camera.target.z,
    );
    const radius = Math.hypot(width, height + SLAB_THICKNESS, depth) / 2;
    expect(radius / distance).toBeLessThanOrEqual(Math.sin((CAMERA_FOV_DEG * Math.PI) / 360));
  });

  it('тодорхой: ижил тохиргоо → ижил layout', () => {
    expect(createBuildingLayout(createBuildingConfig(12))).toEqual(
      createBuildingLayout(createBuildingConfig(12)),
    );
  });
});
