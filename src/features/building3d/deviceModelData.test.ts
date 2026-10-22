// Төхөөрөмжийн загварын байрлал ба төлөвийн дүрслэл (§5.7, §8.6, FR-B6). WebGL-гүй.
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { damperOutdoorFraction, fanLevelOrder } from '@/domain/config/control';
import type { DeviceState, LiveSnapshot } from '@/domain/types';
import { createMockSnapshot } from '@/store/mockSnapshot';

import { createDeviceModels, deviceVisualStates, FAN_LEVEL_SEGMENTS } from './deviceModelData';
import { createBuildingLayout } from './layout';

const layout = createBuildingLayout(buildingConfig);
const models = createDeviceModels(buildingConfig, layout);

/** Mock snapshot-ийн нэг төхөөрөмжийн төлөвийг сольсон хуулбар */
function withState(deviceId: string, state: DeviceState): LiveSnapshot['devices'] {
  const devices = structuredClone(createMockSnapshot().devices);
  devices[deviceId] = { ...devices[deviceId]!, state };
  return devices;
}
const visualOf = (devices: LiveSnapshot['devices'] | null, deviceId: string) =>
  deviceVisualStates(devices, models)[models.findIndex((m) => m.deviceId === deviceId)]!;

describe('createDeviceModels — байрлал (§5.1.1, §5.7)', () => {
  it.each([6, 12, 20])('%i давхар: давхар бүрт SF, EF, OAD — давхрын дарааллаар', (count) => {
    const config = createBuildingConfig(count);
    const result = createDeviceModels(config, createBuildingLayout(config));
    expect(result).toHaveLength(count * 3);
    expect(result.map((m) => m.deviceId)).toEqual(
      config.building.floorIds.flatMap((floorId) => config.floors[floorId]!.deviceIds),
    );
  });

  it('байрлал = devicePositions, y нь давхрын шалны өндрөөс (давхардсан өгөгдөлгүй)', () => {
    for (const model of models) {
      const floor = buildingConfig.floors[model.floorId]!;
      const elevation = layout.floors.find((f) => f.id === model.floorId)!.elevation;
      const local = floor.ventilation.devicePositions[model.kind];
      expect(model.kind).toBe(buildingConfig.devices[model.deviceId]!.kind);
      expect(model.position).toEqual({ x: local.x, y: elevation + local.y, z: local.z });
    }
  });

  it('төхөөрөмж давхрын хооронд (шалнаас дээш, дараагийн давхрын шалнаас доош)', () => {
    const { floorHeight } = buildingConfig.building;
    for (const model of models) {
      const elevation = layout.floors.find((f) => f.id === model.floorId)!.elevation;
      expect(model.position.y).toBeGreaterThan(elevation);
      expect(model.position.y).toBeLessThan(elevation + floorHeight);
    }
  });
});

describe('deviceVisualStates — snapshot-ийн төлөв (FR-B6)', () => {
  const baseline = createMockSnapshot().devices;

  it('mock-ийн суурь төлөв: SF/EF LOW → ажиллаж буй, 1 заагч; OAD MINIMUM → 0.2 × 90°', () => {
    expect(visualOf(baseline, 'F07-SF')).toEqual({
      kind: 'fan',
      known: true,
      running: true,
      litSegments: 1,
    });
    expect(visualOf(baseline, 'F07-EF')).toMatchObject({
      kind: 'fan',
      known: true,
      litSegments: 1,
    });
    expect(visualOf(baseline, 'F07-OAD')).toEqual({
      kind: 'damper',
      known: true,
      louverAngle: damperOutdoorFraction.MINIMUM * (Math.PI / 2),
    });
  });

  it.each(fanLevelOrder.map((level, index) => [level, index] as const))(
    'сэнс %s → %i заагч гэрэлтэнэ',
    (level, lit) => {
      const visual = visualOf(withState('F02-SF', { kind: 'supply_fan', level }), 'F02-SF');
      expect(visual).toEqual({
        kind: 'fan',
        known: true,
        running: level !== 'OFF',
        litSegments: lit,
      });
    },
  );

  it('BOOST нь бүх заагчийг гэрэлтүүлнэ', () => {
    expect(FAN_LEVEL_SEGMENTS).toBe(4);
    const visual = visualOf(withState('F02-EF', { kind: 'exhaust_fan', level: 'BOOST' }), 'F02-EF');
    expect(visual).toMatchObject({ litSegments: FAN_LEVEL_SEGMENTS });
  });

  it('хаалт: CLOSED → босоо (0), OPEN → хэвтээ (π/2)', () => {
    const closed = withState('F02-OAD', { kind: 'outdoor_air_damper', position: 'CLOSED' });
    const open = withState('F02-OAD', { kind: 'outdoor_air_damper', position: 'OPEN' });
    expect(visualOf(closed, 'F02-OAD')).toMatchObject({ louverAngle: 0 });
    expect(visualOf(open, 'F02-OAD')).toMatchObject({ louverAngle: Math.PI / 2 });
  });

  it('snapshot байхгүй (ачаалж байна) → бүгд мэдэгдэхгүй, төлөв таамаглахгүй', () => {
    expect(deviceVisualStates(null, models).every((v) => !v.known)).toBe(true);
  });

  it('snapshot-д байхгүй төхөөрөмж (20 давхрын тохиргоо, 13–20) → мэдэгдэхгүй', () => {
    const config = createBuildingConfig(20);
    const tall = createDeviceModels(config, createBuildingLayout(config));
    const visuals = deviceVisualStates(baseline, tall);
    tall.forEach((model, i) => {
      expect(visuals[i]!.known).toBe(model.deviceId in baseline);
    });
    expect(visuals.filter((v) => !v.known)).toHaveLength(8 * 3);
  });

  it('төрөл зөрсөн төлөв → мэдэгдэхгүй (сэнсийг хаалт гэж зурахгүй)', () => {
    const wrong = withState('F02-SF', { kind: 'outdoor_air_damper', position: 'OPEN' });
    expect(visualOf(wrong, 'F02-SF')).toEqual({ kind: 'fan', known: false });
  });
});
