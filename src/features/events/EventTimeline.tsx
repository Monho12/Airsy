// Сүүлийн үйл явдлын цагийн шугам — шинэ нь эхэнд, хязгаартай (selector-ийн дараалал, FR-A3, CLAUDE.md §11.4).
// Шүүлттэй бүрэн түүх Phase 6-д (§13).
import { useMemo } from 'react';

import { EmptyState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { formatTimeMn, mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { selectRecentEvents } from '@/store/selectors';

import './EventTimeline.css';

export function EventTimeline() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const events = useMemo(() => (snapshot ? selectRecentEvents(snapshot) : []), [snapshot]);

  const title = mn.common.regions.events;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }

  return (
    <Panel title={title}>
      {events.length === 0 ? (
        <EmptyState message={mn.events.empty} />
      ) : (
        <ol className="event-timeline">
          {events.map((event) => (
            <li key={event.id} className="event-timeline__item">
              <time className="event-timeline__time">{formatTimeMn(event.timestamp)}</time>
              <div className="event-timeline__body">
                <span className="event-timeline__type">
                  {mn.events.type[event.type]}
                  {event.severity !== 'info' && <StatusBadge status={event.severity} />}
                </span>
                <span className="event-timeline__message">{event.message}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
