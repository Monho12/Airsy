// Өрөөний сценарийн товчнууд (С7, D93) — «Сонгосон давхар» самбарын өрөөний мөр задрахад гарна. Эхлүүлэх дүрэм
// сценарийн самбартай ижил (§7.1, D81): өөр сценари эсвэл яаралтай байдал идэвхтэй бол баталгаажуулалтын dialog.
// Гал/утааны сценари энд байхгүй (§6.9, D7).
import { useMemo, useState } from 'react';

import { Button, Dialog } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import type { Area, RoomScenarioId } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectRoomScenarioOptions, selectScenarioPanel } from '@/store/selectors';

const text = mn.scenarios;

export function RoomScenarios({ area }: { area: Area }) {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const [pending, setPending] = useState<RoomScenarioId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(() => {
    if (snapshot === null) return null;
    const panel = selectScenarioPanel(snapshot);
    return {
      options: selectRoomScenarioOptions(snapshot, area.id),
      active: panel.active,
      emergency: panel.emergency,
    };
  }, [snapshot, area.id]);

  // Runtime байхгүй бол (жишээ snapshot) удирдлага огт зурахгүй (§8.7)
  if (data === null || runtime === null || data.options.length === 0) return null;

  const start = async (id: RoomScenarioId) => {
    const result = await runtime.dispatch({
      type: 'scenario/startRoom',
      scenarioId: id,
      areaId: area.id,
    });
    setError(result.ok ? null : result.reason);
  };
  const onClick = (id: RoomScenarioId) => {
    if (data.active !== null || data.emergency !== null) setPending(id);
    else void start(id);
  };
  const pendingOption = data.options.find((option) => option.id === pending);
  const close = () => setPending(null);

  return (
    <div className="floor-details__room-scenarios">
      <p className="floor-details__room-scenarios-heading">{text.room.panel.heading}</p>
      <ul className="floor-details__room-scenario-list">
        {data.options.map((option) => (
          <li key={option.id} className="floor-details__room-scenario">
            <Button
              aria-label={text.room.panel.startLabel(option.name, area.name)}
              aria-pressed={option.active}
              title={option.description}
              onClick={() => onClick(option.id)}
            >
              {option.name}
            </Button>
            <span className="floor-details__room-scenario-description">{option.description}</span>
          </li>
        ))}
      </ul>
      {error !== null && (
        <p className="floor-details__room-scenario-error" role="alert">
          {error}
        </p>
      )}
      {pendingOption !== undefined && (
        <Dialog
          open
          title={text.confirm.startTitle(`${pendingOption.name} — ${area.name}`)}
          onClose={close}
          actions={
            <>
              <Button data-autofocus onClick={close}>
                {text.confirm.cancel}
              </Button>
              <Button
                onClick={() => {
                  close();
                  void start(pendingOption.id);
                }}
              >
                {text.confirm.confirmStart}
              </Button>
            </>
          }
        >
          {data.emergency !== null ? (
            <p>{text.confirm.emergencySwitchBody}</p>
          ) : (
            data.active !== null && <p>{text.confirm.switchBody(data.active.name)}</p>
          )}
          <p>{text.confirm.softResetNote}</p>
        </Dialog>
      )}
    </div>
  );
}
