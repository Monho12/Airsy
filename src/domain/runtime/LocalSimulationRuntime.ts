// Браузер доторх симуляцийн runtime (CLAUDE.md §9.4, §9.4.1, §9.5, §11.1, D68–D73). Эзэмшигч: Симуляцийн инженер.
// Цорын ганц timer-ийг эзэмшинэ (§11.1, D70). Бүх утга seed-тэй, deterministic — `Date.now()` / `Math.random()` байхгүй.
// Phase 4: удирдлагын engine, сценари, яаралтай байдал байхгүй — төхөөрөмж суурь төлөвтөө (§13, D71, D72).
import { buildAlertConditions, sensorLocationLabel } from '@/domain/alerts/conditions';
import {
  createAlertEvaluatorState,
  evaluateAlerts,
  type AlertEvaluatorState,
  type AlertTransition,
} from '@/domain/alerts/evaluator';
import {
  buildingConfig as defaultBuildingConfig,
  type BuildingConfig,
} from '@/domain/config/building';
import { baselineDeviceStates } from '@/domain/config/control';
import { simulationConfig, simulationSpeeds } from '@/domain/config/simulation';
import { metricSpecs } from '@/domain/config/thresholds';
import {
  appendEvents,
  createEventLog,
  type EventLog,
  type SystemEventDraft,
} from '@/domain/events/eventLog';
import { appendTrendPoints, createTrendHistory } from '@/domain/history/trendHistory';
import { formatMetricValueMn, mn } from '@/domain/i18n/mn';
import {
  baselineOccupants,
  baselineOutdoor,
  calibrateArea,
  stepAreaEnvironment,
  ventilationRates,
  type AreaCalibration,
  type AreaEnvironment,
  type OutdoorEnvironment,
} from '@/domain/simulation/environment';
import {
  computeFloorAggregates,
  indexFloorSensors,
  type FloorAggregates,
  type FloorSensorIndex,
} from '@/domain/simulation/floorAggregates';
import { createRng, type Rng } from '@/domain/simulation/rng';
import {
  disconnectedReading,
  emitValue,
  nextReading,
  type SensorFault,
} from '@/domain/simulation/sensors';
import type {
  AreaId,
  ControlDecision,
  ControlState,
  DeviceId,
  LiveSnapshot,
  Sensor,
  SensorId,
  SensorReading,
  SimTimeMs,
  SimulationSpeed,
  SystemEventType,
  TrendHistory,
  VentilationDevice,
} from '@/domain/types';

import type { AerisCommand, AerisRuntime, CommandResult } from './AerisRuntime';

export interface LocalSimulationRuntimeOptions {
  /** Барилгын тохиргоо (анхдагч 12 давхар) */
  config?: BuildingConfig;
  /** PRNG-ийн seed (анхдагч `simulationConfig.defaultSeed`, D69) */
  seed?: number;
}

interface QueuedCommand {
  command: AerisCommand;
  resolve: (result: CommandResult) => void;
}

interface CommandOutcome {
  result: CommandResult;
  /** Snapshot-д харагдах төлөв өөрчлөгдсөн эсэх — цэвэрлэгээний төгсгөлд publish хийх эсэх (§9.4.1) */
  changed: boolean;
}

const OK_UNCHANGED: CommandOutcome = { result: { ok: true }, changed: false };
const reject = (reason: string): CommandOutcome => ({
  result: { ok: false, reason },
  changed: false,
});

/** Phase 4-т удирдлагын engine байхгүй тул шийдвэрийн мөр хоосон (Phase 5) */
const NO_DECISIONS: Readonly<Record<DeviceId, ControlDecision>> = Object.freeze({});

const ALERT_EVENT_TYPE: Record<AlertTransition['kind'], SystemEventType> = {
  raised: 'ALERT_RAISED',
  escalated: 'ALERT_ESCALATED',
  deescalated: 'ALERT_DEESCALATED',
  resolved: 'ALERT_RESOLVED',
};

