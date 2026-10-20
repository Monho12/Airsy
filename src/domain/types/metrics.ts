// Хэмжигдэхүүн, төлөв, ангиллын төрөл (CLAUDE.md §5.4–5.6, §10).

export type MetricType = 'temperature' | 'co2' | 'humidity' | 'pm25' | 'voc';
export type MetricUnit = '°C' | 'ppm' | '%RH' | 'µg/m³' | 'index';
export type HealthStatus = 'normal' | 'warning' | 'critical' | 'offline' | 'invalid';
export type ConnectionStatus = 'online' | 'stale' | 'offline';
export type Severity = 'info' | 'warning' | 'critical';

/** Босгын дохионы түлхүүрт (§5.2): нэг талтад нэр нь, хоёр талтад өндөр/бага тал тусдаа. */
export type ThresholdConditionId =
  | 'temperature-high'
  | 'temperature-low'
  | 'humidity-high'
  | 'humidity-low'
  | 'co2'
  | 'pm25'
  | 'voc';

export type ThresholdLevel = 'normal' | 'warning' | 'critical';

/** §5.6; нэг талт: co2, pm25, voc · хоёр талт: temperature, humidity */
export type ThresholdLevels =
  | { kind: 'one-sided'; high: ThresholdLevel }
  | { kind: 'two-sided'; high: ThresholdLevel; low: ThresholdLevel };

/** classifyReading-ийн үр дүн (§5.6) */
export interface ReadingClassification {
  status: HealthStatus;
  levels: ThresholdLevels | null; // offline/invalid болон гадна мэдрэгчид null
  condition: ThresholdConditionId | null; // status-ийг тогтоосон тал; normal үед null
  explanation: string | null;
}
