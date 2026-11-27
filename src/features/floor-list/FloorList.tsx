// 2D давхрын жагсаалт (FR-B4, CLAUDE.md §8.6, §8.8). Phase 3-т 3D-ийн орлуулах харагдац болно (D31).
// Гарын удирдлага (§8.8): ↑/↓ сонголтыг шилжүүлнэ, Enter/Space сонгоно, Home/End эхлэл/төгсгөл рүү үсэрнэ.
// Дээд давхар эхэнд (§8.2 — барилгын дүрстэй адил), тиймээс ↑ нь дээд давхар руу.
// Жагсаалт өөрөө босоо гүйлгэлттэй (FloorList.css); сонгосон мөрийг үргэлж харагдах хэсэгт байлгана.
import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from 'react';

import { EmptyState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatMetricValueMn, formatNumberMn, mn } from '@/domain/i18n/mn';
import type { FloorId, FloorMetricAggregate, MetricType } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { selectFloorList, type FloorSummary } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import './FloorList.css';

/** Мөрийг жагсаалтын гүйлгэх хэсэгт харагдуулна — аль хэдийн харагдаж байвал юу ч хийхгүй ('nearest'). */
function revealOption(element: HTMLElement | undefined) {
  // jsdom-д scrollIntoView байхгүй тул нөхцөлтэй дуудна
  element?.scrollIntoView?.({ block: 'nearest' });
}

/** Мөрөнд харуулах гол утга (D100): агааржуулалтын үзүүлэлт CO₂ ба температур — давхрын хамгийн их (§5.6) */
const ROW_METRICS: readonly MetricType[] = ['co2', 'temperature'];

function rowMetricText(metric: MetricType, aggregate: FloorMetricAggregate | undefined): string {
  const { unit, decimals } = metricSpecs[metric];
  // Зөв хэмжилтгүй бол «Өгөгдөлгүй» — хэзээ ч 0 биш (FR-M5)
  if (aggregate === undefined) return `${mn.metrics.shortLabel[metric]}: ${mn.common.noData}`;
  // Температурын нэгж (°C) өөрөө тодорхой тул нягт мөрөнд шошгогүй
  if (metric === 'temperature') return formatMetricValueMn(aggregate.max, unit, decimals);
  // Нарийн баганад ppm-ийг орхино — «CO₂ 704» (бүтэн утга нэгжтэй нь «Сонгосон давхар»-т)
  return `${mn.metrics.shortLabel[metric]} ${formatNumberMn(aggregate.max, decimals)}`;
}

function FloorRowMetrics({ aggregates }: { aggregates: FloorSummary['aggregates'] }) {
  return (
    <span className="floor-list__metrics">
      {ROW_METRICS.map((metric) => (
        <span key={metric} className="floor-list__metric">
          {rowMetricText(metric, aggregates[metric])}
        </span>
      ))}
    </span>
  );
}

export function FloorList() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const selectFloor = useUiStore((state) => state.selectFloor);
  const optionRefs = useRef(new Map<FloorId, HTMLLIElement>());
  const hintId = useId();

  const floors = useMemo(
    () => (snapshot ? [...selectFloorList(snapshot)].reverse() : []),
    [snapshot],
  );

  // Сонголт өөр газраас өөрчлөгдсөн ч (Phase 3-т 3D-ээс) сонгосон давхар харагдсаар байна
  useEffect(() => {
    if (selectedFloorId !== null) revealOption(optionRefs.current.get(selectedFloorId));
  }, [selectedFloorId]);

  const title = mn.common.regions.floorList;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }
  if (floors.length === 0) {
    return (
      <Panel title={title}>
        <EmptyState message={mn.common.noData} />
      </Panel>
    );
  }

  // Roving tabindex: сонгосон (эсвэл эхний) давхар л Tab-аар хүрнэ
  const focusableId = floors.some((f) => f.floor.id === selectedFloorId)
    ? selectedFloorId
    : floors[0]!.floor.id;

  const moveTo = (index: number) => {
    const target = floors[Math.max(0, Math.min(floors.length - 1, index))]!;
    selectFloor(target.floor.id);
    // Focus-ийн анхдагч гүйлгэлт хөтөч бүрт өөр байдаг тул өөрсдөө 'nearest'-ээр харагдуулна
    const element = optionRefs.current.get(target.floor.id);
    element?.focus({ preventScroll: true });
    revealOption(element);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, index: number, floorId: FloorId) => {
    switch (event.key) {
      case 'ArrowUp':
        moveTo(index - 1);
        break;
      case 'ArrowDown':
        moveTo(index + 1);
        break;
      case 'Home':
        moveTo(0);
        break;
      case 'End':
        moveTo(floors.length - 1);
        break;
      case 'Enter':
      case ' ':
        selectFloor(floorId);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <Panel title={title}>
      <p className="visually-hidden" id={hintId}>
        {mn.common.floorListHint}
      </p>
      <ul className="floor-list" role="listbox" aria-label={title} aria-describedby={hintId}>
        {floors.map((summary, index) => {
          const { floor, health, activeAlertCount, aggregates } = summary;
          const selected = floor.id === selectedFloorId;
          const shown = health.worstValid ?? health.worst;
          const statusWord =
            shown === 'normal'
              ? health.hasDataIssue
                ? mn.common.dataIssue
                : null
              : mn.classification.statusLabel[shown];
          const statusTone = shown === 'normal' ? 'offline' : shown;
          return (
            <li
              key={floor.id}
              ref={(element) => {
                if (element) optionRefs.current.set(floor.id, element);
                else optionRefs.current.delete(floor.id);
              }}
              role="option"
              aria-selected={selected}
              tabIndex={floor.id === focusableId ? 0 : -1}
              className={
                selected ? 'floor-list__item floor-list__item--selected' : 'floor-list__item'
              }
              onClick={() => selectFloor(floor.id)}
              onKeyDown={(event) => onKeyDown(event, index, floor.id)}
            >
              {/* Нягт мөр (D100): түвшин + төлөв · зориулалт · гол утга — давхрыг дарахгүйгээр харьцуулна */}
              <span className="floor-list__level">{floorLabelMn(floor.level)}</span>
              <span className="floor-list__status">
                {/* Нэг л тэмдэг — өгөгдлийн асуудлыг доорх мөрөнд бичвэрээр (нарийн багана) */}
                <StatusBadge status={shown} compact />
              </span>
              <span className="floor-list__usage" title={floor.name}>
                {/* Хэвийн бус үед төлөвийн бичвэр зориулалтын өмнө (тэмдэг дээр нь — зөвхөн тэмдэг биш) */}
                {statusWord !== null && (
                  <span className={`floor-list__state floor-list__state--${statusTone}`}>
                    {statusWord}
                    {' · '}
                  </span>
                )}
                {floor.name}
                {activeAlertCount > 0 && (
                  <span className="floor-list__alerts">
                    {' · '}
                    {mn.common.floorAlertCount(activeAlertCount)}
                  </span>
                )}
              </span>
              <FloorRowMetrics aggregates={aggregates} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
