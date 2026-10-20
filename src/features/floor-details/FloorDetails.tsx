// Сонгосон давхрын дэлгэрэнгүй: давхрын төлөв, бүс бүрийн 5 утга ба ангилал (FR-M1, FR-M3, FR-M5, CLAUDE.md §8.2).
// Тоон босго энд байхгүй — ангилал, тайлбар snapshot-оос, нарийвчлал тохиргооноос (FR-M2).
import { useMemo } from 'react';

import { EmptyState, HealthIndicator, MetricValue, Panel, Skeleton } from '@/components/ui';
import { METRICS } from '@/domain/config/building';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import {
  selectAreaSummary,
  selectFloorSummary,
  type AreaConnectionSummary,
  type AreaSummary,
} from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import './FloorDetails.css';

/** Бүсийн холболтын бичвэр. Нэг ч мэдрэгч холболтгүй/хуучирсан бол «Холбогдсон» гэж хэзээ ч бичихгүй (FR-M1, FR-M5). */
function connectionText({ total, stale, offline }: AreaConnectionSummary): string {
  const { connection, sensorsOffline, sensorsStale } = mn.common;
  if (offline === total) return connection.offline;
  const parts: string[] = [];
  if (offline > 0) parts.push(sensorsOffline(offline));
  if (stale > 0) parts.push(stale === total ? connection.stale : sensorsStale(stale));
  return parts.length > 0 ? parts.join(', ') : connection.online;
}

/** «Хэмжсэн: 09:10:00 · Холбогдсон» — хугацаа нь мэдрэгчийн утгын `timestamp`-аас (симуляцийн цаг) */
function AreaMeasurementMeta({ connection }: { connection: AreaConnectionSummary }) {
  const state = connection.offline > 0 ? 'offline' : connection.stale > 0 ? 'stale' : 'online';
  return (
    <p className="floor-details__area-meta" data-connection={state}>
      {connection.measuredAt !== null && (
        <>
          {mn.common.measuredAt}:{' '}
          <time dateTime={new Date(connection.measuredAt).toISOString()}>
            {formatTimeMn(connection.measuredAt)}
          </time>
          {' · '}
        </>
      )}
      {connectionText(connection)}
    </p>
  );
}

export function FloorDetails() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);

  const data = useMemo(() => {
    if (snapshot === null || selectedFloorId === null) return null;
    const summary = selectFloorSummary(snapshot, selectedFloorId);
    if (summary === undefined) return null;
    const areas = summary.floor.areaIds
      .map((areaId) => selectAreaSummary(snapshot, areaId))
      .filter((area): area is AreaSummary => area !== undefined);
    return { summary, areas };
  }, [snapshot, selectedFloorId]);

  const title = mn.common.regions.floorDetails;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }
  if (data === null) {
    return (
      <Panel title={title}>
        <EmptyState message={mn.common.noFloorSelected} />
      </Panel>
    );
  }

  const { summary, areas } = data;
  return (
    <Panel
      title={title}
      meta={
        summary.activeAlertCount > 0
          ? mn.common.floorAlertCount(summary.activeAlertCount)
          : undefined
      }
    >
      <div className="floor-details">
        <div className="floor-details__heading">
          <h3 className="floor-details__floor">
            {floorLabelMn(summary.floor.level)} · {summary.floor.name}
          </h3>
          <HealthIndicator {...summary.health} />
        </div>
        {areas.map(({ area, readings, health, connection }) => (
          <section key={area.id} className="floor-details__area" aria-label={area.name}>
            <div className="floor-details__area-heading">
              <h4 className="floor-details__area-name">{area.name}</h4>
              <HealthIndicator {...health} />
            </div>
            <AreaMeasurementMeta connection={connection} />
            <div className="floor-details__metrics">
              {METRICS.map((metric) => (
                <MetricValue
                  key={metric}
                  label={mn.metrics.label[metric]}
                  reading={readings[metric]}
                  decimals={metricSpecs[metric].decimals}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}
