// Браузер доторх симуляцийн runtime (CLAUDE.md §9.4, §9.4.1, §9.5, §11.1, D68–D73). Эзэмшигч: Симуляцийн инженер.
// Цорын ганц timer-ийг эзэмшинэ (§11.1, D70). Бүх утга seed-тэй, deterministic — `Date.now()` / `Math.random()` байхгүй.
// Phase 5: удирдлагын engine (§6, 6-р үе шат), удирдлагын дохио (6b), автомат/гар горимын командууд (D78).
// Phase 6: сценарийн engine (1-р үе шат), зөөлөн/хатуу шинэчлэл ба яаралтай байдлыг дуусгах (§7.4), дохио хүлээн авах.
import { buildAlertConditions, sensorLocationLabel } from '@/domain/alerts/conditions';
import {
  acknowledgeAlert,
  clearAlertDebounce,
  clearAlerts,
  createAlertEvaluatorState,
  evaluateAlerts,
  resolveAlertsWhere,
  type AlertEvaluatorState,
  type AlertTransition,
} from '@/domain/alerts/evaluator';
import {
  buildingConfig as defaultBuildingConfig,
  type BuildingConfig,
} from '@/domain/config/building';
import { baselineDeviceStates, controlConfig } from '@/domain/config/control';
import { applyDeviceCommand } from '@/domain/control/applyDeviceCommand';
import {
  createRuleDebounceState,
  outdoorConditionsOf,
  type RuleDebounceState,
} from '@/domain/control/controlState';
import { evaluateControl } from '@/domain/control/engine';
import { sameState } from '@/domain/control/levels';
import { controlSignalConditions } from '@/domain/control/signals';
import { simulationConfig, simulationSpeeds } from '@/domain/config/simulation';
import { metricSpecs } from '@/domain/config/thresholds';
import {
  appendEvents,
  createEventLog,
  type EventLog,
  type SystemEventDraft,
} from '@/domain/events/eventLog';
import { appendTrendPoints, createTrendHistory } from '@/domain/history/trendHistory';
import { floorLabelMn, formatMetricValueMn, mn } from '@/domain/i18n/mn';
import { scenarioDefinitions } from '@/domain/scenarios/definitions';
import { dueSteps, scenarioIncompatibility, scenarioProgress } from '@/domain/scenarios/engine';
import {
  applyInputAction,
  createBaselineInputs,
  isInputAction,
  occupantsAt,
  outdoorAt,
  pruneInputs,
  sourcesAt,
  type ScenarioInputs,
} from '@/domain/scenarios/inputs';
import {
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
  ScenarioAction,
  SimTimeMs,
  SimulationScenario,
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

/** Эхний алхмаас өмнө шийдвэрийн мөр хоосон (engine алхам бүрт бөглөнө) */
const NO_DECISIONS: Readonly<Record<DeviceId, ControlDecision>> = Object.freeze({});

/** Идэвхтэй сценари (runtime-ийн дотоод төлөв) */
interface ActiveScenario {
  def: SimulationScenario;
  startedAt: SimTimeMs;
  /** Гүйцэтгэгдсэн алхмын тоо (`steps`-ийн эхний N) */
  executed: number;
}

type EventActor = SystemEventDraft['actor'];

/** Удирдлагын суурь төлөв (§7.4-ийн матриц): суурь гадна PM2.5 8 µg/m³ < 10 тул шингэлэхийг зөвшөөрнө */
const baselineControlState = (): ControlState => ({
  autoMode: true,
  outdoorAirRestricted: false,
  pmDilutionAllowed: true,
  fallbackFloors: [],
  freeCoolingFloors: [],
  emergency: null,
});

const ALERT_EVENT_TYPE: Record<AlertTransition['kind'], SystemEventType> = {
  raised: 'ALERT_RAISED',
  escalated: 'ALERT_ESCALATED',
  deescalated: 'ALERT_DEESCALATED',
  resolved: 'ALERT_RESOLVED',
};

export class LocalSimulationRuntime implements AerisRuntime {
  private readonly config: BuildingConfig;
  private readonly seed: number;
  private rng: Rng;
  private readonly floorSensors: FloorSensorIndex;
  private readonly calibrations = new Map<AreaId, AreaCalibration>();
  /** Сценарийн оролт (§5.8, §7.1) — энэ алхмын гадна нөхцөл ба ачаалал эндээс */
  private inputs: ScenarioInputs;
  private outdoor: OutdoorEnvironment = baselineOutdoor;
  private scenario: ActiveScenario | null = null;
  private devices: Record<DeviceId, VentilationDevice>;
  private control: ControlState;
  private decisions: Readonly<Record<DeviceId, ControlDecision>> = NO_DECISIONS;
  /** Дүрмийн debounce (§6.6) — runtime-ийн domain төлөвт, snapshot-д биш */
  private ruleDebounce: RuleDebounceState = createRuleDebounceState();

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
      this.environment.set(area.id, { ...area.baseline });
    }
    this.inputs = createBaselineInputs(config, baselineOutdoor, this.simTime);
    this.devices = this.baselineDevices(mn.devices.initialStateReason);
    // Алхам бүрт 0-р үе шат дахин тооцно (§6.2)
    this.control = baselineControlState();

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

  // ---------- Алхам (§9.5) ----------

  private step(): void {
    this.simTime += simulationConfig.stepMs;
    const dtSec = simulationConfig.stepMs / 1000;
    const drafts: SystemEventDraft[] = [];

    // 1. Сценари — хугацаа нь болсон алхмууд оролт / эвдрэл / яаралтай байдлыг өөрчилнө
    this.advanceScenario(drafts);
    this.inputs = pruneInputs(this.inputs, this.simTime);
    this.outdoor = outdoorAt(this.inputs, baselineOutdoor.co2, this.simTime);

    // 2. Орчин — төхөөрөмжийн одоогийн төлөв ба сценарийн оролтоор
    const next = new Map<AreaId, AreaEnvironment>();
    for (const area of Object.values(this.config.areas)) {
      next.set(
        area.id,
        stepAreaEnvironment({
          state: this.environment.get(area.id)!,
          calibration: this.calibrations.get(area.id)!,
          rates: ventilationRates(this.floorDeviceStates(area.floorId)),
          occupants: occupantsAt(this.inputs, area, this.simTime),
          volumeM3: area.volumeM3,
          outdoor: this.outdoor,
          dtSec,
          extra: sourcesAt(this.inputs, area, this.simTime),
        }),
      );
    }
    this.environment = next;

    // 3–4. Мэдрэгчийн утга ба ангилал
    const previous = this.readings;
    this.readings = this.readSensors();
    for (const sensor of Object.values(this.config.sensors)) {
      const reading = this.readings[sensor.id];
      if (reading?.status === 'invalid' && previous[sensor.id]?.status !== 'invalid') {
        drafts.push(this.invalidReadingEvent(sensor, reading));
      }
    }

    // 5. Дохио (debounce-тэй)
    const aggregates = this.aggregates();
    const evaluation = evaluateAlerts(
      this.alerts,
      buildAlertConditions(this.config, this.readings, aggregates),
      this.simTime,
    );
    this.alerts = evaluation.state;
    drafts.push(...evaluation.transitions.map((transition) => this.alertEvent(transition)));

    // 6. Удирдлагын engine (§6.2): 0-р үе шат → дүрэм → шийдвэр → applyDeviceCommand
    const control = evaluateControl({
      config: this.config,
      devices: this.devices,
      aggregates,
      outdoor: outdoorConditionsOf(this.readings, this.simTime),
      control: this.control,
      debounce: this.ruleDebounce,
      now: this.simTime,
    });
    this.devices = control.devices;
    this.control = control.control;
    this.ruleDebounce = control.debounce;
    this.decisions = control.decisions;
    drafts.push(...control.events);

    // 6b. Удирдлагын төлөвийн дохио — энэ алхмын ControlState-ээр, өөрийн debounce-гүй (§6.6, §9.5)
    const signals = evaluateAlerts(
      this.alerts,
      controlSignalConditions(this.config, this.control),
      this.simTime,
      { debounceSteps: 1 },
    );
    this.alerts = signals.state;
    drafts.push(...signals.transitions.map((transition) => this.alertEvent(transition)));

    // Сценари дууссан эсэх (энэ алхмын үр дүнгээр)
    this.checkScenarioCompletion(drafts);
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
        if (sensor === undefined || this.readings[command.sensorId] === undefined) {
          return reject(mn.common.runtime.unknownSensor(command.sensorId));
        }
        const changed = this.disconnectSensor(sensor, drafts, 'operator');
        return { result: { ok: true }, changed };
      }

      case 'sensor/injectInvalid': {
        const sensor = this.config.sensors[command.sensorId];
        if (sensor === undefined) return reject(mn.common.runtime.unknownSensor(command.sensorId));
        // Зөвхөн эвдрэлийн төлөв; утга, ангилал, үйл явдал дараагийн алхамд (§9.4.1)
        this.faults.set(sensor.id, { kind: 'invalid', value: command.value });
        return OK_UNCHANGED;
      }

      case 'sensor/reconnect': {
        if (command.sensorId !== 'all' && this.config.sensors[command.sensorId] === undefined) {
          return reject(mn.common.runtime.unknownSensor(command.sensorId));
        }
        const changed = this.reconnectSensors(command.sensorId, drafts, 'operator');
        return { result: { ok: true }, changed };
      }

      case 'control/setAutoMode': {
        if (command.enabled === this.control.autoMode) return OK_UNCHANGED;
        this.control = { ...this.control, autoMode: command.enabled };
        drafts.push({
          timestamp: this.simTime,
          type: command.enabled ? 'AUTO_MODE_ENABLED' : 'AUTO_MODE_DISABLED',
          category: 'operator',
          severity: 'info',
          message: command.enabled ? mn.events.autoModeEnabled : mn.events.autoModeDisabled,
          actor: 'operator',
        });
        // Шийдвэр (зөвлөмж / хэрэгжүүлэлт) дараагийн алхамд (§6.7, §9.4.1)
        return { result: { ok: true }, changed: true };
      }

      case 'device/setManual': {
        const device = this.devices[command.deviceId];
        if (device === undefined) return reject(mn.control.unknownDevice(command.deviceId));
        if (command.state.kind !== device.kind) return reject(mn.control.stateKindMismatch);
        if (this.control.emergency !== null) return reject(mn.control.manualBlockedByEmergency);
        if (device.manualOverride !== null && sameState(device.state, command.state)) {
          return OK_UNCHANGED;
        }
        // Гар төлөв нь шууд нөлөө (§9.4.1) — applyDeviceCommand-аар (§6.2)
        const result = applyDeviceCommand(
          device,
          command.state,
          {
            kind: 'manual',
            override: {
              state: command.state,
              setAt: this.simTime,
              expiresAt: this.simTime + controlConfig.manualOverrideTimeoutMs,
            },
          },
          this.simTime,
        );
        this.devices = { ...this.devices, [device.id]: result.device };
        drafts.push(result.event);
        return { result: { ok: true }, changed: true };
      }

      case 'device/returnToAuto': {
        const device = this.devices[command.deviceId];
        if (device === undefined) return reject(mn.control.unknownDevice(command.deviceId));
        if (device.manualOverride === null) return OK_UNCHANGED;
        this.devices = {
          ...this.devices,
          [device.id]: {
            ...device,
            mode: device.mode === 'emergency' ? 'emergency' : 'auto',
            manualOverride: null,
          },
        };
        drafts.push({
          timestamp: this.simTime,
          type: 'MANUAL_OVERRIDE_CLEARED',
          category: 'operator',
          severity: 'info',
          message: mn.events.manualOverrideCleared(device.name),
          floorId: device.floorId,
          deviceId: device.id,
          ruleId: 'R-MANUAL',
          actor: 'operator',
        });
        // Төлөв дараагийн алхамд engine-ээр (өсөлт шууд, бууралт барих хугацаагаар, §6.6)
        return { result: { ok: true }, changed: true };
      }

      case 'scenario/start':
        return this.startScenario(command.scenarioId, drafts);

      case 'scenario/stop': {
        if (this.scenario === null) return OK_UNCHANGED;
        drafts.push(
          this.scenarioEvent(
            'SCENARIO_STOPPED',
            mn.scenarios.stopped(this.scenario.def.name),
            'operator',
          ),
        );
        this.scenario = null;
        // Нөхцөл (оролт) хэвээр үлдэнэ (§7.1)
        return { result: { ok: true }, changed: true };
      }

      case 'emergency/end': {
        if (this.control.emergency === null) return reject(mn.scenarios.noActiveEmergency);
        // §7.4 A
        this.endEmergency(drafts, 'operator');
        if (this.scenario?.def.id === 'fire-emergency') {
          drafts.push(
            this.scenarioEvent(
              'SCENARIO_STOPPED',
              mn.scenarios.stopped(this.scenario.def.name),
              'operator',
            ),
          );
          this.scenario = null;
        }
        return { result: { ok: true }, changed: true };
      }

      case 'simulation/reset':
        this.hardReset(drafts);
        return { result: { ok: true }, changed: true };

      case 'alert/acknowledge': {
        const outcome = acknowledgeAlert(this.alerts, command.alertId, this.simTime);
        if (!outcome.ok) {
          if (outcome.reason === 'emergency') return reject(mn.scenarios.emergencyAlertCannotAck);
          const known = this.alerts.recentResolved.some((alert) => alert.id === command.alertId);
          return reject(
            outcome.reason === 'not-active' || known
              ? mn.scenarios.alertNotActive
              : mn.scenarios.unknownAlert(command.alertId),
          );
        }
        this.alerts = outcome.state;
        drafts.push({
          timestamp: this.simTime,
          type: 'ALERT_ACKNOWLEDGED',
          category: 'alert',
          severity: 'info',
          message: mn.scenarios.alertAcknowledged(outcome.alert.title),
          floorId: outcome.alert.scope.floorId,
          sensorId: outcome.alert.scope.sensorId,
          alertId: outcome.alert.id,
          actor: 'operator',
        });
        return { result: { ok: true }, changed: true };
      }
    }
  }

  // ---------- Мэдрэгчийн эвдрэл (команд ба сценари нэг замаар, FR-S5) ----------

  /** Тэр даруй offline (§9.4.1); дохио ба удирдлага дараагийн алхамд. Өөрчлөгдсөн эсэхийг буцаана. */
  private disconnectSensor(sensor: Sensor, drafts: SystemEventDraft[], actor: EventActor): boolean {
    const reading = this.readings[sensor.id];
    if (reading === undefined || this.faults.get(sensor.id)?.kind === 'disconnected') return false;
    this.faults.set(sensor.id, { kind: 'disconnected' });
    this.readings = { ...this.readings, [sensor.id]: disconnectedReading(reading) };
    drafts.push({
      ...this.sensorEvent(
        'SENSOR_DISCONNECTED',
        'warning',
        sensor,
        mn.events.sensorDisconnectedAt(
          sensorLocationLabel(sensor, this.config),
          mn.metrics.shortLabel[sensor.metric],
        ),
      ),
      actor,
    });
    return true;
  }

  /** Эвдрэлийг арилгана; утга дараагийн алхмын уншилтаар (тэр хүртэл offline хэвээр, §9.4.1) */
  private reconnectSensors(
    target: SensorId | 'all' | readonly SensorId[],
    drafts: SystemEventDraft[],
    actor: EventActor,
  ): boolean {
    const ids =
      target === 'all'
        ? Object.keys(this.config.sensors).filter((id) => this.faults.has(id))
        : (typeof target === 'string' ? [target] : target).filter((id) => this.faults.has(id));
    for (const id of ids) {
      const sensor = this.config.sensors[id]!;
      this.faults.delete(id);
      drafts.push({
        ...this.sensorEvent(
          'SENSOR_RECONNECTED',
          'info',
          sensor,
          mn.events.sensorReconnected(
            sensorLocationLabel(sensor, this.config),
            mn.metrics.shortLabel[sensor.metric],
          ),
        ),
        actor,
      });
    }
    return ids.length > 0;
  }

  // ---------- Сценари (§7, §9.5-ын 1-р алхам) ----------

  private startScenario(id: SimulationScenario['id'], drafts: SystemEventDraft[]): CommandOutcome {
    const def = scenarioDefinitions[id];
    if (def === undefined) return reject(mn.scenarios.unknownScenario(String(id)));
    const incompatible = scenarioIncompatibility(def, this.config);
    if (incompatible !== null) return reject(incompatible);

    if (def.startsFrom === 'current') {
      // Сэргэлт (S8): одоогийн төлөвөөс, шинэчлэлгүй; яаралтай үед зөвшөөрөхгүй (§7.2 S8)
      if (this.control.emergency !== null) return reject(mn.scenarios.recoveryBlockedByEmergency);
      this.stopActiveScenario(drafts);
    } else {
      // §7.4 B: яаралтай байдал идэвхтэй бол эхлээд түүнийг дуусгана; дараа нь C (зөөлөн шинэчлэл)
      this.stopActiveScenario(drafts);
      if (this.control.emergency !== null) this.endEmergency(drafts, 'scenario');
      this.softReset(drafts);
    }
    this.scenario = { def, startedAt: this.simTime, executed: 0 };
    drafts.push(this.scenarioEvent('SCENARIO_STARTED', mn.scenarios.started(def.name), 'operator'));
    return { result: { ok: true }, changed: true };
  }

  private stopActiveScenario(drafts: SystemEventDraft[]): void {
    if (this.scenario === null) return;
    drafts.push(
      this.scenarioEvent(
        'SCENARIO_STOPPED',
        mn.scenarios.stopped(this.scenario.def.name),
        'scenario',
      ),
    );
    this.scenario = null;
  }

  private advanceScenario(drafts: SystemEventDraft[]): void {
    const active = this.scenario;
    if (active === null) return;
    const due = dueSteps(active.def, active.executed, this.simTime - active.startedAt);
    let lastLabel: string | null = null;
    for (const step of due) {
      // Ижил агшинд ижил шошготой дараалсан алхмуудад нэг л мөр
      if (step.label !== lastLabel) {
        drafts.push(
          this.scenarioEvent('SCENARIO_STEP', mn.scenarios.stepEvent(step.label), 'scenario'),
        );
        lastLabel = step.label;
      }
      this.executeAction(step.action, drafts);
    }
    active.executed += due.length;
  }

  private executeAction(action: ScenarioAction, drafts: SystemEventDraft[]): void {
    if (isInputAction(action)) {
      this.inputs = applyInputAction(
        this.inputs,
        action,
        this.config,
        baselineOutdoor,
        this.simTime,
      );
      return;
    }
    switch (action.type) {
      case 'disconnectSensor':
        for (const id of action.sensorIds) {
          const sensor = this.config.sensors[id];
          if (sensor !== undefined) this.disconnectSensor(sensor, drafts, 'scenario');
        }
        return;
      case 'reconnectSensor':
        this.reconnectSensors(action.sensorIds, drafts, 'scenario');
        return;
      case 'injectInvalidReading':
        this.faults.set(action.sensorId, { kind: 'invalid', value: action.value });
        return;
      case 'startEmergency': {
        if (this.control.emergency !== null) return;
        // Симуляцийн галын дохиоллын сигнал (§6.9, D7). Ижил алхмын 6-д R-EMERGENCY, 6b-д дохио (§9.5).
        this.control = {
          ...this.control,
          emergency: { fireFloorId: action.fireFloorId, startedAt: this.simTime },
        };
        const level = this.config.floors[action.fireFloorId]?.level ?? 0;
        drafts.push({
          timestamp: this.simTime,
          type: 'EMERGENCY_STARTED',
          category: 'control',
          severity: 'critical',
          message: mn.scenarios.emergencyStarted(floorLabelMn(level)),
          floorId: action.fireFloorId,
          ruleId: 'R-EMERGENCY',
          actor: 'scenario',
        });
        return;
      }
    }
  }

  private checkScenarioCompletion(drafts: SystemEventDraft[]): void {
    const active = this.scenario;
    if (active === null || active.executed < active.def.steps.length) return;
    const { completion } = active.def;
    const done =
      'afterMs' in completion
        ? this.simTime - active.startedAt >= completion.afterMs
        : this.allNormal();
    if (!done) return;
    drafts.push(
      this.scenarioEvent('SCENARIO_COMPLETED', mn.scenarios.completed(active.def.name), 'scenario'),
    );
    this.scenario = null;
  }

  /** Бүх давхар хэвийн: идэвхтэй дохиогүй, эвдрэлгүй, яаралтай байдалгүй, бүх төхөөрөмж суурь төлөвтөө (§7.2 S8) */
  private allNormal(): boolean {
    if (this.alerts.active.length > 0 || this.faults.size > 0) return false;
    if (this.control.emergency !== null) return false;
    return Object.values(this.devices).every((device) =>
      sameState(device.state, baselineDeviceStates[device.kind]),
    );
  }

  // ---------- §7.4: яаралтай байдлыг дуусгах ба шинэчлэл ----------

  /** Төхөөрөмжийг давхрын түвшин өсөх, давхар дотроо SF → EF → OAD дарааллаар (§7.4) */
  private orderedDevices(): VentilationDevice[] {
    return this.config.building.floorIds.flatMap((floorId) =>
      (this.config.floors[floorId]?.deviceIds ?? [])
        .map((id) => this.devices[id])
        .filter((device) => device !== undefined),
    );
  }

  /** §7.4 A-ийн 1–3 ба 5 (сценари зогсоохыг дуудагч шийднэ) */
  private endEmergency(drafts: SystemEventDraft[], actor: EventActor): void {
    // 1.
    drafts.push({
      timestamp: this.simTime,
      type: 'EMERGENCY_ENDED',
      category: 'control',
      severity: 'info',
      message:
        actor === 'operator' ? mn.scenarios.emergencyEnded : mn.scenarios.emergencyEndedByScenario,
      ruleId: 'R-EMERGENCY',
      actor,
    });
    // 2. `emergency` төрлийн дохиог энэ команд шийднэ (6b хэзээ ч шийдэхгүй, §9.5)
    const resolved = resolveAlertsWhere(
      this.alerts,
      (alert) => alert.type === 'emergency',
      this.simTime,
    );
    this.alerts = resolved.state;
    drafts.push(
      ...resolved.transitions.map((transition) =>
        this.alertEvent(
          transition,
          mn.scenarios.alertResolvedByEmergencyEnd(transition.alert.title),
          actor,
        ),
      ),
    );
    // 3. Түр зогссон гар удирдлагыг цуцална; яаралтай горимыг буулгана (төлөв дараагийн алхамд ердийн удирдлагаар)
    const devices = { ...this.devices };
    for (const device of this.orderedDevices()) {
      if (device.manualOverride !== null) {
        drafts.push({
          timestamp: this.simTime,
          type: 'MANUAL_OVERRIDE_CLEARED',
          category: 'control',
          severity: 'info',
          message: mn.scenarios.manualClearedByEmergencyEnd(device.name),
          floorId: device.floorId,
          deviceId: device.id,
          ruleId: 'R-MANUAL',
          actor,
        });
      }
      if (device.manualOverride !== null || device.mode !== 'auto') {
        devices[device.id] = { ...device, mode: 'auto', manualOverride: null };
      }
    }
    this.devices = devices;
    // 5. Ердийн дүрэм шинээр эхэлнэ (§7.4-ийн матриц «Дүрмийн debounce ✓»)
    this.control = { ...this.control, emergency: null };
    this.ruleDebounce = createRuleDebounceState();
  }

  /** §7.4 C-ийн 2–5 (зөөлөн шинэчлэл). `simTime` буцахгүй, үйл явдал ба хандлагын түүх хадгалагдана. */
  private softReset(drafts: SystemEventDraft[]): void {
    const reason = mn.scenarios.resetReason;
    // 2. Үлдсэн гар удирдлага
    for (const device of this.orderedDevices()) {
      if (device.manualOverride === null) continue;
      drafts.push({
        timestamp: this.simTime,
        type: 'MANUAL_OVERRIDE_CLEARED',
        category: 'scenario',
        severity: 'info',
        message: mn.scenarios.manualClearedByReset(device.name),
        floorId: device.floorId,
        deviceId: device.id,
        ruleId: 'R-MANUAL',
        actor: 'scenario',
      });
    }
    // 3. Автомат горим
    if (!this.control.autoMode) {
      drafts.push(
        this.scenarioEvent('AUTO_MODE_ENABLED', mn.scenarios.autoModeByReset, 'scenario'),
      );
    }
    // 4. Матрицын «Зөөлөн» багана
    const previousControl = this.control;
    this.resetSimulationState();
    const devices = { ...this.devices };
    for (const device of this.orderedDevices()) {
      const baseline = baselineDeviceStates[device.kind];
      if (!sameState(device.state, baseline)) {
        const result = applyDeviceCommand(
          device,
          baseline,
          { kind: 'reset', reason },
          this.simTime,
        );
        devices[device.id] = result.device;
        drafts.push(result.event);
      } else {
        devices[device.id] = {
          ...device,
          mode: 'auto',
          manualOverride: null,
          lastChangedAt: this.simTime,
          lastChangeReason: reason,
          lastRuleId: null,
        };
      }
    }
    this.devices = devices;
    // 5. Идэвхтэй дохио «сценари шинэчлэгдсэн» шалтгаантай; хязгаарлалт ба нөөц горим
    const resolved = resolveAlertsWhere(this.alerts, () => true, this.simTime);
    this.alerts = clearAlertDebounce(resolved.state);
    drafts.push(
      ...resolved.transitions.map((transition) =>
        this.alertEvent(
          transition,
          mn.scenarios.alertResolvedByReset(transition.alert.title),
          'scenario',
        ),
      ),
    );
    if (previousControl.outdoorAirRestricted) {
      drafts.push({
        ...this.scenarioEvent(
          'CONTROL_CONSTRAINT_CLEARED',
          mn.scenarios.constraintClearedByReset,
          'scenario',
        ),
        category: 'control',
      });
    }
    for (const floorId of this.config.building.floorIds) {
      if (!previousControl.fallbackFloors.includes(floorId)) continue;
      const level = this.config.floors[floorId]?.level ?? 0;
      drafts.push({
        ...this.scenarioEvent(
          'CONTROL_FALLBACK_CLEARED',
          mn.scenarios.fallbackClearedByReset(floorLabelMn(level)),
          'scenario',
        ),
        category: 'control',
        floorId,
      });
    }
  }

  /**
   * Зөөлөн ба хатуу шинэчлэлийн нийтлэг хэсэг (§7.4-ийн матриц): PRNG, сценарийн оролт, бүсийн орчин, эвдрэл,
   * мэдрэгчийн утга (суурь утгаас, шуугиангүй), удирдлагын төлөв, шийдвэр, дүрмийн debounce.
   */
  private resetSimulationState(): void {
    this.rng = createRng(this.seed);
    this.inputs = createBaselineInputs(this.config, baselineOutdoor, this.simTime);
    this.outdoor = baselineOutdoor;
    this.environment = new Map(
      Object.values(this.config.areas).map((area) => [area.id, { ...area.baseline }]),
    );
    this.faults.clear();
    const readings: Record<SensorId, SensorReading> = {};
    for (const sensor of Object.values(this.config.sensors)) {
      readings[sensor.id] = nextReading({
        sensor,
        previous: null,
        measured: this.trueValue(sensor),
        fault: null,
        now: this.simTime,
      });
    }
    this.readings = readings;
    this.control = baselineControlState();
    this.decisions = NO_DECISIONS;
    this.ruleDebounce = createRuleDebounceState();
  }

  /** §7.4 D: хатуу шинэчлэл — түүхийг цэвэрлээд ганц `SIMULATION_RESET` */
  private hardReset(drafts: SystemEventDraft[]): void {
    const activeName = this.scenario?.def.name ?? null;
    const emergencyActive = this.control.emergency !== null;
    // Түүх цэвэрлэгдэх тул энэ цэвэрлэгээний өмнөх ноорог ч бичигдэхгүй
    drafts.length = 0;
    this.simTime = simulationConfig.startTime;
    this.speed = 1;
    this.accumulator = 0;
    this.scenario = null;
    this.resetSimulationState();
    this.devices = this.baselineDevices(mn.devices.initialStateReason);
    this.alerts = clearAlerts(this.alerts);
    // `seq` дахин эхлэхгүй (ID давхцахгүй)
    this.eventLog = { events: [], nextSeq: this.eventLog.nextSeq };
    this.history = createTrendHistory(this.config.building.floorIds);
    drafts.push(
      this.simulationEvent(
        'SIMULATION_RESET',
        mn.scenarios.simulationReset(activeName, emergencyActive),
      ),
    );
  }

  private baselineDevices(reason: string): Record<DeviceId, VentilationDevice> {
    const devices: Record<DeviceId, VentilationDevice> = {};
    for (const device of Object.values(this.config.devices)) {
      devices[device.id] = {
        id: device.id,
        floorId: device.floorId,
        kind: device.kind,
        name: mn.devices.deviceName(device.kind, device.floorId),
        state: baselineDeviceStates[device.kind],
        mode: 'auto',
        manualOverride: null,
        lastChangedAt: this.simTime,
        lastChangeReason: reason,
        lastRuleId: null,
      };
    }
    return devices;
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

  private scenarioEvent(
    type: SystemEventType,
    message: string,
    actor: EventActor,
  ): SystemEventDraft {
    return {
      timestamp: this.simTime,
      type,
      category: 'scenario',
      severity: 'info',
      message,
      actor,
    };
  }

  private alertEvent(
    { kind, alert }: AlertTransition,
    messageOverride?: string,
    actor: EventActor = 'system',
  ): SystemEventDraft {
    const message =
      messageOverride ??
      {
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
      actor,
    };
  }

  // ---------- Snapshot (structural sharing, §9.5-ын 8, §11.2) ----------

  private activeScenarioView(): LiveSnapshot['simulation']['activeScenario'] {
    const active = this.scenario;
    if (active === null) return null;
    return {
      id: active.def.id,
      startedAt: active.startedAt,
      progress: scenarioProgress(active.def, this.simTime - active.startedAt),
    };
  }

  private buildSimulationView(): LiveSnapshot['simulation'] {
    return {
      running: this.running,
      speed: this.speed,
      seed: this.seed,
      activeScenario: this.activeScenarioView(),
    };
  }

  private buildSnapshot(): LiveSnapshot {
    const sim = this.simulationView;
    const scenario = this.activeScenarioView();
    if (
      sim.running !== this.running ||
      sim.speed !== this.speed ||
      sim.activeScenario?.id !== scenario?.id ||
      sim.activeScenario?.startedAt !== scenario?.startedAt ||
      sim.activeScenario?.progress !== scenario?.progress
    ) {
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
      decisions: this.decisions,
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
