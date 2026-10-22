// Мэдрэгчийн утга үүсгэх, холболт ба эвдрэл (CLAUDE.md §5.3–5.6, §9.4.1, FR-M5, FR-S5, D69).
// Утгыг шуугиантайгаар илгээж, `classifyReading`-ээр (hysteresis, D49) ангилна. Холболтгүй утга хэзээ ч 0 биш.
import { classifyReading } from '@/domain/classification';
import { sensorNoiseAmplitude } from '@/domain/config/simulation';
import { indoorThresholds, metricSpecs, timingThresholds } from '@/domain/config/thresholds';
import type {
  ConnectionStatus,
  MetricType,
  ReadingClassification,
  Sensor,
  SensorReading,
  SimTimeMs,
} from '@/domain/types';

import { uniformNoise, type Rng } from './rng';

/**
 * Симуляцийн эвдрэл (FR-S5): салгалт — тэр даруй `offline`; буруу утга — мэдрэгч зааж өгсөн утгыг илгээнэ.
 * Зөвхөн симуляци — жинхэнэ мэдрэгчид хамаарахгүй (§1.3).
 */
export type SensorFault = { kind: 'disconnected' } | { kind: 'invalid'; value: number };

/**
 * Сүүлд утга ирснээс хойшх хугацаагаар холболтын төлөв (§5.5): `sensorStaleAfterMs`-ээс их бол `stale`,
 * `sensorOfflineAfterMs`-ээс их бол `offline`. Прототипт мэдрэгч алхам бүрт утга илгээдэг тул голчлон ирээдүйн
 * өгөгдлийн эх сурвалжид хэрэгтэй ч логик нь одооноос тестлэгдэнэ.
 */
export function connectionStatus(
  now: SimTimeMs,
  lastReceivedAt: SimTimeMs,
  thresholds: Pick<
    typeof timingThresholds,
    'sensorStaleAfterMs' | 'sensorOfflineAfterMs'
  > = timingThresholds,
): ConnectionStatus {
  const age = now - lastReceivedAt;
  if (age > thresholds.sensorOfflineAfterMs) return 'offline';
  if (age > thresholds.sensorStaleAfterMs) return 'stale';
  return 'online';
}

/**
 * Мэдрэгчийн илгээх утга = дотоод төлөв + жигд шуугиан (D69), дараа нь боломжит мужаар clamp (§5.8).
 * RNG-ээс үргэлж яг нэг тоо авна — эвдрэлээс үл хамааран дараалал тогтвортой (давтагдах байдал).
 */
export function emitValue(trueValue: number, metric: MetricType, rng: Rng): number {
  const spec = metricSpecs[metric];
  const noisy = trueValue + uniformNoise(rng, sensorNoiseAmplitude[metric]);
  return Math.min(spec.validMax, Math.max(spec.validMin, noisy));
}

const classificationOf = (reading: SensorReading | null): ReadingClassification | null =>
  reading === null
    ? null
    : {
        status: reading.status,
        levels: reading.levels,
        condition: reading.condition,
        explanation: reading.explanation,
      };

/**
 * Салгалтын агшны утга (§9.4.1): бүх талбарыг зэрэг `offline` болгоно — `value: null`, `levels`/`condition` `null`,
 * «Өгөгдөлгүй» тайлбар; сүүлийн зөв утга ба хугацаа хадгалагдана (FR-M5). `timestamp` нь сүүлийн зөв утгынх (§10).
 */
export function disconnectedReading(previous: SensorReading): SensorReading {
  return {
    ...previous,
    value: null,
    timestamp: previous.lastValidAt ?? previous.timestamp,
    connection: 'offline',
    ...classifyReading(previous.metric, null, 'offline', null, null),
  };
}

export interface NextReadingInput {
  sensor: Sensor;
  previous: SensorReading | null;
  /** `emitValue`-ээр үүсгэсэн шуугиантай утга */
  measured: number;
  fault: SensorFault | null;
  now: SimTimeMs;
}

/** Нэг алхмын шинэ утга. Дотоод мэдрэгч дотоод босгоор, гадна мэдрэгч зөвхөн зөв эсэхээр ангилагдана (§5.5, §5.6). */
export function nextReading({
  sensor,
  previous,
  measured,
  fault,
  now,
}: NextReadingInput): SensorReading {
  if (fault?.kind === 'disconnected') {
    if (previous !== null) return disconnectedReading(previous);
    // Анхнаасаа салсан: сүүлийн зөв утга огт байхгүй
    return {
      sensorId: sensor.id,
      metric: sensor.metric,
      value: null,
      unit: sensor.unit,
      timestamp: now,
      lastValidValue: null,
      lastValidAt: null,
      connection: 'offline',
      ...classifyReading(sensor.metric, null, 'offline', null, null),
      source: 'simulated',
    };
  }

  const value = fault?.kind === 'invalid' ? fault.value : measured;
  const classification = classifyReading(
    sensor.metric,
    value,
    'online',
    classificationOf(previous),
    sensor.location === 'indoor' ? indoorThresholds : null,
  );
  const valid = classification.status !== 'invalid';
  return {
    sensorId: sensor.id,
    metric: sensor.metric,
    value,
    unit: sensor.unit,
    timestamp: now,
    lastValidValue: valid ? value : (previous?.lastValidValue ?? null),
    lastValidAt: valid ? now : (previous?.lastValidAt ?? null),
    connection: 'online',
    ...classification,
    source: 'simulated',
  };
}
