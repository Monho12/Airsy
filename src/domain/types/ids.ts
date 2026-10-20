// Тогтвортой ID-ууд (CLAUDE.md §5.2, §10). Массивын индексийг ID болгож хэзээ ч бүү хэрэглэ.

export type BuildingId = string; // 'aeris-tower'

/** Давхрын тогтвортой ID, жишээ нь 'F07' (§5.2) */
export type FloorId = string;

/** Бүсийн тогтвортой ID, жишээ нь 'F07-A' — `{floorId}-{үсэг}` (§5.2) */
export type AreaId = string;

export type SensorId = string; // 'F07-A-co2' | 'OUT-pm25'
export type DeviceId = string; // 'F07-SF'
export type AlertId = string;
export type EventId = string;

export type ScenarioId =
  | 'normal-operation'
  | 'elevated-temperature'
  | 'high-co2'
  | 'voc-cleaning'
  | 'poor-outdoor-air'
  | 'fire-emergency'
  | 'sensor-disconnection'
  | 'recovery';

/** Симуляцийн epoch миллисекунд (бодит цаг БИШ) */
export type SimTimeMs = number;
