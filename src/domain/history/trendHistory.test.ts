// Хандлагын хязгаартай buffer (§5.6, §11.4).
import { describe, expect, it } from 'vitest';

import { bufferLimits } from '@/domain/config/simulation';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';

import { appendTrendPoints, createTrendHistory } from './trendHistory';

const aggregates: FloorAggregates = {
  F01: {
    co2: { max: 700, min: 600, validCount: 2, levels: { kind: 'one-sided', high: 'normal' } },
  },
};

describe('appendTrendPoints', () => {
  it('утга нь давхрын нэгтгэлийн max; зөв хэмжилтгүй бол null (тэг биш)', () => {
    const history = appendTrendPoints(createTrendHistory(['F01']), 1000, aggregates);
    expect(history['F01']!.co2).toEqual([{ t: 1000, value: 700 }]);
    expect(history['F01']!.temperature).toEqual([{ t: 1000, value: null }]);
  });

  it(`цуваа бүр ${bufferLimits.trendPointsPerSeries} цэгээр хязгаартай`, () => {
    let history = createTrendHistory(['F01']);
    for (let t = 0; t < bufferLimits.trendPointsPerSeries + 10; t += 1) {
      history = appendTrendPoints(history, t, aggregates);
    }
    expect(history['F01']!.co2).toHaveLength(bufferLimits.trendPointsPerSeries);
    expect(history['F01']!.co2[0]!.t).toBe(10);
  });
});
