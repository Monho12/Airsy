// Хандлагын график (UC-8, FR-T1, FR-T2, §8.7, §8.8).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { floorLabelMn, formatMetricValueMn, mn } from '@/domain/i18n/mn';
import type { LiveSnapshot, MetricType } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { TrendChart } from './TrendChart';

const text = mn.common.trends;

function withSeries(
  snapshot: LiveSnapshot,
  metric: MetricType,
  values: (number | null)[],
): LiveSnapshot {
  const floor = snapshot.history.F02!;
  return {
    ...snapshot,
    history: {
      ...snapshot.history,
      F02: {
        ...floor,
        [metric]: values.map((value, i) => ({ t: snapshot.simTime + i * 1000, value })),
      },
    },
  };
}

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
  useUiStore.setState(initialUiState);
});

describe('TrendChart', () => {
  it('эхний snapshot-оос өмнө ачаалж буй төлөв', () => {
    render(<TrendChart />);
    expect(screen.getByRole('status')).toHaveTextContent(mn.common.loading);
  });

  it('давхар сонгоогүй бол сонгохыг санал болгоно', () => {
    applySnapshot(createMockSnapshot());
    render(<TrendChart />);
    expect(screen.getByText(text.noFloor)).toBeInTheDocument();
  });

  it('зөв утга байхгүй бол «өгөгдөлгүй» — график ба тэг зурахгүй', () => {
    applySnapshot(withSeries(createMockSnapshot(), 'co2', [null, null]));
    useUiStore.getState().selectFloor('F02');
    render(<TrendChart />);
    expect(screen.getByText(text.noData)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('сонгосон давхрын CO₂: хураангуй, графикийн шошго, босгын тайлбар', () => {
    applySnapshot(withSeries(createMockSnapshot(), 'co2', [700, 760, 742]));
    useUiStore.getState().selectFloor('F02');
    render(<TrendChart />);
    const region = screen.getByRole('region', { name: mn.common.regions.trends });
    expect(region).toHaveTextContent(floorLabelMn(2));
    const summary = within(region).getByText(text.latest).closest('div')!;
    expect(summary).toHaveTextContent(formatMetricValueMn(742, 'ppm', 0));
    expect(
      screen.getByRole('img', { name: text.chartLabel(floorLabelMn(2), mn.metrics.label.co2) }),
    ).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: text.thresholdsLabel });
    expect(legend).toHaveTextContent(
      text.threshold(
        'high',
        mn.classification.statusLabel.warning,
        formatMetricValueMn(1000, 'ppm', 0),
      ),
    );
  });

  it('Recharts-ийн хэсэг lazy ачаалагдаж, босгын шугамтай SVG зурна', async () => {
    applySnapshot(withSeries(createMockSnapshot(), 'co2', [700, 1100, 1050]));
    useUiStore.getState().selectFloor('F02');
    render(<TrendChart />);
    const plot = screen.getByRole('img', {
      name: text.chartLabel(floorLabelMn(2), mn.metrics.label.co2),
    });
    // Бүтэн suite ачаалалтай үед lazy chunk-ийн импорт 1 с-ээс удаан болдог тул хүлээх хугацааг уртасгав
    // (шалгах үр дүн өөрчлөгдөөгүй; D76, D81-тэй ижил арга)
    await waitFor(() => expect(plot.querySelector('svg')).not.toBeNull(), { timeout: 15_000 });
    await waitFor(
      () => expect(plot.querySelectorAll('.trend-chart__threshold').length).toBeGreaterThan(0),
      { timeout: 15_000 },
    );
  }, 30_000);

  it('хэмжигдэхүүн сольход тухайн цуваа ба босгыг харуулна', async () => {
    let snapshot = withSeries(createMockSnapshot(), 'co2', [700]);
    snapshot = withSeries(snapshot, 'temperature', [22.5, 23.1]);
    applySnapshot(snapshot);
    useUiStore.getState().selectFloor('F02');
    render(<TrendChart />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(text.metricLabel), 'temperature');
    const region = screen.getByRole('region', { name: mn.common.regions.trends });
    expect(within(region).getByText(text.latest).closest('div')).toHaveTextContent(
      formatMetricValueMn(23.1, '°C', 1),
    );
    // Температур хоёр талт — бага талын босго ч тайлбарт гарна
    expect(screen.getByRole('list', { name: text.thresholdsLabel })).toHaveTextContent(
      text.threshold(
        'low',
        mn.classification.statusLabel.warning,
        formatMetricValueMn(19, '°C', 1),
      ),
    );
  });

  it('шинэ snapshot ирэхэд хураангуй шууд шинэчлэгдэнэ (FR-T2)', () => {
    const base = createMockSnapshot();
    applySnapshot(withSeries(base, 'co2', [700]));
    useUiStore.getState().selectFloor('F02');
    render(<TrendChart />);
    act(() => applySnapshot(withSeries(base, 'co2', [700, 1180])));
    const region = screen.getByRole('region', { name: mn.common.regions.trends });
    expect(within(region).getByText(text.latest).closest('div')).toHaveTextContent(
      formatMetricValueMn(1180, 'ppm', 0),
    );
  });
});
