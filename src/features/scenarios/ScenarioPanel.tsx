// Сценарийн самбар (UC-7, FR-S3, FR-S4, CLAUDE.md §7.1, §7.4, §8.2, §8.7): 8 сценарийн жагсаалт, идэвхтэй сценарийн
// явц, «Зогсоох», «Симуляцийг эхнээс нь». Өөр сценари идэвхтэй (эсвэл яаралтай байдал) үед, мөн S6-д эхлүүлэхээс өмнө
// баталгаажуулах dialog; хатуу шинэчлэл үргэлж баталгаажуулалттай. Командыг зөвхөн `AerisRuntime.dispatch`-аар илгээнэ.
import { useId, useMemo, useState } from 'react';

import { Button, Dialog, Panel, Skeleton } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime } from '@/domain/runtime/AerisRuntime';
import type { ScenarioId } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectScenarioPanel, type ScenarioItem, type ScenarioPanelData } from '@/store/selectors';

import './Scenarios.css';

const text = mn.scenarios;

type Pending = { kind: 'start'; id: ScenarioId } | { kind: 'reset' } | null;

/** Эхлүүлэхээс өмнө баталгаажуулалт хэрэгтэй эсэх (§7.1: өөр сценари идэвхтэй; §6.9: S6) */
export function needsStartConfirmation(item: ScenarioItem, data: ScenarioPanelData): boolean {
  return item.requiresConfirmation || data.active !== null || data.emergency !== null;
}

function StartConfirmBody({ item, data }: { item: ScenarioItem; data: ScenarioPanelData }) {
  return (
    <>
      {data.emergency !== null ? (
        <p>{text.confirm.emergencySwitchBody}</p>
      ) : (
        data.active !== null && <p>{text.confirm.switchBody(data.active.name)}</p>
      )}
      {item.requiresConfirmation && (
        <p className="scenario-panel__disclaimer">{text.emergencyDisclaimer}</p>
      )}
      {!item.startsFromCurrent && <p>{text.confirm.softResetNote}</p>}
    </>
  );
}

function ScenarioRow({
  item,
  active,
  runtime,
  onStart,
}: {
  item: ScenarioItem;
  active: boolean;
  runtime: AerisRuntime | null;
  onStart: (item: ScenarioItem) => void;
}) {
  const noteId = useId();
  return (
    <li
      className={
        active ? 'scenario-panel__item scenario-panel__item--active' : 'scenario-panel__item'
      }
    >
      <div className="scenario-panel__text">
        <span className="scenario-panel__name">
          {item.name}
          {active && <span className="scenario-panel__active-tag">{text.panel.active}</span>}
        </span>
        {/* Тайлбар 2 мөрөөр таслагдана (D85); бүтэн бичвэр DOM-д (дэлгэц уншигч) ба tooltip-д */}
        <span className="scenario-panel__description" title={item.description}>
          {item.description}
        </span>
        {item.startsFromCurrent && (
          <span className="scenario-panel__note">{text.panel.startsFromCurrent}</span>
        )}
        {item.blockedByEmergency && (
          <span id={noteId} className="scenario-panel__note">
            {text.panel.recoveryBlocked}
          </span>
        )}
      </div>
      {/* Runtime байхгүй бол (жишээ snapshot) товч огт зурахгүй (§8.7) */}
      {runtime !== null && (
        <Button
          className={item.requiresConfirmation ? 'ui-button--danger' : undefined}
          aria-label={text.panel.startLabel(item.name)}
          aria-describedby={item.blockedByEmergency ? noteId : undefined}
          disabled={item.blockedByEmergency}
          onClick={() => onStart(item)}
        >
          {text.panel.start}
        </Button>
      )}
    </li>
  );
}

export function ScenarioPanel() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const data = useMemo(() => (snapshot ? selectScenarioPanel(snapshot) : null), [snapshot]);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  if (data === null) {
    return (
      <Panel title={text.panel.title} busy>
        <Skeleton />
      </Panel>
    );
  }

  const send = async (command: AerisCommand) => {
    if (runtime === null) return;
    const result = await runtime.dispatch(command);
    setError(result.ok ? null : result.reason);
  };

  const onStart = (item: ScenarioItem) => {
    if (needsStartConfirmation(item, data)) setPending({ kind: 'start', id: item.id });
    else void send({ type: 'scenario/start', scenarioId: item.id });
  };

  const close = () => setPending(null);
  const pendingItem =
    pending?.kind === 'start' ? data.items.find((item) => item.id === pending.id) : undefined;

  return (
    <Panel title={text.panel.title} className="scenario-panel">
      {/* Гарчгийн мөр (D85): идэвхтэй сценарийн явц + «Зогсоох» + «Симуляцийг эхнээс нь» нэг мөрөнд */}
      <div className="scenario-panel__bar">
        {data.active === null ? (
          <span className="scenario-panel__idle">{text.panel.noActive}</span>
        ) : (
          <div className="scenario-panel__active">
            <div className="scenario-panel__active-head">
              <span className="scenario-panel__active-name">{data.active.name}</span>
              <span className="scenario-panel__percent">
                {text.panel.progressValue(data.active.percent)}
              </span>
            </div>
            <div
              className="scenario-panel__progress"
              role="progressbar"
              aria-label={text.panel.progressLabel(data.active.name)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={data.active.percent}
            >
              <span
                className="scenario-panel__progress-fill"
                style={{ width: `${data.active.percent}%` }}
              />
            </div>
          </div>
        )}
        {runtime !== null && (
          <div className="scenario-panel__actions">
            {data.active !== null && (
              <Button
                aria-label={text.panel.stopLabel(data.active.name)}
                onClick={() => void send({ type: 'scenario/stop' })}
              >
                {text.panel.stop}
              </Button>
            )}
            <Button className="ui-button--danger" onClick={() => setPending({ kind: 'reset' })}>
              {text.panel.reset}
            </Button>
          </div>
        )}
      </div>

      <ul className="scenario-panel__list" aria-label={text.panel.listLabel}>
        {data.items.map((item) => (
          <ScenarioRow
            key={item.id}
            item={item}
            active={data.active?.id === item.id}
            runtime={runtime}
            onStart={onStart}
          />
        ))}
      </ul>

      {error !== null && (
        <p className="scenario-panel__error" role="alert">
          {error}
        </p>
      )}

      {pendingItem !== undefined && (
        <Dialog
          open
          tone={pendingItem.requiresConfirmation ? 'danger' : 'default'}
          title={text.confirm.startTitle(pendingItem.name)}
          onClose={close}
          actions={
            <>
              <Button data-autofocus onClick={close}>
                {text.confirm.cancel}
              </Button>
              <Button
                className={pendingItem.requiresConfirmation ? 'ui-button--danger' : undefined}
                onClick={() => {
                  close();
                  void send({ type: 'scenario/start', scenarioId: pendingItem.id });
                }}
              >
                {text.confirm.confirmStart}
              </Button>
            </>
          }
        >
          <StartConfirmBody item={pendingItem} data={data} />
        </Dialog>
      )}

      {pending?.kind === 'reset' && (
        <Dialog
          open
          tone="danger"
          title={text.confirm.resetTitle}
          onClose={close}
          actions={
            <>
              <Button data-autofocus onClick={close}>
                {text.confirm.cancel}
              </Button>
              <Button
                className="ui-button--danger"
                onClick={() => {
                  close();
                  void send({ type: 'simulation/reset' });
                }}
              >
                {text.confirm.confirmReset}
              </Button>
            </>
          }
        >
          <p>{text.confirm.resetBody}</p>
        </Dialog>
      )}
    </Panel>
  );
}
