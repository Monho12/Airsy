// Хандлагын графикийн Recharts хэсэг (D82). `TrendChart` үүнийг `React.lazy`-аар ачаална — Recharts нь үндсэн
// bundle-д орохгүй, dashboard графикийн сан ачаалагдахаас өмнө харагдана (§11.3-ын 3D-тэй ижил зарчим).
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { metricSpecs } from '@/domain/config/thresholds';
import { formatMetricValueMn, formatNumberMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { MetricType, TrendPoint } from '@/domain/types';
import type { TrendChartData } from '@/store/selectors';

import { niceTicks } from './niceTicks';

const text = mn.common.trends;
const CHART_HEIGHT = 220;

export default function TrendPlot({
  points,
  data,
  metric,
}: {
  points: readonly TrendPoint[];
  data: TrendChartData;
  metric: MetricType;
}) {
  const spec = metricSpecs[metric];
  const format = (value: number) => formatMetricValueMn(value, spec.unit, spec.decimals);
  return (
    <ResponsiveContainer
      width="100%"
      height={CHART_HEIGHT}
      initialDimension={{ width: 640, height: CHART_HEIGHT }}
    >
      <LineChart
        data={points as TrendPoint[]}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid className="trend-chart__grid" vertical={false} />
        {data.bands.map((band) => (
          <ReferenceArea
            key={`${band.level}-${band.from}`}
            className={`trend-chart__band trend-chart__band--${band.level}`}
            y1={band.from}
            y2={band.to}
            ifOverflow="hidden"
          />
        ))}
        {data.thresholds.map((threshold) => (
          <ReferenceLine
            key={`${threshold.condition}-${threshold.level}`}
            className={`trend-chart__threshold trend-chart__threshold--${threshold.level}`}
            y={threshold.value}
            // Ноцтой — тасралтгүй, анхааруулга — тасархай (зөвхөн өнгөөр биш, §8.3)
            strokeDasharray={threshold.level === 'warning' ? '6 4' : undefined}
            ifOverflow="discard"
          />
        ))}
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(value: number) => formatTimeMn(value)}
          tickCount={4}
          minTickGap={24}
        />
        <YAxis
          domain={data.domain ?? ['auto', 'auto']}
          // Тэнхлэгийн тэмдэглэгээ дугуй тоогоор (674, 764… биш; D102)
          ticks={data.domain === null ? undefined : niceTicks(data.domain[0], data.domain[1])}
          allowDataOverflow
          width={56}
          tickFormatter={(value: number) => formatNumberMn(value, spec.decimals)}
        />
        <Tooltip
          isAnimationActive={false}
          labelFormatter={(label) => formatTimeMn(Number(label))}
          formatter={(value) => [
            typeof value === 'number' ? format(value) : text.noValue,
            mn.metrics.shortLabel[metric],
          ]}
          contentStyle={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
          }}
          labelStyle={{ color: 'var(--color-text-secondary)' }}
          itemStyle={{ color: 'var(--color-text-primary)' }}
        />
        {/* Шинэчлэл бүрт анимаци хийхгүй — шугам зөвхөн шилжинэ, анивчихгүй (FR-T2, §8.5) */}
        <Line
          className="trend-chart__line"
          type="linear"
          dataKey="value"
          dot={false}
          activeDot={{ r: 3 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
