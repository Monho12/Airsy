// Төхөөрөмжийн төлөвийн БҮХ өөрчлөлтийн цорын ганц зам (CLAUDE.md §6.2): автомат, гар, яаралтай.
// Шинэ төхөөрөмжийн объект ба яг нэг үйл явдлыг хамт буцаана — юу ч чимээгүй өөрчлөгдөхгүй.
import type { SystemEventDraft } from '@/domain/events/eventLog';
import { mn } from '@/domain/i18n/mn';
import type {
  ControlMode,
  DeviceState,
  ManualOverride,
  RuleId,
  SimTimeMs,
  VentilationDevice,
} from '@/domain/types';

import { stateLabel } from './levels';

export type DeviceCommandSource =
  | { kind: 'auto'; ruleId: RuleId; reason: string; trigger?: string }
  | { kind: 'emergency'; reason: string }
  | { kind: 'manual'; override: ManualOverride };

export interface DeviceCommandResult {
  device: VentilationDevice;
  event: SystemEventDraft;
}

export function applyDeviceCommand(
  device: VentilationDevice,
  state: DeviceState,
  source: DeviceCommandSource,
  now: SimTimeMs,
): DeviceCommandResult {
  if (state.kind !== device.kind) {
    throw new Error(`applyDeviceCommand: төрөл зөрсөн (${device.id}: ${state.kind})`);
  }
  const from = stateLabel(device.state);
  const to = stateLabel(state);

  if (source.kind === 'manual') {
    const reason = mn.control.manualSetReason(to);
    return {
      device: {
        ...device,
        state,
        mode: 'manual',
        manualOverride: source.override,
        lastChangedAt: now,
        lastChangeReason: reason,
        lastRuleId: 'R-MANUAL',
      },
      event: {
        timestamp: now,
        type: 'MANUAL_OVERRIDE_SET',
        category: 'operator',
        severity: 'info',
        message: mn.events.manualOverrideSet(device.name, from, to),
        floorId: device.floorId,
        deviceId: device.id,
        ruleId: 'R-MANUAL',
        previousState: device.state,
        newState: state,
        reason,
        actor: 'operator',
      },
    };
  }

  const ruleId: RuleId = source.kind === 'emergency' ? 'R-EMERGENCY' : source.ruleId;
  const mode: ControlMode = source.kind === 'emergency' ? 'emergency' : device.mode;
  return {
    device: {
      ...device,
      state,
      mode,
      lastChangedAt: now,
      lastChangeReason: source.reason,
      lastRuleId: ruleId,
    },
    event: {
      timestamp: now,
      type: 'DEVICE_STATE_CHANGED',
      category: 'control',
      severity: source.kind === 'emergency' ? 'critical' : 'info',
      message: mn.events.deviceStateChanged(device.name, from, to, mn.control.ruleName[ruleId]),
      floorId: device.floorId,
      deviceId: device.id,
      ruleId,
      ...(source.kind === 'auto' && source.trigger !== undefined
        ? { trigger: source.trigger }
        : {}),
      previousState: device.state,
      newState: state,
      reason: source.reason,
      actor: 'system',
    },
  };
}
