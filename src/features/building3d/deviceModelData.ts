// Агааржуулалтын төхөөрөмжийн загвар (CLAUDE.md §5.7, §8.6, FR-B6): давхар бүрийн SF/EF/OAD.
// Байрлал нь `Floor.ventilation.devicePositions`-оос (давхрын шалнаас, §5.1.1), төлөв нь snapshot-оос.
// Phase 3-т хөдөлгөөнгүй — сэнсний эргэлт, ламелийн шилжилт Phase 5-д (§13).
import type { BuildingConfig } from '@/domain/config/building';
import { damperOutdoorFraction, fanLevelOrder } from '@/domain/config/control';
import type { DeviceId, DeviceKind, FloorId, LiveSnapshot, Vec3 } from '@/domain/types';

import type { BuildingLayout } from './layout';

/** Сэнсний түвшний заагчийн тоо: LOW 1 … BOOST 4 (OFF — нэг ч гэрэлгүй) */
export const FAN_LEVEL_SEGMENTS = fanLevelOrder.length - 1;

export interface DeviceModelLayout {
  deviceId: DeviceId;
  floorId: FloorId;
  kind: DeviceKind;
  /** Барилгын координат: x/z = devicePositions, y = давхрын шалны өндөр + devicePositions.y */
  position: Vec3;
}

/** Дараалал: layout-ийн давхар → `Floor.deviceIds`-ийн дараалал (тогтвортой). */
export function createDeviceModels(
  config: BuildingConfig,
  layout: BuildingLayout,
): DeviceModelLayout[] {
  return layout.floors.flatMap((floorLayout) => {
    const floor = config.floors[floorLayout.id];
    if (floor === undefined) throw new Error(`Давхар тохиргоонд алга: ${floorLayout.id}`);
    return floor.deviceIds.map((deviceId): DeviceModelLayout => {
      const device = config.devices[deviceId];
      if (device === undefined) throw new Error(`Төхөөрөмж тохиргоонд алга: ${deviceId}`);
      const { x, y, z } = floor.ventilation.devicePositions[device.kind];
      return {
        deviceId,
        floorId: floor.id,
        kind: device.kind,
        position: { x, y: floorLayout.elevation + y, z },
      };
    });
  });
}

/** Загварын харагдах төлөв. `known: false` бол төлөв мэдэгдэхгүй — дүрслэл таамаглахгүй (зөвхөн саарал хүрээ). */
export type FanVisual =
  | { kind: 'fan'; known: true; running: boolean; litSegments: number }
  | { kind: 'fan'; known: false };
export type DamperVisual =
  { kind: 'damper'; known: true; louverAngle: number } | { kind: 'damper'; known: false };
export type DeviceVisualState = FanVisual | DamperVisual;

const unknownVisual = (kind: DeviceKind): DeviceVisualState =>
  kind === 'outdoor_air_damper' ? { kind: 'damper', known: false } : { kind: 'fan', known: false };

/**
 * Snapshot-ийн `VentilationDevice.state`-ийг дүрслэлд буулгана. Сэнс: түвшин → гэрэлтэх заагчийн тоо
 * (`fanLevelOrder`-ийн индекс). Хаалт: гадна агаарын хувь (§5.7) × 90° — 0 = босоо (хаалттай), π/2 = хэвтээ (нээлттэй).
 */
export function deviceVisualStates(
  devices: LiveSnapshot['devices'] | null,
  models: readonly DeviceModelLayout[],
): DeviceVisualState[] {
  return models.map(({ deviceId, kind }): DeviceVisualState => {
    const state = devices?.[deviceId]?.state;
    // Төхөөрөмж snapshot-д байхгүй эсвэл төрөл зөрвөл — мэдэгдэхгүй
    if (state === undefined || state.kind !== kind) return unknownVisual(kind);
    if (state.kind === 'outdoor_air_damper') {
      return {
        kind: 'damper',
        known: true,
        louverAngle: damperOutdoorFraction[state.position] * (Math.PI / 2),
      };
    }
    return {
      kind: 'fan',
      known: true,
      running: state.level !== 'OFF',
      litSegments: fanLevelOrder.indexOf(state.level),
    };
  });
}
