// Сонгосон давхрын дэлгэрэнгүй: давхрын төлөв, бүс бүрийн 5 утга ба ангилал (FR-M1, FR-M3, FR-M5, CLAUDE.md §8.2).
// Тоон босго энд байхгүй — ангилал, тайлбар snapshot-оос, нарийвчлал тохиргооноос (FR-M2).
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState, HealthIndicator, MetricValue, Panel, Skeleton } from '@/components/ui';
import { METRICS } from '@/domain/config/building';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatMetricValueMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { SensorReading } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import {
  selectAreaSummary,
  selectFloorSummary,
  type AreaConnectionSummary,
  type AreaSummary,
} from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import { RoomScenarioConfirm } from './RoomScenarioConfirm';
import { RoomScenarios } from './RoomScenarios';
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

/** Нягт мөрийн утга — холболтгүй/буруу утгыг хэзээ ч 0 гэж харуулахгүй (FR-M5; MetricValue-тэй ижил дүрэм) */
function compactValue(reading: SensorReading | undefined, decimals: number): string {
  if (reading === undefined || reading.status === 'offline' || reading.value === null) {
    return mn.common.noData;
  }
  if (reading.status === 'invalid') return mn.classification.statusLabel.invalid;
  return formatMetricValueMn(reading.value, reading.unit, decimals);
}

/** Бүсийн бүтэн дэлгэрэнгүй: хэмжилтийн мөр + 5 утга */
function AreaBody({ readings, connection }: Pick<AreaSummary, 'readings' | 'connection'>) {
  return (
    <>
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
    </>
  );
}

/**
 * Өрөөний нягт мөр (D89): нэр + төлөв + гол утга; дарахад бүтэн дэлгэрэнгүй задарна. Гол утга нь хамгийн муу
 * төлөвтэй хэмжигдэхүүн (selector тооцно).
 */
function RoomRow({ summary }: { summary: AreaSummary }) {
  const [manualOpen, setManualOpen] = useState(false);
  const { area, readings, health, connection, keyMetric } = summary;
  // 3D-д өрөө (шошго эсвэл мэдрэгчийн зангилаа) сонгогдоход мөр задарна (С7, D93)
  const selected = useUiStore((state) => state.selectedAreaId === area.id);
  const selectArea = useUiStore((state) => state.selectArea);
  const open = manualOpen || selected;
  // Хаагдах үед агуулга шилжилт дуустал үлдэнэ (D94); хөдөлгөөн багасгах үед шууд
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  if (!open && rendered && reducedMotion) setRendered(false);
  const rowRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // jsdom-д scrollIntoView байхгүй
    if (selected) rowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  const toggle = () => {
    if (open) {
      setManualOpen(false);
      if (selected) selectArea(null);
    } else {
      setManualOpen(true);
    }
  };
  const bodyId = `room-${area.id}`;
  return (
    <li ref={rowRef} className="floor-details__room">
      <button
        type="button"
        className="floor-details__room-row"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className="floor-details__room-name">
          {area.name}
          {area.controlRole === 'monitorOnly' && (
            <span className="floor-details__room-tag">{mn.common.rooms.monitorOnly}</span>
          )}
        </span>
        <span className="floor-details__room-value">
          {mn.metrics.shortLabel[keyMetric]}{' '}
          {compactValue(readings[keyMetric], metricSpecs[keyMetric].decimals)}
        </span>
        <HealthIndicator {...health} />
      </button>
      <div
        className="floor-details__room-collapse"
        data-open={open}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !open) setRendered(false);
        }}
      >
        <div className="floor-details__room-collapse-inner">
          {rendered && (
            <section
              id={bodyId}
              className="floor-details__room-body"
              aria-label={area.name}
              // Хаагдаж буй агуулга дэлгэц уншигч ба гарын focus-ээс гадуур
              aria-hidden={open ? undefined : true}
              inert={!open}
            >
              <AreaBody readings={readings} connection={connection} />
              <RoomScenarios area={area} />
            </section>
          )}
        </div>
      </div>
    </li>
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
  // Нээлттэй бүс (А/Б) бүтнээр, өрөө нягт мөрөөр (D89)
  const openAreas = areas.filter(({ area }) => area.roomKind === null);
  const rooms = areas.filter(({ area }) => area.roomKind !== null);
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
        {openAreas.map(({ area, readings, health, connection }) => (
          <section key={area.id} className="floor-details__area" aria-label={area.name}>
            <div className="floor-details__area-heading">
              <h4 className="floor-details__area-name">{area.name}</h4>
              <HealthIndicator {...health} />
            </div>
            <AreaBody readings={readings} connection={connection} />
          </section>
        ))}
        {rooms.length > 0 && (
          <div className="floor-details__area">
            <h4 className="floor-details__area-name">{mn.common.rooms.heading}</h4>
            {/* key — өөр давхар сонгоход задарсан төлөв цэвэрлэгдэнэ */}
            <ul className="floor-details__rooms" key={summary.floor.id}>
              {rooms.map((room) => (
                <RoomRow key={room.area.id} summary={room} />
              ))}
            </ul>
          </div>
        )}
      </div>
      <RoomScenarioConfirm />
    </Panel>
  );
}
