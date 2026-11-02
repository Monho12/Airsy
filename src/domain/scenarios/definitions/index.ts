// Үзүүлэх 8 сценари — ӨГӨГДӨЛ (CLAUDE.md §7.1, §7.2). Алхмын хугацаа нь сценари эхэлснээс хойших симуляцийн хугацаа.
// ⚠️ Оролтын тоон утга (дулаан, эх үүсвэрийн хурд) нь прототипийн ТААРУУЛГЫН УТГА — сценарийн нөлөө 1× хурдаар
// харагдахаар сонгосон (§7.1: тест яг секундыг биш, дараалал ба үр дүнг шалгана; D80).
import { mn } from '@/domain/i18n/mn';
import type { ScenarioId, SimulationScenario } from '@/domain/types';

const s = mn.scenarios;
const meta = (id: ScenarioId) => ({ id, name: s.name[id], description: s.description[id] });

const normalOperation: SimulationScenario = {
  ...meta('normal-operation'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [],
  completion: { afterMs: 10_000 },
  expected: { alerts: [], events: ['SCENARIO_STARTED'] },
};

const elevatedTemperature: SimulationScenario = {
  ...meta('elevated-temperature'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [
    // Гадна 16 °C — үнэгүй хөргөлт боломжтой (§7.2 S2)
    {
      atMs: 0,
      label: s.step.sunHeat,
      action: { type: 'setOutdoor', values: { temperature: 16 }, rampMs: 10_000 },
    },
    {
      atMs: 0,
      label: s.step.sunHeat,
      action: { type: 'setHeatGain', floorIds: ['F12'], value: 0.55, rampMs: 40_000 },
    },
    {
      atMs: 60_000,
      label: s.step.afternoonSun,
      action: { type: 'setHeatGain', floorIds: ['F12'], value: 0.9, rampMs: 20_000 },
    },
  ],
  completion: { afterMs: 120_000 },
  expected: {
    alerts: ['threshold:temperature-high:F12'],
    events: [
      'SCENARIO_STARTED',
      'ALERT_RAISED',
      'DEVICE_STATE_CHANGED',
      'ALERT_ESCALATED',
      'DEVICE_STATE_CHANGED',
      'SCENARIO_COMPLETED',
    ],
  },
};

const highCo2: SimulationScenario = {
  ...meta('high-co2'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [
    {
      atMs: 0,
      label: s.step.meetingStarts,
      action: { type: 'setOccupancy', areaIds: ['F02-A'], fraction: 1, rampMs: 5_000 },
    },
    {
      atMs: 30_000,
      label: s.step.roomsFill,
      action: { type: 'setOccupancy', areaIds: ['F02-B'], fraction: 0.95, rampMs: 5_000 },
    },
  ],
  completion: { afterMs: 300_000 },
  expected: {
    alerts: ['threshold:co2:F02'],
    events: ['SCENARIO_STARTED', 'SCENARIO_STEP', 'ALERT_RAISED', 'DEVICE_STATE_CHANGED'],
  },
};

const vocCleaning: SimulationScenario = {
  ...meta('voc-cleaning'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [
    // Оройн нөхцөл — цагийг өөрчлөхгүйгээр ачааллыг 10% (§7.2 S4, D17)
    {
      atMs: 0,
      label: s.step.evening,
      action: { type: 'setOccupancy', areaIds: 'all', fraction: 0.1 },
    },
    {
      atMs: 0,
      label: s.step.cleaningNorth,
      action: {
        type: 'pulseSource',
        areaIds: ['F06-A'],
        metric: 'voc',
        rate: 14,
        durationMs: 60_000,
      },
    },
    {
      atMs: 20_000,
      label: s.step.cleaningSouth,
      action: {
        type: 'pulseSource',
        areaIds: ['F06-B'],
        metric: 'voc',
        rate: 9,
        durationMs: 40_000,
      },
    },
  ],
  completion: { when: 'allNormal' },
  expected: {
    alerts: ['threshold:voc:F06'],
    events: [
      'SCENARIO_STARTED',
      'ALERT_RAISED',
      'DEVICE_STATE_CHANGED',
      'ALERT_DEESCALATED',
      'ALERT_RESOLVED',
      'SCENARIO_COMPLETED',
    ],
  },
};

const poorOutdoorAir: SimulationScenario = {
  ...meta('poor-outdoor-air'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [
    {
      atMs: 0,
      label: s.step.outdoorSmoke,
      action: { type: 'setOutdoor', values: { pm25: 55 }, rampMs: 30_000 },
    },
    {
      atMs: 40_000,
      label: s.step.conferenceLoad,
      action: { type: 'setOccupancy', areaIds: ['F02-A', 'F02-B'], fraction: 1, rampMs: 10_000 },
    },
  ],
  completion: { afterMs: 300_000 },
  expected: {
    alerts: ['outdoor_air_restricted:aeris-tower'],
    events: ['SCENARIO_STARTED', 'CONTROL_CONSTRAINT_ACTIVE', 'ALERT_RAISED'],
  },
};

const fireEmergency: SimulationScenario = {
  ...meta('fire-emergency'),
  startsFrom: 'baseline',
  requiresConfirmation: true,
  steps: [
    { atMs: 0, label: s.step.fireAlarm, action: { type: 'startEmergency', fireFloorId: 'F08' } },
    {
      atMs: 0,
      label: s.step.smokeFire,
      action: {
        type: 'pulseSource',
        areaIds: ['F08-A', 'F08-B'],
        metric: 'pm25',
        rate: 6,
        durationMs: 30_000,
      },
    },
    {
      atMs: 0,
      label: s.step.smokeFire,
      action: { type: 'setHeatGain', floorIds: ['F08'], value: 0.08, rampMs: 30_000 },
    },
    {
      atMs: 0,
      label: s.step.smokeNeighbors,
      action: {
        type: 'pulseSource',
        areaIds: ['F07-A', 'F07-B', 'F09-A', 'F09-B'],
        metric: 'pm25',
        rate: 0.3,
        durationMs: 30_000,
      },
    },
  ],
  // Яаралтай байдал зөвхөн командаар дуусна (§6.9) — тэр хүртэл сценари идэвхтэй
  completion: { when: 'allNormal' },
  expected: {
    alerts: ['emergency:aeris-tower', 'threshold:pm25:F08'],
    events: ['SCENARIO_STARTED', 'EMERGENCY_STARTED', 'DEVICE_STATE_CHANGED', 'ALERT_RAISED'],
  },
};

const sensorDisconnection: SimulationScenario = {
  ...meta('sensor-disconnection'),
  startsFrom: 'baseline',
  requiresConfirmation: false,
  steps: [
    {
      atMs: 0,
      label: s.step.f04Load,
      action: { type: 'setOccupancy', areaIds: ['F04-A', 'F04-B'], fraction: 0.75 },
    },
    {
      atMs: 5_000,
      label: s.step.disconnectA,
      action: { type: 'disconnectSensor', sensorIds: ['F04-A-co2'] },
    },
    {
      atMs: 20_000,
      label: s.step.disconnectB,
      action: { type: 'disconnectSensor', sensorIds: ['F04-B-co2'] },
    },
    {
      atMs: 35_000,
      label: s.step.invalidHumidity,
      action: { type: 'injectInvalidReading', sensorId: 'F04-A-humidity', value: 140 },
    },
  ],
  completion: { afterMs: 60_000 },
  expected: {
    alerts: [
      'sensor_offline:F04-A-co2',
      'sensor_offline:F04-B-co2',
      'control_degraded:F04',
      'sensor_invalid:F04-A-humidity',
    ],
    events: [
      'SENSOR_DISCONNECTED',
      'SENSOR_DISCONNECTED',
      'CONTROL_FALLBACK_ACTIVE',
      'DEVICE_STATE_CHANGED',
      'SENSOR_INVALID_READING',
    ],
  },
};

const recovery: SimulationScenario = {
  ...meta('recovery'),
  startsFrom: 'current',
  requiresConfirmation: false,
  steps: [
    {
      atMs: 0,
      label: s.step.restoreInputs,
      action: { type: 'restoreBaselineInputs', rampMs: 30_000 },
    },
    { atMs: 0, label: s.step.reconnectAll, action: { type: 'reconnectSensor', sensorIds: 'all' } },
  ],
  completion: { when: 'allNormal' },
  expected: { alerts: [], events: ['SCENARIO_STARTED', 'SCENARIO_COMPLETED'] },
};

/** Бүх сценари, §7.2-ын дарааллаар */
export const scenarioDefinitions: Readonly<Record<ScenarioId, SimulationScenario>> = {
  'normal-operation': normalOperation,
  'elevated-temperature': elevatedTemperature,
  'high-co2': highCo2,
  'voc-cleaning': vocCleaning,
  'poor-outdoor-air': poorOutdoorAir,
  'fire-emergency': fireEmergency,
  'sensor-disconnection': sensorDisconnection,
  recovery,
};

export const scenarioOrder: readonly ScenarioId[] = Object.keys(
  scenarioDefinitions,
) as ScenarioId[];