export class LocalSimulationRuntime implements AerisRuntime {
  private readonly config: BuildingConfig;
  private readonly seed: number;
  private readonly rng: Rng;
  private readonly floorSensors: FloorSensorIndex;
  private readonly calibrations = new Map<AreaId, AreaCalibration>();
  private readonly occupants = new Map<AreaId, number>();
  private readonly outdoor: OutdoorEnvironment = baselineOutdoor;
  private readonly devices: Record<DeviceId, VentilationDevice>;
  private readonly control: ControlState;

  private environment = new Map<AreaId, AreaEnvironment>();
  private readonly faults = new Map<SensorId, SensorFault>();
  private readings: Record<SensorId, SensorReading> = {};
  private alerts: AlertEvaluatorState = createAlertEvaluatorState();
  private eventLog: EventLog = createEventLog();
  private history: TrendHistory;
  private simTime: SimTimeMs = simulationConfig.startTime;

  // D73: апп ачаалахад автоматаар 1× хурдаар ажиллана
  private running = true;
  private speed: SimulationSpeed = 1;
  /** D70: tick бүрт `+= speed`; `ticksPerStep` хүрэхэд нэг алхам */
  private accumulator = 0;

  private lifecycle: 'created' | 'started' | 'stopped' = 'created';
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<(snapshot: LiveSnapshot) => void>();
  private queue: QueuedCommand[] = [];
  private flushScheduled = false;

  private snapshot: LiveSnapshot;
  private alertsView: LiveSnapshot['alerts'] = { active: [], recentResolved: [] };
  private simulationView: LiveSnapshot['simulation'];

  constructor({
    config = defaultBuildingConfig,
    seed = simulationConfig.defaultSeed,
  }: LocalSimulationRuntimeOptions = {}) {
    this.config = config;
    this.seed = seed;
    this.rng = createRng(seed);
    this.floorSensors = indexFloorSensors(config);

    for (const area of Object.values(config.areas)) {
      this.calibrations.set(area.id, calibrateArea(area));
      this.occupants.set(area.id, baselineOccupants(area));
      this.environment.set(area.id, { ...area.baseline });
    }

    this.devices = {};
    for (const device of Object.values(config.devices)) {
      this.devices[device.id] = {
        id: device.id,
        floorId: device.floorId,
        kind: device.kind,
        name: mn.devices.deviceName(device.kind, device.floorId),
        state: baselineDeviceStates[device.kind],
        mode: 'auto',
        manualOverride: null,
        lastChangedAt: this.simTime,
        lastChangeReason: mn.devices.initialStateReason,
        lastRuleId: null,
      };
    }
    // §7.4-ийн суурь: гадна PM2.5 8 µg/m³ < 10 тул шингэлэхийг зөвшөөрнө. Phase 4-т тооцоолохгүй (Phase 5).
    this.control = {
      autoMode: true,
      outdoorAirRestricted: false,
      pmDilutionAllowed: true,
      fallbackFloors: [],
      freeCoolingFloors: [],
      emergency: null,
    };

    // Эхлэх агшны утга (simTime = startTime, бүс бүр Area.baseline-аар; D73)
    this.readings = this.readSensors();
    const aggregates = this.aggregates();
    this.history = appendTrendPoints(
      createTrendHistory(config.building.floorIds),
      this.simTime,
      aggregates,
    );
    this.eventLog = appendEvents(this.eventLog, [
      {
        timestamp: this.simTime,
        type: 'SIMULATION_STARTED',
        category: 'simulation',
        severity: 'info',
        message: mn.events.simulationStarted,
        actor: 'system',
      },
    ]);
    this.simulationView = this.buildSimulationView();
    this.snapshot = this.buildSnapshot();
  }

  // ---------- AerisRuntime ----------

