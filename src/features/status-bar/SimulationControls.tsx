// Симуляцийн удирдлага (FR-S1, CLAUDE.md §8.2, §8.5, §8.7, §8.9, D74): Үргэлжлүүлэх / Түр зогсоох товч, хурдны
// dropdown (§8.2-ын `1× ▾`), хажууд нь ШУУД / ТҮР ЗОГССОН тэмдэг. Командыг зөвхөн `AerisRuntime.dispatch`-аар илгээнэ;
// шинэ төлөв `subscribe` → store-оор ирнэ. Татгалзвал Монгол шалтгааныг харуулна (§9.4).
import { Pause, Play } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui';
import { simulationSpeeds } from '@/domain/config/simulation';
import { mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime } from '@/domain/runtime/AerisRuntime';
import type { SimulationSpeed } from '@/domain/types';
import { useUiStore } from '@/store/uiStore';

const text = mn.common.simulation;

export function SimulationControls({
  runtime,
  running,
  speed,
}: {
  runtime: AerisRuntime;
  running: boolean;
  speed: SimulationSpeed;
}) {
  const speedId = useId();
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const [error, setError] = useState<string | null>(null);

  const send = async (command: AerisCommand) => {
    const result = await runtime.dispatch(command);
    setError(result.ok ? null : result.reason);
  };

  const toggleLabel = running ? text.pause : text.play;
  const indicatorClass = [
    'sim-live',
    running ? 'sim-live--on' : 'sim-live--paused',
    // Хөдөлгөөн багасгах (§8.5): лугшилт унтарна — системийн ба UI-ийн тохиргоо хоёулаа uiStore-оор
    running && !reducedMotion ? 'sim-live--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="sim-controls" role="group" aria-label={text.controlsLabel}>
      <Button
        className="sim-controls__toggle"
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={() => void send({ type: running ? 'simulation/pause' : 'simulation/play' })}
      >
        {running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </Button>
      <label className="visually-hidden" htmlFor={speedId}>
        {text.speed}
      </label>
      <select
        id={speedId}
        className="sim-controls__speed"
        value={speed}
        onChange={(event) =>
          void send({
            type: 'simulation/setSpeed',
            speed: Number(event.target.value) as SimulationSpeed,
          })
        }
      >
        {simulationSpeeds.map((option) => (
          <option key={option} value={option}>
            {text.speedOption(option)}
          </option>
        ))}
      </select>
      <span className={indicatorClass} role="status">
        <span className="sim-live__dot" aria-hidden="true" />
        {running ? text.live : text.paused}
      </span>
      {error !== null && (
        <span className="sim-controls__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
