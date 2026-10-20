// Phase 2-ын тогтмол жишээ snapshot (CLAUDE.md §13 Phase 2, D45, D50, D53). Эзэмшигч: Frontend (§14.3).
// ⚠️ Утгууд нь §5.1.2-ын ПРОТОТИПИЙН ТААМАГ дээр тулгуурласан жишээ — жинхэнэ хэмжилт биш.
// Бүрэн deterministic: санамсаргүй тоо, `Date.now()` байхгүй; бүх хугацаа `simulationConfig.startTime`-аас тогтмол офсетоор.
// Ангиллыг гараар бичихгүй — жинхэнэ `classifyReading`-ээр (runtime-тай ижил зам).
import { classifyReading } from '@/domain/classification';
import { buildingConfig, OUTDOOR_BASELINE, type BuildingConfig } from '@/domain/config/building';
import { simulationConfig } from '@/domain/config/simulation';
import { indoorThresholds, metricSpecs, timingThresholds } from '@/domain/config/thresholds';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type {
  Alert,
  DeviceId,
  DeviceState,
  FloorId,
  LiveSnapshot,
  MetricType,
  SensorId,
  SensorReading,
  SimTimeMs,
  SystemEvent,
  TrendHistory,
  VentilationDevice,
} from '@/domain/types';

/** Симуляцийн нэг алхам (§11.1: dt = 1000 ms) */
const STEP_MS = 1000;

/** Тогтмол офсетууд (D45) — `startTime`-аас эсвэл `simTime`-аас */
export const MOCK_OFFSETS = {
  /** snapshot-ийн `simTime` = startTime + 10 мин */
  simTimeAfterStartMs: 10 * 60_000,
  /** F02-ын CO₂ анхааруулга `simTime`-аас 2 минутын өмнө үүссэн */
  co2AlertBeforeMs: 2 * 60_000,
  /** F04-A-co2 `simTime`-аас 45 секундын өмнө салсан */
  disconnectBeforeMs: 45_000,
} as const;

/** Жишээний онцлог утгууд (прототипийн жишээ; D50-ийн таамаг дээр) */
export const MOCK_SAMPLE = {
  /** Нэг анхааруулгатай давхар: F02 Их танхимын CO₂ (≥ анхааруулга, < ноцтой) */
  warningSensorId: 'F02-A-co2',
  warningValue: 1080,
  /** Нэг холболтгүй мэдрэгч */
  offlineSensorId: 'F04-A-co2',
} as const;

const BASELINE_STATE: Record<VentilationDevice['kind'], DeviceState> = {
  supply_fan: { kind: 'supply_fan', level: 'LOW' },
  exhaust_fan: { kind: 'exhaust_fan', level: 'LOW' },
  outdoor_air_damper: { kind: 'outdoor_air_damper', position: 'MINIMUM' },
};

const alertId = (n: number) => `A-${String(n).padStart(4, '0')}`;
const eventId = (n: number) => `E-${String(n).padStart(4, '0')}`;

function onlineReading(
  sensorId: SensorId,
  metric: MetricType,
  value: number,
  simTime: SimTimeMs,
  indoor: boolean,
): SensorReading {
  const classification = classifyReading(
    metric,
    value,
    'online',
    null,
    indoor ? indoorThresholds : null,
  );
  return {
    sensorId,
    metric,
    value,
    unit: metricSpecs[metric].unit,
    timestamp: simTime,
    lastValidValue: value,
    lastValidAt: simTime,
    connection: 'online',
    ...classification,
    source: 'simulated',
  };
}

/** Холболтгүй мэдрэгч: `value: null` (хэзээ ч 0 биш), сүүлийн зөв утга ба хугацааг хадгална (FR-M5, §10). */
function offlineReading(
  sensorId: SensorId,
  metric: MetricType,
  lastValidValue: number,
  lastValidAt: SimTimeMs,
): SensorReading {
  return {
    sensorId,
    metric,
    value: null,
    unit: metricSpecs[metric].unit,
    timestamp: lastValidAt,
    lastValidValue,
    lastValidAt,
    connection: 'offline',
    ...classifyReading(metric, null, 'offline', null, indoorThresholds),
    source: 'simulated',
  };
}

