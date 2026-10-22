// Хандлагын хязгаартай buffer (CLAUDE.md §5.6, §11.4). Давхар × хэмжигдэхүүн бүрт алхам бүрийн цэг; утга нь давхрын
// нэгтгэлийн `max` (§5.6 «Графикт max-ийг зурна»), зөв хэмжилтгүй бол `null` (тэг биш). График Phase 6-д.
import { METRICS } from '@/domain/config/building';
import { bufferLimits } from '@/domain/config/simulation';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';
import type { FloorId, SimTimeMs, TrendHistory } from '@/domain/types';

export function createTrendHistory(floorIds: readonly FloorId[]): TrendHistory {
  const history: TrendHistory = {};
  for (const floorId of floorIds) {
    history[floorId] = { temperature: [], co2: [], humidity: [], pm25: [], voc: [] };
  }
  return history;
}

export function appendTrendPoints(
  history: TrendHistory,
  t: SimTimeMs,
  aggregates: FloorAggregates,
  limit: number = bufferLimits.trendPointsPerSeries,
): TrendHistory {
  const next: TrendHistory = {};
  for (const [floorId, series] of Object.entries(history)) {
    const floor = aggregates[floorId];
    const updated = { ...series };
    for (const metric of METRICS) {
      const point = { t, value: floor?.[metric]?.max ?? null };
      updated[metric] = [...series[metric], point].slice(-limit);
    }
    next[floorId] = updated;
  }
  return next;
}
