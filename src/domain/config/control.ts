// Төхөөрөмжийн түвшин → тоон утга ба удирдлагын хамгаалалтын тогтмол (CLAUDE.md §5.7, §6.6, §6.7).
import type { DamperPosition, DeviceKind, DeviceState, FanLevel } from '@/domain/types';

/** Сэнсний түвшний дараалал (§6.4): бага → их. */
export const fanLevelOrder: readonly FanLevel[] = ['OFF', 'LOW', 'MEDIUM', 'HIGH', 'BOOST'];

/** Хаалтын байрлалын дараалал (§6.4): хаалттай → нээлттэй. */
export const damperPositionOrder: readonly DamperPosition[] = [
  'CLOSED',
  'MINIMUM',
  'PARTIAL',
  'OPEN',
];

/** Агаарын урсгалын коэффициент (§5.7) */
export const fanAirflow: Record<FanLevel, number> = {
  OFF: 0.0,
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.8,
  BOOST: 1.0,
};

/** Гадна агаарын хувь (§5.7) */
export const damperOutdoorFraction: Record<DamperPosition, number> = {
  CLOSED: 0.0,
  MINIMUM: 0.2,
  PARTIAL: 0.5,
  OPEN: 1.0,
};

/**
 * Суурь агааржуулалт (§6.3 R-BASELINE; §7.2 S1): SF LOW, EF LOW, OAD MINIMUM. Phase 4-т төхөөрөмж энэ төлөвтөө үлдэнэ
 * (удирдлагын engine Phase 5-д); загварын тэнцвэрийн тохируулга ч үүн дээр тооцогдоно (D68).
 */
export const baselineDeviceStates: Readonly<Record<DeviceKind, DeviceState>> = {
  supply_fan: { kind: 'supply_fan', level: 'LOW' },
  exhaust_fan: { kind: 'exhaust_fan', level: 'LOW' },
  outdoor_air_damper: { kind: 'outdoor_air_damper', position: 'MINIMUM' },
};

export const controlConfig = {
  minStateHoldMs: 30_000, // §6.6 — бууралтыг барих хамгийн бага хугацаа (sim-ms)
  manualOverrideTimeoutMs: 10 * 60_000, // §6.7 — симуляцийн 10 минут
} as const;
