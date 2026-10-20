import { describe, expect, it } from 'vitest';

import { classifyReading } from '@/domain/classification';

import { METRICS, buildingConfig, createBuildingConfig, OUTDOOR_METRICS } from './building';
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
      expect(area.baselineOccupancy).toBeGreaterThanOrEqual(0.5);
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
