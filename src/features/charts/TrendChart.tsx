// Сонгосон давхрын хандлагын график (UC-8, FR-T1, FR-T2, CLAUDE.md §4.6, §5.6, §8.2). Нэг удаад нэг хэмжигдэхүүн
// (сольж болно), босгын шугам ба зурвастай. Утга нь давхрын хамгийн их утга (§5.6); зөв хэмжилтгүй цэг тасархай —
// хэзээ ч тэг биш (FR-M5). Зөвхөн өөрийн цувааг нарийн selector-оор уншина, тиймээс шинэ алхам ирэхэд dashboard
// бүхэлдээ биш, зөвхөн энэ график дахин зурагдана (FR-T2, §11.2).
import { lazy, Suspense, useId, useMemo, useState } from 'react';

import { EmptyState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { buildingConfig, METRICS } from '@/domain/config/building';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, formatMetricValueMn, mn } from '@/domain/i18n/mn';
import type { MetricType, TrendPoint } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { selectTrendChart, selectTrendPoints } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import './TrendChart.css';

const text = mn.common.trends;
const EMPTY: readonly TrendPoint[] = [];
/** Lazy ачаалагдах хүртэлх орлуулагчийн өндөр (layout шилжихгүй) — TrendPlot-ийнхтэй ижил */
const CHART_HEIGHT = 220;
// Recharts-ийг тусдаа chunk-аар ачаална (D82)
const TrendPlot = lazy(() => import('./TrendPlot'));

/** Анхдагч хэмжигдэхүүн — агааржуулалтын гол үзүүлэлт (§6.3) */
const DEFAULT_METRIC: MetricType = 'co2';

export function TrendChart() {
  const selectId = useId();
  const [metric, setMetric] = useState<MetricType>(DEFAULT_METRIC);
  const floorId = useUiStore((state) => state.selectedFloorId);
  const hasSnapshot = useLiveStore((state) => state.snapshot !== null);
  // Нарийн selector: зөвхөн энэ давхар × хэмжигдэхүүний цуваа өөрчлөгдөхөд дахин зурагдана
  const points = useLiveStore((state) =>
    state.snapshot !== null && floorId !== null
      ? selectTrendPoints(state.snapshot, floorId, metric)
      : EMPTY,
  );
  const data = useMemo(() => selectTrendChart(points, metric), [points, metric]);

  const title = mn.common.regions.trends;
  if (!hasSnapshot) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }

  const spec = metricSpecs[metric];
  const format = (value: number) => formatMetricValueMn(value, spec.unit, spec.decimals);
  const floor = floorId === null ? undefined : buildingConfig.floors[floorId];
  const floorLabel = floor === undefined ? null : floorLabelMn(floor.level);
  const summaryValue = (value: number | null) => (value === null ? text.noValue : format(value));

  const metricSelect = (
    <span className="trend-chart__control">
      <label htmlFor={selectId}>{text.metricLabel}</label>
      <select
        id={selectId}
        className="trend-chart__select"
        value={metric}
        onChange={(event) => setMetric(event.target.value as MetricType)}
      >
        {METRICS.map((option) => (
          <option key={option} value={option}>
            {mn.metrics.label[option]}
          </option>
        ))}
      </select>
    </span>
  );

  return (
    <Panel title={title} meta={floorLabel ?? undefined} className="trend-chart">
      {metricSelect}
      {floorLabel === null ? (
        <EmptyState message={text.noFloor} />
      ) : data.domain === null ? (
        <EmptyState message={text.noData} />
      ) : (
        <>
          <dl className="trend-chart__summary">
            <div>
              <dt>{text.latest}</dt>
              <dd>{summaryValue(data.latest)}</dd>
            </div>
            <div>
              <dt>{text.max}</dt>
              <dd>{summaryValue(data.max)}</dd>
            </div>
            <div>
              <dt>{text.min}</dt>
              <dd>{summaryValue(data.min)}</dd>
            </div>
          </dl>
          {/* Графикийг нэг зураг гэж уншуулна; утгыг дээрх бичвэр ба давхрын дэлгэрэнгүй (2D) өгнө (§8.8) */}
          <div
            className="trend-chart__plot"
            role="img"
            aria-label={text.chartLabel(floorLabel, mn.metrics.label[metric])}
          >
            <Suspense fallback={<div style={{ height: CHART_HEIGHT }} aria-hidden="true" />}>
              <TrendPlot points={points} data={data} metric={metric} />
            </Suspense>
          </div>
          <p className="trend-chart__note">{text.seriesNote}</p>
          <ul className="trend-chart__legend" aria-label={text.thresholdsLabel}>
            {data.thresholds.map((threshold) => (
              <li key={`${threshold.condition}-${threshold.level}`}>
                <StatusBadge
                  status={threshold.level}
                  label={text.threshold(
                    threshold.side,
                    mn.classification.statusLabel[threshold.level],
                    format(threshold.value),
                  )}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
