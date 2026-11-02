// Удирдлагын engine (CLAUDE.md §6.2, §9.5-ын 6). React, store-гүй цэвэр функц — ижил оролт → ижил гаралт (§6.1).
// Нэг алхамд: гар удирдлагын хугацаа → 0-р үе шат → дүрэм → нэгтгэл → хязгаар → хамгаалалт → applyDeviceCommand.
import type { BuildingConfig } from '@/domain/config/building';
import { controlConfig } from '@/domain/config/control';
import { outdoorAirThresholds, metricSpecs } from '@/domain/config/thresholds';
import type { SystemEventDraft } from '@/domain/events/eventLog';
import { floorLabelMn, formatMetricValueMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';
import type {
  ControlContext,
  ControlDecision,
  ControlRequest,
  ControlState,
  DeviceId,
  DeviceKind,
  FloorId,
  FloorMetricAggregate,
  MetricType,
  OutdoorConditions,
  SimTimeMs,
  ThresholdLevels,
  VentilationDevice,
} from '@/domain/types';

import { applyDeviceCommand } from './applyDeviceCommand';
import { evaluateStageZero, type DebouncedCondition, type RuleDebounceState } from './controlState';
import { sameState, stateLabel } from './levels';
import { resolveTarget } from './resolve';
import { CONTROL_RULES, DEVICE_KIND_ORDER, floorLevelOf } from './rules';
import { applySafeguards } from './safeguards';

export interface ControlEngineInput {
  config: BuildingConfig;
  devices: Readonly<Record<DeviceId, VentilationDevice>>;
  /** Энэ алхмын давхрын нэгтгэл (зөвхөн зөв хэмжилт, §5.6) */
  aggregates: FloorAggregates;
  outdoor: OutdoorConditions;
  control: ControlState;
  debounce: RuleDebounceState;
  now: SimTimeMs;
}

export interface ControlEngineOutput {
  /** Өөрчлөлтгүй бол оролтын лавлагаа хэвээр (structural sharing, §11.2) */
  devices: Record<DeviceId, VentilationDevice>;
  control: ControlState;
  debounce: RuleDebounceState;
  decisions: Record<DeviceId, ControlDecision>;
  events: SystemEventDraft[];
}

const CONFIRMED_METRIC: Record<DebouncedCondition, MetricType> = {
  co2: 'co2',
  voc: 'voc',
  pm25: 'pm25',
  'temperature-high': 'temperature',
};

/** Нэгтгэлийн өндөр талын түвшинг баталгаажсан түвшнээр солино — дүрмүүд зөвхөн үүнийг уншина (§6.6, D78) */
function withConfirmedLevels(
  floor: Partial<Record<MetricType, FloorMetricAggregate>>,
  confirmed: Record<DebouncedCondition, ThresholdLevels['high']>,
): Partial<Record<MetricType, FloorMetricAggregate>> {
  const out: Partial<Record<MetricType, FloorMetricAggregate>> = { ...floor };
  for (const condition of Object.keys(CONFIRMED_METRIC) as DebouncedCondition[]) {
    const metric = CONFIRMED_METRIC[condition];
    const aggregate = floor[metric];
    if (aggregate === undefined) continue;
    out[metric] = { ...aggregate, levels: { ...aggregate.levels, high: confirmed[condition] } };
  }
  return out;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

function controlEvent(
  now: SimTimeMs,
  type: SystemEventDraft['type'],
  severity: SystemEventDraft['severity'],
  message: string,
  floorId?: FloorId,
): SystemEventDraft {
  return {
    timestamp: now,
    type,
    category: 'control',
    severity,
    message,
    ...(floorId === undefined ? {} : { floorId }),
    actor: 'system',
  };
}

export function evaluateControl(input: ControlEngineInput): ControlEngineOutput {
  const { config, aggregates, outdoor, now } = input;
  const previous = input.control;
  const emergency = previous.emergency;
  const events: SystemEventDraft[] = [];
  let devices: Record<DeviceId, VentilationDevice> = input.devices as Record<
    DeviceId,
    VentilationDevice
  >;
  const setDevice = (device: VentilationDevice) => {
    if (devices === input.devices) devices = { ...devices };
    devices[device.id] = device;
  };

  // Гар удирдлагын хугацаа дуусах (§6.7). Яаралтай байдлын үед гар удирдлага түр зогссон тул хугацаа тоолохгүй.
  if (emergency === null) {
    for (const floorId of config.building.floorIds) {
      for (const deviceId of config.floors[floorId]?.deviceIds ?? []) {
        const device = devices[deviceId];
        if (device?.manualOverride == null || device.manualOverride.expiresAt > now) continue;
        setDevice({ ...device, mode: 'auto', manualOverride: null });
        events.push({
          ...controlEvent(
            now,
            'MANUAL_OVERRIDE_EXPIRED',
            'info',
            mn.events.manualOverrideExpired(device.name),
            device.floorId,
          ),
          deviceId: device.id,
        });
      }
    }
  }

  // 0-р үе шат (§6.2)
  const stage = evaluateStageZero({
    floorIds: config.building.floorIds,
    aggregates,
    outdoor,
    previous,
    debounce: input.debounce,
  });

  const pmText = (value: number | null) =>
    value === null
      ? '—'
      : formatMetricValueMn(value, metricSpecs.pm25.unit, metricSpecs.pm25.decimals);
  if (stage.outdoorAirRestricted !== previous.outdoorAirRestricted) {
    events.push(
      stage.outdoorAirRestricted
        ? controlEvent(
            now,
            'CONTROL_CONSTRAINT_ACTIVE',
            'warning',
            mn.events.constraintActive(pmText(outdoor.pm25)),
          )
        : controlEvent(now, 'CONTROL_CONSTRAINT_CLEARED', 'info', mn.events.constraintCleared),
    );
  }
  const wasFallback = new Set(previous.fallbackFloors);
  const isFallback = new Set(stage.fallbackFloors);
  for (const floorId of config.building.floorIds) {
    const label = floorLabelMn(floorLevelOf(floorId));
    if (isFallback.has(floorId) && !wasFallback.has(floorId)) {
      events.push(
        controlEvent(
          now,
          'CONTROL_FALLBACK_ACTIVE',
          'warning',
          mn.events.fallbackActive(label),
          floorId,
        ),
      );
    } else if (!isFallback.has(floorId) && wasFallback.has(floorId)) {
      events.push(
        controlEvent(
          now,
          'CONTROL_FALLBACK_CLEARED',
          'info',
          mn.events.fallbackCleared(label),
          floorId,
        ),
      );
    }
  }

  const control: ControlState = {
    autoMode: previous.autoMode,
    outdoorAirRestricted: stage.outdoorAirRestricted,
    pmDilutionAllowed: stage.pmDilutionAllowed,
    fallbackFloors: sameList(stage.fallbackFloors, previous.fallbackFloors)
      ? previous.fallbackFloors
      : stage.fallbackFloors,
    freeCoolingFloors: sameList(stage.freeCoolingFloors, previous.freeCoolingFloors)
      ? previous.freeCoolingFloors
      : stage.freeCoolingFloors,
    emergency,
  };
  const unchangedControl =
    control.outdoorAirRestricted === previous.outdoorAirRestricted &&
    control.pmDilutionAllowed === previous.pmDilutionAllowed &&
    control.fallbackFloors === previous.fallbackFloors &&
    control.freeCoolingFloors === previous.freeCoolingFloors;

  const freeCooling = new Set(stage.freeCoolingFloors);
  const decisions: Record<DeviceId, ControlDecision> = {};

  for (const floorId of config.building.floorIds) {
    const floor = config.floors[floorId];
    if (floor === undefined) continue;
    const byKind = new Map<DeviceKind, VentilationDevice>();
    for (const deviceId of floor.deviceIds) {
      const device = devices[deviceId];
      if (device !== undefined) byKind.set(device.kind, device);
    }
    if (byKind.size !== DEVICE_KIND_ORDER.length) continue;

    const ctx: ControlContext = {
      floorId,
      now,
      floorAggregates: withConfirmedLevels(aggregates[floorId] ?? {}, stage.confirmed[floorId]!),
      sensorFallbackActive: isFallback.has(floorId),
      outdoor,
      devices: Object.fromEntries(byKind) as ControlContext['devices'],
      autoMode: control.autoMode,
      outdoorAirRestricted: control.outdoorAirRestricted,
      pmDilutionAllowed: control.pmDilutionAllowed,
      freeCoolingActive: freeCooling.has(floorId),
      emergency,
    };
    // 1. Дүрэм бүр хүсэлт гаргана
    const requests: ControlRequest[] = CONTROL_RULES.flatMap((rule) => rule.evaluate(ctx));

    for (const kind of DEVICE_KIND_ORDER) {
      let device = byKind.get(kind)!;
      const candidates = requests.filter((r) => r.deviceKind === kind);
      const base = { deviceId: device.id, evaluatedAt: now, candidates };

      // 1-р алхам (§6.4): яаралтай байдал бүгдийг давна — гар удирдлага, хязгаар, хамгаалалт (§6.9, D15)
      const override = candidates.find((r) => r.role === 'override');
      if (override !== undefined) {
        let reason = override.reason;
        if (!sameState(device.state, override.target)) {
          const result = applyDeviceCommand(
            device,
            override.target,
            { kind: 'emergency', reason: override.reason },
            now,
          );
          setDevice(result.device);
          events.push(result.event);
          reason = `${override.reason} ${mn.control.transition(device.name, stateLabel(device.state), stateLabel(override.target))}`;
        } else if (device.mode !== 'emergency') {
          setDevice({ ...device, mode: 'emergency' });
        }
        decisions[device.id] = {
          ...base,
          winningRuleId: 'R-EMERGENCY',
          contributingRuleIds: [],
          requestedState: override.target,
          constrainedState: override.target,
          constraintsApplied: [],
          minimumApplied: null,
          outcome: 'emergency',
          reason,
        };
        continue;
      }
      // Яаралтай байдал дууссан (§7.4 A-г Phase 6-д команд хийнэ) — горимыг сэргээнэ
      if (device.mode === 'emergency') {
        device = { ...device, mode: device.manualOverride === null ? 'auto' : 'manual' };
        setDevice(device);
      }

      // 3–5-р алхам: эрэлт → дээд хязгаар → доод хязгаар
      const resolved = resolveTarget(
        candidates.filter((r) => r.role === 'demand'),
        candidates.filter((r) => r.role === 'minimum'),
        control.outdoorAirRestricted,
      );
      const target = resolved.constrainedState;
      const targetLabel = stateLabel(target);
      const constraintsApplied: ControlDecision['constraintsApplied'] = [];
      if (resolved.constraintApplied !== null) {
        constraintsApplied.push({
          id: resolved.constraintApplied,
          note:
            outdoor.pm25 === null
              ? mn.control.constraintNoteNoValue(targetLabel)
              : mn.control.constraintNote(
                  pmText(outdoor.pm25),
                  pmText(outdoorAirThresholds.outdoorPm25RestrictEnter),
                  targetLabel,
                ),
        });
      }
      const minimumApplied: ControlDecision['minimumApplied'] = resolved.minimumApplied
        ? { ruleId: 'R-SENSOR-FALLBACK', note: mn.control.minimumNote(targetLabel) }
        : null;
      const notes = [...constraintsApplied.map((c) => c.note), minimumApplied?.note]
        .filter((n): n is string => n !== undefined)
        .join(' ');
      const decisionBase = {
        ...base,
        winningRuleId: resolved.winningRuleId,
        contributingRuleIds: resolved.contributingRuleIds,
        requestedState: resolved.requestedState,
        constrainedState: target,
        constraintsApplied,
        minimumApplied,
      };
      const withNotes = (text: string) => (notes === '' ? text : `${text} ${notes}`);

      // 2-р алхам: гар удирдлага — engine команд өгөхгүй (R-MANUAL шүүлтүүр); автомат юу сонгох байсныг тайлбарлана
      if (device.manualOverride !== null) {
        decisions[device.id] = {
          ...decisionBase,
          winningRuleId: 'R-MANUAL',
          contributingRuleIds: [],
          outcome: 'manual',
          reason: `${mn.control.manualReason(
            stateLabel(device.state),
            formatTimeMn(device.manualOverride.expiresAt),
          )} ${mn.control.autoWouldChoose(targetLabel)}`,
        };
        continue;
      }
      // Автомат горим унтраалттай — зөвлөмж (§6.7, FR-C6); алхам бүрт үйл явдал бичихгүй
      if (!control.autoMode) {
        const same = sameState(device.state, target);
        decisions[device.id] = {
          ...decisionBase,
          outcome: same ? 'unchanged' : 'recommendation_only',
          reason: same
            ? mn.control.unchangedReason(targetLabel)
            : withNotes(
                `${resolved.winningReason} ${mn.control.recommendationReason(device.name, targetLabel)}`,
              ),
        };
        continue;
      }

      // 4-р алхам: тогтвортой байдлын шүүлтүүр (§6.6)
      const safeguard = applySafeguards(device.state, target, device.lastChangedAt, now);
      if (safeguard.kind === 'unchanged') {
        decisions[device.id] = {
          ...decisionBase,
          outcome: 'unchanged',
          reason: withNotes(`${resolved.winningReason} ${mn.control.unchangedReason(targetLabel)}`),
        };
        continue;
      }
      if (safeguard.kind === 'held_by_dwell') {
        decisions[device.id] = {
          ...decisionBase,
          outcome: 'held_by_dwell',
          reason: mn.control.heldReason(
            targetLabel,
            stateLabel(device.state),
            controlConfig.minStateHoldMs / 1000,
          ),
        };
        continue;
      }
      // 5-р алхам: команд (FR-C4 — зорилт ≠ одоогийн төлөв)
      const transition = mn.control.transition(
        device.name,
        stateLabel(device.state),
        stateLabel(safeguard.state),
      );
      const stepNote = safeguard.steppedDown ? ` ${mn.control.stepDownNote(targetLabel)}` : '';
      const reason = withNotes(`${resolved.winningReason} ${transition}${stepNote}`);
      const result = applyDeviceCommand(
        device,
        safeguard.state,
        { kind: 'auto', ruleId: resolved.winningRuleId, reason, trigger: resolved.winningReason },
        now,
      );
      setDevice(result.device);
      events.push(result.event);
      decisions[device.id] = { ...decisionBase, outcome: 'applied', reason };
    }
  }

  return {
    devices,
    control: unchangedControl ? previous : control,
    debounce: stage.debounce,
    decisions,
    events,
  };
}