  start(): void {
    if (this.lifecycle !== 'created') return; // давтан дуудалт (StrictMode) юу ч хийхгүй
    this.lifecycle = 'started';
    this.timer = setInterval(() => this.tick(), simulationConfig.tickMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.lifecycle = 'stopped';
  }

  getSnapshot(): LiveSnapshot {
    return this.snapshot;
  }

  subscribe(listener: (snapshot: LiveSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(command: AerisCommand): Promise<CommandResult> {
    if (this.lifecycle !== 'started') {
      return Promise.resolve({ ok: false, reason: mn.common.runtime.notRunning });
    }
    return new Promise((resolve) => {
      this.queue.push({ command, resolve });
      this.scheduleFlush();
    });
  }

  // ---------- Тестэд (AerisRuntime-д биш, §9.4.1) ----------

  /**
   * Дэлгэцгүй тестэд: `steps` алхмыг синхрон ажиллуулж, нэг publish хийнэ. Timer ба түр зогсолтоос хамаарахгүй —
   * алхмын логик нь timer-ийн замтай яг ижил.
   */
  advance(steps: number): void {
    if (steps <= 0) return;
    for (let i = 0; i < steps; i += 1) this.step();
    this.publish();
  }

  // ---------- Timer (D70) ----------

  private tick(): void {
    if (!this.running) return;
    this.accumulator += this.speed;
    const steps = Math.floor(this.accumulator / simulationConfig.ticksPerStep);
    this.accumulator %= simulationConfig.ticksPerStep;
    if (steps === 0) return;
    // Алгассан tick-ийг нөхөхгүй: зөвхөн энэ tick-ийн алхам (§11.1)
    for (let i = 0; i < steps; i += 1) this.step();
    this.publish();
  }

  // ---------- Алхам (§9.5; Phase 4-т 2–5, 7–8) ----------

  private step(): void {
    this.simTime += simulationConfig.stepMs;
    const dtSec = simulationConfig.stepMs / 1000;

    // 2. Орчин — төхөөрөмжийн одоогийн төлөвөөр (Phase 4-т суурь)
    const next = new Map<AreaId, AreaEnvironment>();
    for (const area of Object.values(this.config.areas)) {
      next.set(
        area.id,
        stepAreaEnvironment({
          state: this.environment.get(area.id)!,
          calibration: this.calibrations.get(area.id)!,
          rates: ventilationRates(this.floorDeviceStates(area.floorId)),
          occupants: this.occupants.get(area.id)!,
          volumeM3: area.volumeM3,
          outdoor: this.outdoor,
          dtSec,
        }),
      );
    }
    this.environment = next;

    // 3–4. Мэдрэгчийн утга ба ангилал
    const previous = this.readings;
    this.readings = this.readSensors();
    const drafts: SystemEventDraft[] = [];
    for (const sensor of Object.values(this.config.sensors)) {
      const reading = this.readings[sensor.id];
      if (reading?.status === 'invalid' && previous[sensor.id]?.status !== 'invalid') {
        drafts.push(this.invalidReadingEvent(sensor, reading));
      }
    }

    // 5. Дохио (debounce-тэй). Удирдлага ба 6b нь Phase 5-д.
    const aggregates = this.aggregates();
    const evaluation = evaluateAlerts(
      this.alerts,
      buildAlertConditions(this.config, this.readings, aggregates),
      this.simTime,
    );
    this.alerts = evaluation.state;
    drafts.push(...evaluation.transitions.map((transition) => this.alertEvent(transition)));
    this.eventLog = appendEvents(this.eventLog, drafts);

    // 7. Хандлагын buffer
    this.history = appendTrendPoints(this.history, this.simTime, aggregates);
  }

  private floorDeviceStates(floorId: string) {
    const floor = this.config.floors[floorId];
    const states = { ...baselineDeviceStates };
    for (const deviceId of floor?.deviceIds ?? []) {
      const device = this.devices[deviceId];
      if (device !== undefined) states[device.kind] = device.state;
    }
    return states;
  }

  private readSensors(): Record<SensorId, SensorReading> {
    const readings: Record<SensorId, SensorReading> = {};
    for (const sensor of Object.values(this.config.sensors)) {
      const trueValue = this.trueValue(sensor);
      readings[sensor.id] = nextReading({
        sensor,
        previous: this.readings[sensor.id] ?? null,
        measured: emitValue(trueValue, sensor.metric, this.rng),
        fault: this.faults.get(sensor.id) ?? null,
        now: this.simTime,
      });
    }
    return readings;
  }

  private trueValue(sensor: Sensor): number {
    if (sensor.location === 'indoor') {
      return this.environment.get(sensor.areaId!)![sensor.metric];
    }
    if (sensor.metric === 'voc') throw new Error(`Гадна VOC мэдрэгч дэмжигдээгүй: ${sensor.id}`);
    return this.outdoor[sensor.metric];
  }

  private aggregates(): FloorAggregates {
    return computeFloorAggregates(this.floorSensors, this.readings, this.simTime);
  }

  // ---------- Командууд (§9.4.1, D71) ----------

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    // Алхмын хооронд, dispatch-ийн дараах microtask-д (§9.4.1)
    void Promise.resolve().then(() => this.flush());
  }

  private flush(): void {
    this.flushScheduled = false;
    // Listener дотроос дуудсан dispatch дараагийн цэвэрлэгээнд орно (§9.4.1 «Дахин орох»)
    const batch = this.queue;
    this.queue = [];
    const drafts: SystemEventDraft[] = [];
    const results: CommandResult[] = [];
    let changed = false;
    for (const { command } of batch) {
      const outcome =
        this.lifecycle === 'started'
          ? this.apply(command, drafts)
          : reject(mn.common.runtime.notRunning);
      results.push(outcome.result);
      changed ||= outcome.changed;
    }
    this.eventLog = appendEvents(this.eventLog, drafts);
    if (changed) this.publish();
    batch.forEach(({ resolve }, index) => resolve(results[index]!));
  }

  private apply(command: AerisCommand, drafts: SystemEventDraft[]): CommandOutcome {
    switch (command.type) {
      case 'simulation/play':
        if (this.running) return OK_UNCHANGED;
        this.running = true;
        this.accumulator = 0;
        drafts.push(this.simulationEvent('SIMULATION_STARTED', mn.events.simulationResumed));
        return { result: { ok: true }, changed: true };

      case 'simulation/pause':
        if (!this.running) return OK_UNCHANGED;
        this.running = false;
        this.accumulator = 0;
        drafts.push(this.simulationEvent('SIMULATION_PAUSED', mn.events.simulationPaused));
        return { result: { ok: true }, changed: true };

      case 'simulation/setSpeed': {
        if (!simulationSpeeds.includes(command.speed))
          return reject(mn.common.runtime.invalidSpeed);
        if (command.speed === this.speed) return OK_UNCHANGED;
        const from = this.speed;
        this.speed = command.speed;
        this.accumulator = 0;
        drafts.push(
          this.simulationEvent('SPEED_CHANGED', mn.events.speedChanged(from, command.speed)),
        );
        return { result: { ok: true }, changed: true };
      }

      case 'sensor/disconnect': {
        const sensor = this.config.sensors[command.sensorId];
        const reading = this.readings[command.sensorId];
        if (sensor === undefined || reading === undefined) {
          return reject(mn.common.runtime.unknownSensor(command.sensorId));
        }
        if (this.faults.get(sensor.id)?.kind === 'disconnected') return OK_UNCHANGED;
        this.faults.set(sensor.id, { kind: 'disconnected' });
        // Тэр даруй offline — дохио ба удирдлага дараагийн алхамд (§9.4.1)
        this.readings = { ...this.readings, [sensor.id]: disconnectedReading(reading) };
        drafts.push(
          this.sensorEvent(
            'SENSOR_DISCONNECTED',
            'warning',
            sensor,
            mn.events.sensorDisconnectedAt(
              sensorLocationLabel(sensor, this.config),
              mn.metrics.shortLabel[sensor.metric],
            ),
          ),
        );
        return { result: { ok: true }, changed: true };
      }

      case 'sensor/injectInvalid': {
        const sensor = this.config.sensors[command.sensorId];
        if (sensor === undefined) return reject(mn.common.runtime.unknownSensor(command.sensorId));
        // Зөвхөн эвдрэлийн төлөв; утга, ангилал, үйл явдал дараагийн алхамд (§9.4.1)
        this.faults.set(sensor.id, { kind: 'invalid', value: command.value });
        return OK_UNCHANGED;
      }

      case 'sensor/reconnect': {
        let ids: SensorId[];
        if (command.sensorId === 'all') {
          ids = Object.keys(this.config.sensors).filter((id) => this.faults.has(id));
        } else {
          if (this.config.sensors[command.sensorId] === undefined) {
            return reject(mn.common.runtime.unknownSensor(command.sensorId));
          }
          ids = this.faults.has(command.sensorId) ? [command.sensorId] : [];
        }
        for (const id of ids) {
          const sensor = this.config.sensors[id]!;
          this.faults.delete(id);
          drafts.push(
            this.sensorEvent(
              'SENSOR_RECONNECTED',
              'info',
              sensor,
              mn.events.sensorReconnected(
                sensorLocationLabel(sensor, this.config),
                mn.metrics.shortLabel[sensor.metric],
              ),
            ),
          );
        }
        // Утга дараагийн алхмын уншилтаар шинэчлэгдэнэ (тэр хүртэл offline хэвээр, §9.4.1)
        return { result: { ok: true }, changed: ids.length > 0 };
      }

      // Phase 4-т хэрэгжээгүй командууд (D71): төлөв ба үйл явдал өөрчлөгдөхгүй
      case 'simulation/reset':
      case 'scenario/start':
      case 'scenario/stop':
      case 'emergency/end':
      case 'control/setAutoMode':
      case 'device/setManual':
      case 'device/returnToAuto':
      case 'alert/acknowledge':
        return reject(mn.common.runtime.notAvailableYet);
    }
  }

  // ---------- Үйл явдал ----------

  private simulationEvent(type: SystemEventType, message: string): SystemEventDraft {
    return {
      timestamp: this.simTime,
      type,
      category: 'simulation',
      severity: 'info',
      message,
      actor: 'operator',
    };
  }

  private sensorEvent(
    type: SystemEventType,
    severity: SystemEventDraft['severity'],
    sensor: Sensor,
    message: string,
  ): SystemEventDraft {
    return {
      timestamp: this.simTime,
      type,
      category: 'sensor',
      severity,
      message,
      floorId: sensor.floorId ?? undefined,
      sensorId: sensor.id,
      actor: 'operator',
    };
  }

  private invalidReadingEvent(sensor: Sensor, reading: SensorReading): SystemEventDraft {
    const spec = metricSpecs[sensor.metric];
    const value = reading.value;
    const valueText =
      value !== null && Number.isFinite(value)
        ? formatMetricValueMn(value, spec.unit, spec.decimals)
        : String(value);
    return {
      timestamp: this.simTime,
      type: 'SENSOR_INVALID_READING',
      category: 'sensor',
      severity: 'warning',
      message: mn.events.sensorInvalidReading(
        sensorLocationLabel(sensor, this.config),
        mn.metrics.shortLabel[sensor.metric],
        valueText,
      ),
      floorId: sensor.floorId ?? undefined,
      sensorId: sensor.id,
      actor: 'system',
    };
  }

  private alertEvent({ kind, alert }: AlertTransition): SystemEventDraft {
    const message = {
      raised: mn.events.alertRaised,
      escalated: mn.events.alertEscalated,
      deescalated: mn.events.alertDeescalated,
      resolved: mn.events.alertResolved,
    }[kind](alert.title);
    return {
      timestamp: this.simTime,
      type: ALERT_EVENT_TYPE[kind],
      category: 'alert',
      severity: kind === 'resolved' ? 'info' : alert.severity,
      message,
      floorId: alert.scope.floorId,
      sensorId: alert.scope.sensorId,
      alertId: alert.id,
      actor: 'system',
    };
  }

  // ---------- Snapshot (structural sharing, §9.5-ын 8, §11.2) ----------

  private buildSimulationView(): LiveSnapshot['simulation'] {
    return { running: this.running, speed: this.speed, seed: this.seed, activeScenario: null };
  }

  private buildSnapshot(): LiveSnapshot {
    const sim = this.simulationView;
    if (sim.running !== this.running || sim.speed !== this.speed) {
      this.simulationView = this.buildSimulationView();
    }
    const { active, recentResolved } = this.alerts;
    if (this.alertsView.active !== active || this.alertsView.recentResolved !== recentResolved) {
      this.alertsView = { active, recentResolved };
    }
    return {
      schemaVersion: 1,
      simTime: this.simTime,
      simulation: this.simulationView,
      readings: this.readings,
      devices: this.devices,
      decisions: NO_DECISIONS,
      control: this.control,
      alerts: this.alertsView,
      events: this.eventLog.events,
      history: this.history,
    };
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
