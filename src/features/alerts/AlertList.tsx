// Дохионы самбар (UC-9, FR-A2, CLAUDE.md §4.4, §8.2, §8.7): ноцтой байдал / давхар / хэмжигдэхүүн / төлөвөөр шүүх,
// идэвхтэй дохиог хүлээн авах (`alert/acknowledge`), шийдэгдсэн дохионы түүх. Шүүлт нь `uiStore`-д (§10.2, D83).
// Идэвхтэй `emergency` дохиог хүлээн авах боломжгүй (§4.4) — товч зурахгүй, шалтгааныг бичнэ.
import { useId, useMemo, useState } from 'react';

import { Button, EmptyState, Panel, SelectField, Skeleton, StatusBadge } from '@/components/ui';
import { buildingConfig, METRICS } from '@/domain/config/building';
import { floorLabelMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { AerisRuntime } from '@/domain/runtime/AerisRuntime';
import type { Alert } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectAlertCounts, selectFilteredAlerts } from '@/store/selectors';
import { defaultAlertFilter, useUiStore, type AlertFilter } from '@/store/uiStore';

import './AlertList.css';

const text = mn.alerts;
const f = text.filter;

const severityOptions = [
  { value: 'all', label: f.all },
  { value: 'warning', label: text.severity.warning },
  { value: 'critical', label: text.severity.critical },
] as const satisfies readonly { value: AlertFilter['severity']; label: string }[];

const statusOptions = (['open', 'active', 'acknowledged', 'resolved'] as const).map((value) => ({
  value,
  label: f.statusOption[value],
}));

const metricOptions: { value: AlertFilter['metric']; label: string }[] = [
  { value: 'all', label: f.all },
  ...METRICS.map((metric) => ({ value: metric, label: mn.metrics.shortLabel[metric] })),
];

// Давхар дээрээс доош (давхрын жагсаалттай ижил дараалал)
const floorOptions: { value: AlertFilter['floor']; label: string }[] = [
  { value: 'all', label: f.all },
  { value: 'building', label: f.building },
  ...[...buildingConfig.building.floorIds].reverse().map((floorId) => ({
    value: floorId,
    label: floorLabelMn(buildingConfig.floors[floorId]?.level ?? 0),
  })),
];

function AlertItem({ alert, runtime }: { alert: Alert; runtime: AerisRuntime | null }) {
  const messageId = useId();
  const [error, setError] = useState<string | null>(null);
  const acknowledge = async () => {
    if (runtime === null) return;
    const result = await runtime.dispatch({ type: 'alert/acknowledge', alertId: alert.id });
    setError(result.ok ? null : result.reason);
  };
  const emergencyActive = alert.type === 'emergency' && alert.status !== 'resolved';

  return (
    <li className="alert-list__item" data-severity={alert.severity} data-status={alert.status}>
      <div className="alert-list__heading">
        <StatusBadge status={alert.severity} label={text.severity[alert.severity]} />
        <span className="alert-list__title">{alert.title}</span>
      </div>
      <p id={messageId} className="alert-list__message">
        {alert.message}
      </p>
      <p className="alert-list__meta">
        {text.raisedAt} <time>{formatTimeMn(alert.raisedAt)}</time>
        {' · '}
        {text.type[alert.type]}
        {' · '}
        {text.status[alert.status]}
        {alert.acknowledgedAt !== null && alert.status === 'acknowledged' && (
          <>
            {' '}
            <time>{formatTimeMn(alert.acknowledgedAt)}</time>
          </>
        )}
        {alert.resolvedAt !== null && (
          <>
            {' · '}
            {text.resolvedAt} <time>{formatTimeMn(alert.resolvedAt)}</time>
          </>
        )}
      </p>
      {alert.status === 'active' && emergencyActive && (
        <p className="alert-list__note">{text.emergencyAckNote}</p>
      )}
      {/* Runtime байхгүй бол (жишээ snapshot) товч огт зурахгүй (§8.7) */}
      {alert.status === 'active' && !emergencyActive && runtime !== null && (
        <Button
          className="alert-list__ack"
          aria-label={text.acknowledgeLabel(alert.title)}
          // Ижил гарчигтай дохиог (жишээ нь нэг давхрын хоёр мэдрэгч) мессежээр нь ялгана (§8.8)
          aria-describedby={messageId}
          onClick={() => void acknowledge()}
        >
          {text.acknowledge}
        </Button>
      )}
      {error !== null && (
        <p className="alert-list__error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

export function AlertList() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const filter = useUiStore((state) => state.alertFilter);
  const setFilter = useUiStore((state) => state.setAlertFilter);
  const alerts = useMemo(
    () => (snapshot ? selectFilteredAlerts(snapshot, filter) : []),
    [snapshot, filter],
  );

  const title = mn.common.regions.alerts;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }

  const counts = selectAlertCounts(snapshot);
  const total = filter.status === 'resolved' ? counts.resolved : counts.open;
  const filtered = filter.severity !== 'all' || filter.floor !== 'all' || filter.metric !== 'all';
  const emptyMessage = filtered
    ? f.noMatch
    : filter.status === 'resolved'
      ? f.emptyResolved
      : filter.status === 'open'
        ? text.emptyActive
        : f.noMatch;

  // «Шийдэгдсэн» харагдацад гарчиг нь «Идэвхтэй дохио» биш (Phase 6d-ээс хойшлогдсон, D83-ын 7)
  const viewTitle = filter.status === 'resolved' ? text.resolvedTitle : title;

  return (
    <Panel title={viewTitle} meta={text.shownCount(alerts.length, total)}>
      <fieldset className="ui-filter-bar">
        <legend className="visually-hidden">{f.label}</legend>
        <SelectField
          label={f.status}
          value={filter.status}
          options={statusOptions}
          onChange={(status) => setFilter({ status })}
        />
        <SelectField
          label={f.severity}
          value={filter.severity}
          options={severityOptions}
          onChange={(severity) => setFilter({ severity })}
        />
        <SelectField
          label={f.floor}
          value={filter.floor}
          options={floorOptions}
          onChange={(floor) => setFilter({ floor })}
        />
        <SelectField
          label={f.metric}
          value={filter.metric}
          options={metricOptions}
          onChange={(metric) => setFilter({ metric })}
        />
        {(filtered || filter.status !== defaultAlertFilter.status) && (
          <Button onClick={() => setFilter(defaultAlertFilter)}>{f.reset}</Button>
        )}
      </fieldset>
      {alerts.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="alert-list">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} runtime={runtime} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
