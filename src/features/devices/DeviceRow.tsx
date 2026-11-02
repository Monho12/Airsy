// Нэг төхөөрөмжийн мөр: төлөв, горим, гар удирдлага, «Яагаад?» (CLAUDE.md §6.7, §6.8, §8.7, §8.8, D78).
import { useId, useState } from 'react';

import { Button } from '@/components/ui';
import { damperPositionOrder, fanLevelOrder } from '@/domain/config/control';
import { formatTimeMn, mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime } from '@/domain/runtime/AerisRuntime';
import type { ControlDecision, DeviceState, VentilationDevice } from '@/domain/types';

import { DecisionInspector } from './DecisionInspector';

const text = mn.devices;

/** Төрөлд тохирох бүх төлөв (сэнс — 5 түвшин, хаалт — 4 байрлал) */
function statesFor(kind: VentilationDevice['kind']): DeviceState[] {
  return kind === 'outdoor_air_damper'
    ? damperPositionOrder.map((position) => ({ kind, position }))
    : fanLevelOrder.map((level) => ({ kind, level }));
}

const stateKey = (state: DeviceState) =>
  state.kind === 'outdoor_air_damper' ? state.position : state.level;

export function DeviceRow({
  device,
  decision,
  runtime,
}: {
  device: VentilationDevice;
  decision: ControlDecision | null;
  runtime: AerisRuntime | null;
}) {
  const selectId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (command: AerisCommand) => {
    if (runtime === null) return;
    const result = await runtime.dispatch(command);
    setError(result.ok ? null : result.reason);
  };

  const states = statesFor(device.kind);
  const emergency = device.mode === 'emergency';

  return (
    <li className="device-list__item" data-device-kind={device.kind}>
      <div className="device-list__row">
        <span className="device-list__kind">{text.kind[device.kind]}</span>
        <span className="device-list__state">{text.stateLabel(device.state)}</span>
        <span className={`device-list__mode device-list__mode--${device.mode}`}>
          {text.modeBadge[device.mode]}
        </span>
      </div>

      {runtime !== null && (
        <div className="device-list__controls">
          <label className="visually-hidden" htmlFor={selectId}>
            {text.manualSelectLabel(device.name)}
          </label>
          <select
            id={selectId}
            className="device-list__select"
            value={stateKey(device.state)}
            disabled={emergency}
            onChange={(event) => {
              const state = states.find((s) => stateKey(s) === event.target.value);
              if (state !== undefined) {
                void send({ type: 'device/setManual', deviceId: device.id, state });
              }
            }}
          >
            {states.map((state) => (
              <option key={stateKey(state)} value={stateKey(state)}>
                {text.stateLabel(state)}
              </option>
            ))}
          </select>
          {device.manualOverride !== null && !emergency && (
            <Button onClick={() => void send({ type: 'device/returnToAuto', deviceId: device.id })}>
              {text.returnToAuto}
            </Button>
          )}
          <Button
            className="device-list__why"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={text.whyLabel(device.name)}
            onClick={() => setOpen((value) => !value)}
          >
            {text.why}
          </Button>
        </div>
      )}

      {device.manualOverride !== null && (
        <p className="device-list__hint">
          {text.manualUntil(formatTimeMn(device.manualOverride.expiresAt))}
        </p>
      )}
      {emergency && <p className="device-list__hint">{text.emergencyLockNote}</p>}
      {error !== null && (
        <p className="device-list__error" role="alert">
          {error}
        </p>
      )}
      {open && <DecisionInspector id={panelId} decision={decision} />}
    </li>
  );
}
