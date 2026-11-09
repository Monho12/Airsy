// Үйл явдлын түүх (UC-9, FR-A3, CLAUDE.md §8.2, §11.4): шинэ нь эхэнд, ангилал / ач холбогдол / давхраар шүүнэ.
// Ring buffer-ийн бүх үйл явдлыг (≤ 500) шүүж, эхний 50-ийг зурна; «Цааш харуулах» дараагийн 50-ийг нэмнэ (§11.4:
// бүрэн түүхийг хуудаслана). Шүүлт нь `uiStore`-д (§10.2, D83).
import { useMemo, useState } from 'react';

import {
  Button,
  EmptyState,
  FilterDisclosure,
  Panel,
  SelectField,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { buildingConfig } from '@/domain/config/building';
import { floorLabelMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { SystemEvent } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { RECENT_EVENT_LIMIT, selectFilteredEvents } from '@/store/selectors';
import { defaultEventFilter, useUiStore, type EventFilter } from '@/store/uiStore';

import { stripTypePrefix } from './stripTypePrefix';
import './EventTimeline.css';

const text = mn.events;
const f = text.filter;

const categoryOptions: { value: EventFilter['category']; label: string }[] = [
  { value: 'all', label: f.all },
  ...(Object.keys(text.category) as SystemEvent['category'][]).map((category) => ({
    value: category,
    label: text.category[category],
  })),
];

const severityOptions: { value: EventFilter['severity']; label: string }[] = [
  { value: 'all', label: f.all },
  ...(['info', 'warning', 'critical'] as const).map((severity) => ({
    value: severity,
    label: text.severity[severity],
  })),
];

const floorOptions: { value: EventFilter['floor']; label: string }[] = [
  { value: 'all', label: f.all },
  ...[...buildingConfig.building.floorIds].reverse().map((floorId) => ({
    value: floorId,
    label: floorLabelMn(buildingConfig.floors[floorId]?.level ?? 0),
  })),
];

export function EventTimeline() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const filter = useUiStore((state) => state.eventFilter);
  const setFilter = useUiStore((state) => state.setEventFilter);
  // Хуудаслалт: шүүлт өөрчлөгдөхөд эхний хуудас руу буцна
  const [page, setPage] = useState({ filter, count: RECENT_EVENT_LIMIT });
  const visibleCount = page.filter === filter ? page.count : RECENT_EVENT_LIMIT;
  const events = useMemo(
    () => (snapshot ? selectFilteredEvents(snapshot, filter) : []),
    [snapshot, filter],
  );

  const title = mn.common.regions.events;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }

  const activeFilterCount = [filter.category, filter.severity, filter.floor].filter(
    (value) => value !== 'all',
  ).length;
  const filtered = activeFilterCount > 0;
  const visible = events.slice(0, visibleCount);

  return (
    <Panel title={title} meta={events.length}>
      {/* Шүүлт нээгддэг хэсэгт (D101) — түүх өөрөө самбарын гол агуулга */}
      <FilterDisclosure activeCount={activeFilterCount}>
        <fieldset className="ui-filter-bar">
          <legend className="visually-hidden">{f.label}</legend>
          <SelectField
            label={f.category}
            value={filter.category}
            options={categoryOptions}
            onChange={(category) => setFilter({ category })}
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
          {filtered && (
            <Button className="ui-button--secondary" onClick={() => setFilter(defaultEventFilter)}>
              {f.reset}
            </Button>
          )}
        </fieldset>
      </FilterDisclosure>
      {visible.length === 0 ? (
        <EmptyState message={filtered ? f.noMatch : text.empty} />
      ) : (
        <>
          <ol className="event-timeline">
            {visible.map((event) => (
              <li key={event.id} className="event-timeline__item">
                <time className="event-timeline__time">{formatTimeMn(event.timestamp)}</time>
                <div className="event-timeline__body">
                  <span className="event-timeline__type">
                    {text.type[event.type]}
                    {event.severity !== 'info' && <StatusBadge status={event.severity} />}
                  </span>
                  <span className="event-timeline__message">
                    {stripTypePrefix(event.message, text.type[event.type])}
                  </span>
                  {/* Удирдлагын шийдвэрийн шалтгаан (FR-C5, §6.2) — мессежээс ялгаатай бол */}
                  {event.reason !== undefined && event.reason !== event.message && (
                    <span className="event-timeline__reason">{event.reason}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="event-timeline__footer">
            <span className="event-timeline__count">
              {text.shown(visible.length, events.length)}
            </span>
            {visible.length < events.length && (
              <Button onClick={() => setPage({ filter, count: visibleCount + RECENT_EVENT_LIMIT })}>
                {text.showMore}
              </Button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
