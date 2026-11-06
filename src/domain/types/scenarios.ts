// Сценарийн төрөл (CLAUDE.md §7, §10). `setOccupancy`-ийн `'all'` — тохиргооны бүх бүс (D80).
import type { OutdoorConditions } from './control';
import type { SystemEventType } from './events';
import type { AnyScenarioId, AreaId, FloorId, SensorId } from './ids';

export type ScenarioAction =
  | { type: 'setOccupancy'; areaIds: AreaId[] | 'all'; fraction: number; rampMs?: number }
  | { type: 'setHeatGain'; floorIds: FloorId[]; value: number; rampMs?: number }
  | {
      type: 'pulseSource';
      areaIds: AreaId[];
      /** `humidity` (% RH/с) ба `temperature` (°C/с) — өрөөний сценарид (D93) */
      metric: 'voc' | 'pm25' | 'humidity' | 'temperature';
      rate: number;
      durationMs: number;
    }
  | { type: 'setOutdoor'; values: Partial<Omit<OutdoorConditions, 'co2'>>; rampMs?: number }
  | { type: 'disconnectSensor'; sensorIds: SensorId[] }
  | { type: 'reconnectSensor'; sensorIds: SensorId[] | 'all' }
  | { type: 'injectInvalidReading'; sensorId: SensorId; value: number }
  | { type: 'startEmergency'; fireFloorId: FloorId }
  | { type: 'restoreBaselineInputs'; rampMs: number };

export interface ScenarioStep {
  atMs: number;
  label: string;
  action: ScenarioAction;
}

export interface SimulationScenario {
  id: AnyScenarioId;
  /** Өрөөний сценарийн зорилтот бүс (С7, D93); тогтмол 8 сценарид байхгүй */
  targetAreaId?: AreaId;
  name: string;
  description: string;
  startsFrom: 'baseline' | 'current'; // 'current' нь зөвхөн 'recovery'-д
  requiresConfirmation: boolean; // 'fire-emergency'-д true
  steps: ScenarioStep[];
  // `minMs` — «бүгд хэвийн»-ийг үүнээс өмнө шалгахгүй (эх үүсвэр t = 0-д эхэлдэг өрөөний сценари шууд дуусахгүй, D93)
  completion: { afterMs: number } | { when: 'allNormal'; minMs?: number };
  expected: {
    alerts: string[]; // үүсэх ёстой дохионы түлхүүрүүд
    events: SystemEventType[]; // энэ харьцангуй дарааллаар гарах ёстой
  };
}
