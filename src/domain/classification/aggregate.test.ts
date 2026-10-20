import { describe, expect, it } from 'vitest';

import { indoorThresholds, metricSpecs, timingThresholds } from '@/domain/config/thresholds';
import type { ConnectionStatus, MetricType, SensorReading } from '@/domain/types';

import { aggregateFloorMetric } from './aggregate';
import { classifyReading } from './classifyReading';
import { isValidMeasurement } from './isValidMeasurement';

const NOW = 1_000_000;

/** Тестэд зориулсан утга — ангиллыг жинхэнэ classifyReading-ээр. */
function reading(
  metric: MetricType,
  value: number | null,
  options: { connection?: ConnectionStatus; timestamp?: number; id?: string } = {},
): SensorReading {
  const connection = options.connection ?? 'online';
  const classification = classifyReading(metric, value, connection, null, indoorThresholds);
  return {
    sensorId: options.id ?? `F07-A-${metric}`,
    metric,
    value: connection === 'offline' ? null : value,
    unit: metricSpecs[metric].unit,
    timestamp: options.timestamp ?? NOW,
    lastValidValue: null,
    lastValidAt: null,
    connection,
    ...classification,
    source: 'simulated',
  };
}

describe('isValidMeasurement (§5.5)', () => {
  const base = reading('co2', 700);

  it('online, хэвийн, төгсгөлөг, шинэ → зөв', () => {
    expect(isValidMeasurement(base, NOW)).toBe(true);
  });

  it('хуучрах хил: яг sensorStaleAfterMs → зөв; +1 ms → зөв биш', () => {
    const stale = timingThresholds.sensorStaleAfterMs;
    expect(isValidMeasurement({ ...base, timestamp: NOW - stale }, NOW)).toBe(true);
    expect(isValidMeasurement({ ...base, timestamp: NOW - stale - 1 }, NOW)).toBe(false);
  });

  it.each<[string, Partial<SensorReading>]>([
    ['connection stale', { connection: 'stale' }],
    ['connection offline', { connection: 'offline' }],
    ['status invalid', { status: 'invalid' }],
    ['status offline', { status: 'offline' }],
    ['value null', { value: null }],
    ['value NaN', { value: Number.NaN }],
    ['value Infinity', { value: Number.POSITIVE_INFINITY }],
  ])('%s → зөв биш (хэзээ ч 0 эсвэл сүүлийн утга биш)', (_, patch) => {
    expect(isValidMeasurement({ ...base, ...patch }, NOW)).toBe(false);
  });
});

describe('aggregateFloorMetric (§5.6, FloorMetricAggregate)', () => {
  it('зөвхөн зөв хэмжилтээс: холболтгүй, буруу, хуучирсныг үл тооно', () => {
    const aggregate = aggregateFloorMetric(
      [
        reading('co2', indoorThresholds.co2.warningEnter + 100, { id: 'F07-A-co2' }),
        reading('co2', 800, { id: 'F07-B-co2', connection: 'offline' }),
        reading('co2', 0, { id: 'F07-C-co2' }), // буруу (300-аас бага)
        reading('co2', 2000, {
          id: 'F07-D-co2',
          timestamp: NOW - timingThresholds.sensorStaleAfterMs - 1,
        }),
      ],
      NOW,
    );
    expect(aggregate).toEqual({
      max: indoorThresholds.co2.warningEnter + 100,
      min: indoorThresholds.co2.warningEnter + 100,
      validCount: 1,
      levels: { kind: 'one-sided', high: 'warning' },
    });
  });

  it('зөв хэмжилт нэг ч байхгүй бол undefined (тэг биш)', () => {
    expect(
      aggregateFloorMetric(
        [
          reading('co2', 800, { connection: 'offline' }),
          reading('co2', Number.NaN, { id: 'F07-B-co2' }),
        ],
        NOW,
      ),
    ).toBeUndefined();
    expect(aggregateFloorMetric([], NOW)).toBeUndefined();
  });

  it('хоёр талт: max/min ба тал бүрийн хамгийн муу түвшин', () => {
    const high = indoorThresholds['temperature-high'].warningEnter;
    const low = indoorThresholds['temperature-low'].criticalEnter;
    expect(
      aggregateFloorMetric(
        [
          reading('temperature', high, { id: 'F07-A-temperature' }),
          reading('temperature', low, { id: 'F07-B-temperature' }),
        ],
        NOW,
      ),
    ).toEqual({
      max: high,
      min: low,
      validCount: 2,
      levels: { kind: 'two-sided', high: 'warning', low: 'critical' },
    });
  });

  it('өөр хэмжигдэхүүн холивол алдаа', () => {
    expect(() => aggregateFloorMetric([reading('co2', 700), reading('voc', 100)], NOW)).toThrow();
  });
});
