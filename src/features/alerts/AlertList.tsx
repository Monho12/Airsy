// Идэвхтэй дохионы жагсаалт — ноцтой нь эхэнд (selector-ийн дараалал, FR-A2, CLAUDE.md §8.2, §8.7).
// Хүлээн авах, шүүлт Phase 6-д (§13); энд зөвхөн харах.
import { useMemo } from 'react';

import { EmptyState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { formatTimeMn, mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { selectActiveAlerts } from '@/store/selectors';

import './AlertList.css';

export function AlertList() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const alerts = useMemo(() => (snapshot ? selectActiveAlerts(snapshot) : []), [snapshot]);

  const title = mn.common.regions.alerts;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }

  return (
    <Panel title={title} meta={alerts.length}>
      {alerts.length === 0 ? (
        <EmptyState message={mn.alerts.emptyActive} />
      ) : (
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert-list__item" data-severity={alert.severity}>
              <div className="alert-list__heading">
                <StatusBadge status={alert.severity} label={mn.alerts.severity[alert.severity]} />
                <span className="alert-list__title">{alert.title}</span>
              </div>
              <p className="alert-list__message">{alert.message}</p>
              <p className="alert-list__meta">
                <time>{formatTimeMn(alert.raisedAt)}</time>
                {' · '}
                {mn.alerts.type[alert.type]}
                {' · '}
                {mn.alerts.status[alert.status]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
