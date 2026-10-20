// Сценарийн төрөл (CLAUDE.md §7, §10). Engine Phase 6-д.
import type { OutdoorConditions } from './control';
import type { SystemEventType } from './events';
import type { AreaId, FloorId, ScenarioId, SensorId } from './ids';

export type ScenarioAction =
  | { type: 'setOccupancy'; areaIds: AreaId[]; fraction: number; rampMs?: number }
  | { type: 'setHeatGain'; floorIds: FloorId[]; value: number; rampMs?: number }
  | {
      type: 'pulseSource';
      areaIds: AreaId[];
      metric: 'voc' | 'pm25';
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
  id: ScenarioId;
  name: string;
  description: string;
  startsFrom: 'baseline' | 'current'; // 'current' нь зөвхөн 'recovery'-д
  requiresConfirmation: boolean; // 'fire-emergency'-д true
  steps: ScenarioStep[];
  completion: { afterMs: number } | { when: 'allNormal' };
  expected: {
    alerts: string[]; // үүсэх ёстой дохионы түлхүүрүүд
    events: SystemEventType[]; // энэ харьцангуй дарааллаар гарах ёстой
  };
}
