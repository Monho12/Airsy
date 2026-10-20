// Агааржуулалтын төхөөрөмжийн төрөл (CLAUDE.md §5.7, §6.7, §10).
import type { DeviceId, FloorId, SimTimeMs } from './ids';
import type { RuleId } from './control';

export type FanLevel = 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BOOST';
export type DamperPosition = 'CLOSED' | 'MINIMUM' | 'PARTIAL' | 'OPEN';
export type DeviceKind = 'supply_fan' | 'exhaust_fan' | 'outdoor_air_damper';

export type DeviceState =
  | { kind: 'supply_fan'; level: FanLevel }
  | { kind: 'exhaust_fan'; level: FanLevel }
  | { kind: 'outdoor_air_damper'; position: DamperPosition };

export type ControlMode = 'auto' | 'manual' | 'emergency';

export interface ManualOverride {
  state: DeviceState;
  setAt: SimTimeMs;
  expiresAt: SimTimeMs;
}

export interface VentilationDevice {
  id: DeviceId;
  floorId: FloorId;
  kind: DeviceKind;
  name: string; // 'Агаар оруулах сэнс F07'
  state: DeviceState;
  mode: ControlMode;
  manualOverride: ManualOverride | null;
  lastChangedAt: SimTimeMs;
  lastChangeReason: string;
  lastRuleId: RuleId | null;
}
