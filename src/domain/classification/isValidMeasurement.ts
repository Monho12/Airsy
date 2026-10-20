// Зөв хэмжилтийн цорын ганц дүрэм (CLAUDE.md §5.5, D14).
import { timingThresholds } from '@/domain/config/thresholds';
import type { SensorReading, SimTimeMs } from '@/domain/types';

/**
 * Утга удирдлага ба нэгтгэлд зөвхөн дараах **бүгд** үнэн үед зөв хэмжилт: `connection === 'online'`,
 * `status` нь `invalid`/`offline` биш, `value` нь төгсгөлөг тоо, `now − timestamp ≤ sensorStaleAfterMs`.
 * Бусад бүх тохиолдол — дутуу өгөгдөл (хэзээ ч 0 биш, сүүлийн утга ч биш).
 */
export function isValidMeasurement(
  reading: Pick<SensorReading, 'connection' | 'status' | 'value' | 'timestamp'>,
  now: SimTimeMs,
  staleAfterMs: number = timingThresholds.sensorStaleAfterMs,
): boolean {
  return (
    reading.connection === 'online' &&
    reading.status !== 'invalid' &&
    reading.status !== 'offline' &&
    reading.value !== null &&
    Number.isFinite(reading.value) &&
    now - reading.timestamp <= staleAfterMs
  );
}
