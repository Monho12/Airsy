// Өрөөний сценарийн товчнууд (С7, D93) — «Сонгосон давхар» самбарын өрөөний мөр задрахад гарна. Эхлүүлэх дүрэм
// сценарийн самбартай ижил (§7.1, D81): өөр сценари эсвэл яаралтай байдал идэвхтэй бол баталгаажуулалтын dialog
// (`RoomScenarioConfirm`, uiStore-оор — 3D шошгоны товчтой нэг dialog, D99). Гал/утааны сценари энд байхгүй (§6.9, D7).
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import type { Area, RoomScenarioId } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { requestRoomScenario } from '@/store/roomScenarios';
import { useRuntime } from '@/store/runtime';
import { selectRoomScenarioOptions } from '@/store/selectors';

const text = mn.scenarios;

export function RoomScenarios({ area }: { area: Area }) {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () => (snapshot === null ? [] : selectRoomScenarioOptions(snapshot, area.id)),
    [snapshot, area.id],
  );

  // Runtime байхгүй бол (жишээ snapshot) удирдлага огт зурахгүй (§8.7)
  if (snapshot === null || runtime === null || options.length === 0) return null;

  const onClick = async (id: RoomScenarioId) => {
    const result = await requestRoomScenario(runtime, snapshot, id, area.id);
    if (result !== null) setError(result.ok ? null : result.reason);
  };

  return (
    <div className="floor-details__room-scenarios">
      <p className="floor-details__room-scenarios-heading">{text.room.panel.heading}</p>
      <ul className="floor-details__room-scenario-list">
        {options.map((option) => (
          <li key={option.id} className="floor-details__room-scenario">
            <Button
              aria-label={text.room.panel.startLabel(option.name, area.name)}
              aria-pressed={option.active}
              title={option.description}
              onClick={() => void onClick(option.id)}
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
    </div>
  );
}
