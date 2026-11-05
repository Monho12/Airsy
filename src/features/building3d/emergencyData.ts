// Яаралтай байдлын (S6) 3D тодруулга (CLAUDE.md §6.9, §7.2 S6 «UI», §8.6): галын давхар ба яг дээд/доод (даралт
// үүсгэх) давхрын үүрэг. Зөвхөн дүрслэл — стратегийг удирдлагын engine (`R-EMERGENCY`) шийднэ, энд тооцохгүй.
import type { BuildingConfig } from '@/domain/config/building';
import type { EmergencyState, FloorId } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';

export type EmergencyFloorRole = 'fire' | 'neighbor' | null;

/** Давхрын яаралтай үүрэг: галын давхар, түүний яг дээд/доод давхар, бусад нь `null` (§6.9-ийн хүснэгт) */
export function emergencyFloorRole(
  floorId: FloorId,
  emergency: EmergencyState | null,
  config: BuildingConfig,
): EmergencyFloorRole {
  if (emergency === null) return null;
  if (floorId === emergency.fireFloorId) return 'fire';
  const fireLevel = config.floors[emergency.fireFloorId]?.level;
  const level = config.floors[floorId]?.level;
  if (fireLevel === undefined || level === undefined) return null;
  return Math.abs(level - fireLevel) === 1 ? 'neighbor' : null;
}

/** Нарийн selector: зөвхөн тухайн давхрын үүрэг (мөр) өөрчлөгдөхөд дахин зурагдана (§11.2) */
export function useEmergencyFloorRole(
  floorId: FloorId,
  config: BuildingConfig,
): EmergencyFloorRole {
  return useLiveStore((state) =>
    emergencyFloorRole(floorId, state.snapshot?.control.emergency ?? null, config),
  );
}
