import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { SensorReading } from '@/domain/types';

import { MetricValue } from './MetricValue';

const base: SensorReading = {
  sensorId: 'F01-A-co2',
  metric: 'co2',
  value: 640,
  unit: 'ppm',
  timestamp: 0,
  lastValidValue: 640,
  lastValidAt: 0,
  connection: 'online',
  status: 'normal',
  levels: { kind: 'one-sided', high: 'normal' },
  condition: null,
  explanation: null,
  source: 'simulated',
};

const valueText = () => screen.getByText(mn.metrics.label.co2).parentElement!;

describe('MetricValue (FR-M5)', () => {
  it('утга байхгүй (undefined) бол «Өгөгдөлгүй», 0 биш', () => {
    render(<MetricValue label={mn.metrics.label.co2} reading={undefined} decimals={0} />);
    expect(valueText()).toHaveAttribute('data-status', 'missing');
    expect(valueText()).toHaveTextContent(mn.common.noData);
    expect(valueText()).not.toHaveTextContent(/\b0\b/);
  });

  it('холболтгүй бол «Өгөгдөлгүй» + сүүлийн мэдэгдэж буй утга', () => {
    const offline: SensorReading = {
      ...base,
      value: null,
      connection: 'offline',
      status: 'offline',
      levels: null,
      explanation: 'тайлбар',
    };
    render(<MetricValue label={mn.metrics.label.co2} reading={offline} decimals={0} />);
    expect(valueText()).toHaveTextContent(mn.common.noData);
    expect(valueText()).toHaveTextContent(`${mn.common.lastValue}: 640 ppm`);
    expect(valueText()).toHaveTextContent(mn.classification.statusLabel.offline);
  });

  it('буруу утгыг тоогоор биш «Буруу утга» гэж харуулна', () => {
    const invalid: SensorReading = { ...base, value: 0, status: 'invalid', levels: null };
    render(<MetricValue label={mn.metrics.label.co2} reading={invalid} decimals={0} />);
    expect(valueText()).toHaveAttribute('data-status', 'invalid');
    expect(valueText()).toHaveTextContent(mn.classification.statusLabel.invalid);
    expect(valueText()).not.toHaveTextContent(/(^|\D)0 ppm/);
  });

  it('хуучирсан утгыг тэмдэглэнэ', () => {
    render(
      <MetricValue
        label={mn.metrics.label.co2}
        reading={{ ...base, connection: 'stale' }}
        decimals={0}
      />,
    );
    expect(valueText()).toHaveTextContent('640 ppm');
    expect(valueText()).toHaveTextContent(mn.common.stale);
  });
});
