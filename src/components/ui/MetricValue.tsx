// Нэг мэдрэгчийн утга (CLAUDE.md §8.7, FR-M1, FR-M5). Холболтгүй/буруу/байхгүй утгыг ХЭЗЭЭ Ч 0 гэж харуулахгүй.
import { formatMetricValueMn, formatTimeMn, mn } from '@/domain/i18n/mn';
import type { SensorReading } from '@/domain/types';

import { StatusBadge } from './StatusBadge';

interface MetricValueProps {
  label: string;
  /** Байхгүй бол `undefined` — «Өгөгдөлгүй» */
  reading: SensorReading | undefined;
  /** §5.4-ийн нарийвчлал (тохиргооноос дуудагч дамжуулна) */
  decimals: number;
}

export function MetricValue({ label, reading, decimals }: MetricValueProps) {
  const unavailable =
    reading === undefined ||
    reading.value === null ||
    reading.status === 'offline' ||
    reading.status === 'invalid';

  let value: string;
  if (reading === undefined || reading.status === 'offline' || reading.value === null) {
    value = mn.common.noData;
  } else if (reading.status === 'invalid') {
    value = mn.classification.statusLabel.invalid;
  } else {
    value = formatMetricValueMn(reading.value, reading.unit, decimals);
  }

  // Сүүлийн мэдэгдэж буй утга — бүдэг, хугацаатай (FR-M5)
  const lastKnown =
    unavailable && reading?.lastValidValue != null && reading.lastValidAt != null
      ? `${mn.common.lastValue}: ${formatMetricValueMn(reading.lastValidValue, reading.unit, decimals)} · ${formatTimeMn(reading.lastValidAt)}`
      : null;

  return (
    <div className="ui-metric" data-status={reading?.status ?? 'missing'}>
      <span className="ui-metric__label">{label}</span>
      <span
        className={
          unavailable ? 'ui-metric__value ui-metric__value--unavailable' : 'ui-metric__value'
        }
      >
        {value}
        {/* Буруу утгын шошго утга дотор аль хэдийн байгаа тул тэмдгийг давхардуулахгүй */}
        {reading !== undefined && reading.status !== 'normal' && reading.status !== 'invalid' && (
          <StatusBadge status={reading.status} />
        )}
        {reading?.connection === 'stale' && (
          <span className="ui-metric__note">{mn.common.stale}</span>
        )}
      </span>
      {lastKnown !== null && <span className="ui-metric__note">{lastKnown}</span>}
      {reading?.explanation && reading.status !== 'offline' && (
        <span className="ui-metric__note">{reading.explanation}</span>
      )}
    </div>
  );
}