/** Тохиргооноос тогтмол жишээ snapshot үүсгэнэ. Ижил оролтоор үргэлж ижил үр дүн. */
export function createMockSnapshot(config: BuildingConfig = buildingConfig): LiveSnapshot {
  const startTime = simulationConfig.startTime;
  const simTime = startTime + MOCK_OFFSETS.simTimeAfterStartMs;
  const disconnectedAt = simTime - MOCK_OFFSETS.disconnectBeforeMs;
  const co2AlertAt = simTime - MOCK_OFFSETS.co2AlertBeforeMs;
  // Дохио нөхцөл `alertDebounceSteps` алхам үргэлжилсний дараа үүснэ (§4.4)
  const offlineAlertAt = disconnectedAt + timingThresholds.alertDebounceSteps * STEP_MS;

  // ---------- Утгууд ----------
  const readings: Record<SensorId, SensorReading> = {};
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.location === 'outdoor') {
      const value = OUTDOOR_BASELINE[sensor.metric as keyof typeof OUTDOOR_BASELINE];
      readings[sensor.id] = onlineReading(sensor.id, sensor.metric, value, simTime, false);
      continue;
    }
    const baseline = config.areas[sensor.areaId!]!.baseline[sensor.metric];
    if (sensor.id === MOCK_SAMPLE.offlineSensorId) {
      readings[sensor.id] = offlineReading(sensor.id, sensor.metric, baseline, disconnectedAt);
    } else if (sensor.id === MOCK_SAMPLE.warningSensorId) {
      readings[sensor.id] = onlineReading(
        sensor.id,
        sensor.metric,
        MOCK_SAMPLE.warningValue,
        simTime,
        true,
      );
    } else {
      readings[sensor.id] = onlineReading(sensor.id, sensor.metric, baseline, simTime, true);
    }
  }

  // ---------- Төхөөрөмж: суурь төлөв (удирдлагын engine Phase 5-д) ----------
  const devices: Record<DeviceId, VentilationDevice> = {};
  for (const device of Object.values(config.devices)) {
    devices[device.id] = {
      id: device.id,
      floorId: device.floorId,
      kind: device.kind,
      name: mn.devices.deviceName(device.kind, device.floorId),
      state: BASELINE_STATE[device.kind],
      mode: 'auto',
      manualOverride: null,
      lastChangedAt: startTime,
      lastChangeReason: mn.devices.initialStateReason,
      lastRuleId: null,
    };
  }

  // ---------- Дохио ----------
  const alerts: Alert[] = [];
  const events: SystemEvent[] = [];
  let seq = 0;
  const pushEvent = (event: Omit<SystemEvent, 'id' | 'seq'>) => {
    seq += 1;
    events.push({ id: eventId(seq), seq, ...event });
  };

  pushEvent({
    timestamp: startTime,
    type: 'SIMULATION_STARTED',
    category: 'simulation',
    severity: 'info',
    message: mn.events.simulationStarted,
    actor: 'system',
  });

  const warningSensor = config.sensors[MOCK_SAMPLE.warningSensorId];
  const warningReading = readings[MOCK_SAMPLE.warningSensorId];
  if (warningSensor && warningReading && warningReading.condition !== null) {
    const floorId = warningSensor.floorId as FloorId;
    const floor = config.floors[floorId]!;
    const side = indoorThresholds[warningReading.condition].side;
    const alert: Alert = {
      id: alertId(alerts.length + 1),
      key: `threshold:${warningReading.condition}:${floorId}`,
      type: 'threshold',
      severity: warningReading.status === 'critical' ? 'critical' : 'warning',
      status: 'active',
      scope: { floorId, metric: warningSensor.metric, condition: warningReading.condition },
      title: mn.alerts.thresholdTitle(
        mn.metrics.shortLabel[warningSensor.metric],
        side,
        floorLabelMn(floor.level),
      ),
      message: warningReading.explanation ?? '',
      raisedAt: co2AlertAt,
      updatedAt: co2AlertAt,
      acknowledgedAt: null,
      resolvedAt: null,
      peakValue: warningReading.value,
    };
    alerts.push(alert);
    pushEvent({
      timestamp: co2AlertAt,
      type: 'ALERT_RAISED',
      category: 'alert',
      severity: alert.severity,
      message: mn.events.alertRaised(alert.title),
      floorId,
      sensorId: warningSensor.id,
      alertId: alert.id,
      actor: 'system',
    });
  }

  const offlineSensor = config.sensors[MOCK_SAMPLE.offlineSensorId];
  if (offlineSensor && offlineSensor.areaId !== null && offlineSensor.floorId !== null) {
    const floor = config.floors[offlineSensor.floorId]!;
    const area = config.areas[offlineSensor.areaId]!;
    const metricLabel = mn.metrics.shortLabel[offlineSensor.metric];
    pushEvent({
      timestamp: disconnectedAt,
      type: 'SENSOR_DISCONNECTED',
      category: 'sensor',
      severity: 'warning',
      message: mn.events.sensorDisconnected(floorLabelMn(floor.level), area.name, metricLabel),
      floorId: floor.id,
      sensorId: offlineSensor.id,
      actor: 'system',
    });
    const alert: Alert = {
      id: alertId(alerts.length + 1),
      key: `sensor_offline:${offlineSensor.id}`,
      type: 'sensor_offline',
      severity: 'warning',
      status: 'active',
      scope: {
        floorId: floor.id,
        areaId: area.id,
        sensorId: offlineSensor.id,
        metric: offlineSensor.metric,
      },
      title: mn.alerts.sensorOfflineTitle(floorLabelMn(floor.level)),
      message: mn.alerts.sensorOfflineMessage(area.name, metricLabel),
      raisedAt: offlineAlertAt,
      updatedAt: offlineAlertAt,
      acknowledgedAt: null,
      resolvedAt: null,
      peakValue: null,
    };
    alerts.push(alert);
    pushEvent({
      timestamp: offlineAlertAt,
      type: 'ALERT_RAISED',
      category: 'alert',
      severity: alert.severity,
      message: mn.events.alertRaised(alert.title),
      floorId: floor.id,
      sensorId: offlineSensor.id,
      alertId: alert.id,
      actor: 'system',
    });
  }

  // ---------- Хандлагын түүх: хоосон (график Phase 6-д) ----------
  const history: TrendHistory = {};
  for (const floorId of config.building.floorIds) {
    history[floorId] = { temperature: [], co2: [], humidity: [], pm25: [], voc: [] };
  }

  return {
    schemaVersion: 1,
    simTime,
    // Phase 2 нь хөдөлгөөнгүй жишээ: давталт ажиллахгүй (runtime Phase 4-т, D53)
    simulation: { running: false, speed: 1, seed: 0, activeScenario: null },
    readings,
    devices,
    decisions: {},
    control: {
      autoMode: true,
      outdoorAirRestricted: false,
      pmDilutionAllowed: true, // гадна PM2.5 8 µg/m³ < 10 (§5.5, §7.4-ийн суурь)
      fallbackFloors: [],
      freeCoolingFloors: [],
      emergency: null,
    },
    alerts: { active: alerts, recentResolved: [] },
    events,
    history,
  };
}
