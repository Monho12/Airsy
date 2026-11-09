// Өрөөний сценарийн баталгаажуулалтын dialog (D81, D99). `uiStore.pendingRoomScenario`-оос зурагдана — самбарын мөр
// ба 3D мэдрэгчийн шошго хоёулаа энд нээнэ. 3D шошго Drei `Html` (CSS transform) дотор байдаг тул `position: fixed`
// dialog тэнд зөв зурагдахгүй — тиймээс самбарын түвшинд нэг л удаа.
import { useState } from 'react';

import { Button, Dialog } from '@/components/ui';
import { buildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { startRoomScenario } from '@/store/roomScenarios';
import { useRuntime } from '@/store/runtime';
import { selectScenarioPanel } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

const text = mn.scenarios;

export function RoomScenarioConfirm() {
  const pending = useUiStore((state) => state.pendingRoomScenario);
  const setPending = useUiStore((state) => state.setPendingRoomScenario);
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const [error, setError] = useState<string | null>(null);

  if (pending === null || snapshot === null || runtime === null) return null;
  const area = buildingConfig.areas[pending.areaId];
  if (area === undefined) return null;
  const panel = selectScenarioPanel(snapshot);
  const close = () => {
    setError(null);
    setPending(null);
  };
  const confirm = async () => {
    const result = await startRoomScenario(runtime, pending.scenarioId, pending.areaId);
    if (result.ok) close();
    else setError(result.reason);
  };

  return (
    <Dialog
      open
      title={text.confirm.startTitle(`${text.room.name[pending.scenarioId]} — ${area.name}`)}
      onClose={close}
      actions={
        <>
          <Button data-autofocus onClick={close}>
            {text.confirm.cancel}
          </Button>
          <Button onClick={() => void confirm()}>{text.confirm.confirmStart}</Button>
        </>
      }
    >
      {panel.emergency !== null ? (
        <p>{text.confirm.emergencySwitchBody}</p>
      ) : (
        panel.active !== null && <p>{text.confirm.switchBody(panel.active.name)}</p>
      )}
      <p>{text.confirm.softResetNote}</p>
      {error !== null && <p role="alert">{error}</p>}
    </Dialog>
  );
}
