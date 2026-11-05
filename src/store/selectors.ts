// Snapshot-оос гаргаж авах өгөгдөл (CLAUDE.md §5.6, §10.2). Цэвэр функцүүд — төлөвийг хэзээ ч хадгалахгүй.
// Бүс/давхар/барилгын төлөв, тоо, жагсаалтыг уншихдаа тооцно. UI нь эдгээрийг memo-той дуудна (§11.2).
import { aggregateFloorMetric, isValidMeasurement, summarizeHealth } from '@/domain/classification';
import type { HealthSummary } from '@/domain/classification';
import { buildingConfig, METRICS, type BuildingConfig } from '@/domain/config/building';
import { indoorThresholds, outdoorAirThresholds } from '@/domain/config/thresholds';
import { floorLabelMn } from '@/domain/i18n/mn';
import { scenarioDefinitions, scenarioOrder } from '@/domain/scenarios/definitions';

import type { AlertFilter, EventFilter } from './uiStore';
import type {
  Alert,
  Area,
  AreaId,
  Floor,
  FloorId,
  FloorMetricAggregate,
  LiveSnapshot,
  MetricType,
  OutdoorConditions,
  ScenarioId,
  SensorReading,
  ThresholdConditionId,
  TrendPoint,
  SimTimeMs,
  SystemEvent,
  VentilationDevice,
} from '@/domain/types';

/** Цагийн шугамд харуулах үйл явдлын тоо (§11.4) */
export const RECENT_EVENT_LIMIT = 50;

type OutdoorMetric = Exclude<keyof OutdoorConditions, 'co2'>;

/** Гадна нөхцөл — OUT-* утгаас (snapshot-д давхардуулахгүй, §10). Зөв хэмжилтгүй талбар `null` (хэзээ ч 0 биш). */
export function selectOutdoorConditions(
  snapshot: LiveSnapshot,
  config: BuildingConfig = buildingConfig,
): OutdoorConditions {
  const valueOf = (metric: OutdoorMetric): number | null => {
    const sensorId = config.building.outdoorSensorIds.find(
      (id) => config.sensors[id]?.metric === metric,
    );
    const reading = sensorId === undefined ? undefined : snapshot.readings[sensorId];
    return reading !== undefined && isValidMeasurement(reading, snapshot.simTime)
      ? (reading.value as number)
      : null;
  };
  return {
    temperature: valueOf('temperature'),
    humidity: valueOf('humidity'),
    pm25: valueOf('pm25'),
    co2: outdoorAirThresholds.outdoorCo2Ppm,
  };
}

/** Нэг бүсийн 5 утга (байхгүй бол `undefined` — орлуулагч утга зохиохгүй). */
export function selectAreaReadings(
  snapshot: LiveSnapshot,
  areaId: AreaId,
  config: BuildingConfig = buildingConfig,
): Partial<Record<MetricType, SensorReading>> {
  const result: Partial<Record<MetricType, SensorReading>> = {};
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.areaId !== areaId) continue;
    const reading = snapshot.readings[sensor.id];
    if (reading !== undefined) result[sensor.metric] = reading;
  }
  return result;
}

function floorReadings(snapshot: LiveSnapshot, floorId: FloorId, config: BuildingConfig) {
  return Object.values(config.sensors)
    .filter((sensor) => sensor.floorId === floorId)
    .map((sensor) => snapshot.readings[sensor.id])
    .filter((reading): reading is SensorReading => reading !== undefined);
}

/** Бүсийн мэдрэгчүүдийн холболт ба хэмжилтийн хугацаа (FR-M1) — `SensorReading.connection` ба `timestamp`-аас. */
export interface AreaConnectionSummary {
  /** Холболтгүй биш утгуудын хамгийн сүүлийн хэмжилтийн хугацаа; бүгд холболтгүй бол `null` (зохиохгүй) */
  measuredAt: SimTimeMs | null;
  /** Тохиргоонд энэ бүсэд бүртгэлтэй мэдрэгчийн тоо */
  total: number;
  online: number;
  stale: number;
  /** Холболтгүй ба snapshot-д утга огт байхгүй мэдрэгч (хэзээ ч «холбогдсон» гэж тооцохгүй) */
  offline: number;
}

export interface AreaSummary {
  area: Area;
  readings: Partial<Record<MetricType, SensorReading>>;
  /** Бүсийн төлөв = 5 мэдрэгчийн хамгийн муу (өгөгдлийн асуудлыг тусад нь, §5.6) */
  health: HealthSummary;
  connection: AreaConnectionSummary;
}

function summarizeAreaConnection(
  snapshot: LiveSnapshot,
  areaId: AreaId,
  config: BuildingConfig,
): AreaConnectionSummary {
  const summary: AreaConnectionSummary = {
    measuredAt: null,
    total: 0,
    online: 0,
    stale: 0,
    offline: 0,
  };
  for (const sensor of Object.values(config.sensors)) {
    if (sensor.areaId !== areaId) continue;
    summary.total += 1;
    const reading = snapshot.readings[sensor.id];
    const connection = reading?.connection ?? 'offline';
    summary[connection] += 1;
    if (reading !== undefined && connection !== 'offline') {
      summary.measuredAt = Math.max(summary.measuredAt ?? reading.timestamp, reading.timestamp);
    }
  }
  return summary;
}

export function selectAreaSummary(
  snapshot: LiveSnapshot,
  areaId: AreaId,
  config: BuildingConfig = buildingConfig,
): AreaSummary | undefined {
  const area = config.areas[areaId];
  if (area === undefined) return undefined;
  const readings = selectAreaReadings(snapshot, areaId, config);
  return {
    area,
    readings,
    health: summarizeHealth(Object.values(readings).map((r) => r.status)),
    connection: summarizeAreaConnection(snapshot, areaId, config),
  };
}

/** Давхрын идэвхтэй (хүлээн авсан орно) дохионы тоо */
function countFloorAlerts(snapshot: LiveSnapshot, floorId: FloorId): number {
  return snapshot.alerts.active.filter((alert) => alert.scope.floorId === floorId).length;
}

export interface FloorSummary {
  floor: Floor;
  /** Давхрын төлөв = бүсүүдийн хамгийн муу (§5.6) */
  health: HealthSummary;
  /** Зөвхөн зөв хэмжилтээс; зөв хэмжилтгүй хэмжигдэхүүн байхгүй (тэг биш) */
  aggregates: Partial<Record<MetricType, FloorMetricAggregate>>;
  activeAlertCount: number;
}

export function selectFloorSummary(
  snapshot: LiveSnapshot,
  floorId: FloorId,
  config: BuildingConfig = buildingConfig,
): FloorSummary | undefined {
  const floor = config.floors[floorId];
  if (floor === undefined) return undefined;
  const readings = floorReadings(snapshot, floorId, config);
  const aggregates: Partial<Record<MetricType, FloorMetricAggregate>> = {};
  for (const metric of METRICS) {
    const aggregate = aggregateFloorMetric(
      readings.filter((reading) => reading.metric === metric),
      snapshot.simTime,
    );
    if (aggregate !== undefined) aggregates[metric] = aggregate;
  }
  return {
    floor,
    health: summarizeHealth(readings.map((reading) => reading.status)),
    aggregates,
    activeAlertCount: countFloorAlerts(snapshot, floorId),
  };
}

/** Давхрын жагсаалт — барилгын дарааллаар (доороос → дээш). UI харуулахдаа эргүүлж болно. */
export function selectFloorList(
  snapshot: LiveSnapshot,
  config: BuildingConfig = buildingConfig,
): FloorSummary[] {
  return config.building.floorIds
    .map((floorId) => selectFloorSummary(snapshot, floorId, config))
    .filter((summary): summary is FloorSummary => summary !== undefined);
}

export interface StatusBarData {
  /** Барилгын төлөв = давхруудын хамгийн муу (§5.6) */
  health: HealthSummary;
  activeAlertCount: number;
  autoMode: boolean;
}

export function selectStatusBar(
  snapshot: LiveSnapshot,
  config: BuildingConfig = buildingConfig,
): StatusBarData {
  const indoor = Object.values(config.sensors)
    .filter((sensor) => sensor.location === 'indoor')
    .map((sensor) => snapshot.readings[sensor.id])
    .filter((reading): reading is SensorReading => reading !== undefined);
  return {
    health: summarizeHealth(indoor.map((reading) => reading.status)),
    activeAlertCount: snapshot.alerts.active.length,
    autoMode: snapshot.control.autoMode,
  };
}

/** Давхрын төхөөрөмж — тохиргооны дарааллаар (SF → EF → OAD) */
export function selectFloorDevices(
  snapshot: LiveSnapshot,
  floorId: FloorId,
  config: BuildingConfig = buildingConfig,
): VentilationDevice[] {
  const floor = config.floors[floorId];
  if (floor === undefined) return [];
  return floor.deviceIds
    .map((deviceId) => snapshot.devices[deviceId])
    .filter((device): device is VentilationDevice => device !== undefined);
}

const SEVERITY_RANK: Record<Alert['severity'], number> = { critical: 1, warning: 0 };

/** Идэвхтэй дохио: ноцтой нь эхэнд, дараа нь шинэ нь эхэнд, тэнцвэл ID-аар (тогтвортой дараалал). */
export function selectActiveAlerts(snapshot: LiveSnapshot): Alert[] {
  return [...snapshot.alerts.active].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.raisedAt - a.raisedAt ||
      a.id.localeCompare(b.id),
  );
}

/** Сүүлийн үйл явдлууд — шинэ нь эхэнд, хязгаартай (§11.4). snapshot-д хуучин нь эхэнд хадгалагдана (§10). */
export function selectRecentEvents(
  snapshot: LiveSnapshot,
  limit: number = RECENT_EVENT_LIMIT,
): SystemEvent[] {
  if (limit <= 0) return []; // `slice(-0)` нь бүх массивыг буцаадаг тул тусад нь
  return snapshot.events.slice(-limit).reverse();
}

// ---------- Сценарийн самбар ба яаралтай мөр (§7.1, §7.4, §6.9, Phase 6b) ----------

export interface ScenarioItem {
  id: ScenarioId;
  name: string;
  description: string;
  /** Эхлүүлэхээс өмнө анхааруулгын баталгаажуулалт заавал (S6, §6.9) */
  requiresConfirmation: boolean;
  /** `true` — одоогийн төлөвөөс эхэлнэ (зөвхөн Сэргэлт, §7.1) */
  startsFromCurrent: boolean;
  /** Одоо эхлүүлэх боломжгүй бол `true` (Сэргэлт яаралтай байдлын үед, §7.2 S8) */
  blockedByEmergency: boolean;
}

export interface ActiveScenarioView {
  id: ScenarioId;
  name: string;
  /** 0–100, бүхэл хувь */
  percent: number;
}

export interface EmergencyView {
  fireFloorId: FloorId;
  fireFloorLabel: string;
}

export interface ScenarioPanelData {
  items: ScenarioItem[];
  active: ActiveScenarioView | null;
  emergency: EmergencyView | null;
}

/** Яаралтай байдал (`ControlState.emergency`) — идэвхгүй бол `null` */
export function selectEmergency(
  snapshot: LiveSnapshot,
  config: BuildingConfig = buildingConfig,
): EmergencyView | null {
  const emergency = snapshot.control.emergency;
  if (emergency === null) return null;
  const level = config.floors[emergency.fireFloorId]?.level;
  return {
    fireFloorId: emergency.fireFloorId,
    fireFloorLabel: level === undefined ? emergency.fireFloorId : floorLabelMn(level),
  };
}

/** Сценарийн самбарын өгөгдөл: §7.2-ын дарааллаар 8 сценари, идэвхтэй сценарийн явц, яаралтай байдал. */
export function selectScenarioPanel(
  snapshot: LiveSnapshot,
  config: BuildingConfig = buildingConfig,
): ScenarioPanelData {
  const emergency = selectEmergency(snapshot, config);
  const items = scenarioOrder.map((id): ScenarioItem => {
    const scenario = scenarioDefinitions[id];
    return {
      id,
      name: scenario.name,
      description: scenario.description,
      requiresConfirmation: scenario.requiresConfirmation,
      startsFromCurrent: scenario.startsFrom === 'current',
      blockedByEmergency: scenario.startsFrom === 'current' && emergency !== null,
    };
  });
  const running = snapshot.simulation.activeScenario;
  const active =
    running === null
      ? null
      : {
          id: running.id,
          name: scenarioDefinitions[running.id].name,
          percent: Math.round(Math.min(1, Math.max(0, running.progress)) * 100),
        };
  return { items, active, emergency };
}

// ---------- Хандлагын график (FR-T1, §5.6 «Графикт max-ийг зурна», Phase 6c) ----------

/** Нэг босгын шугам: тал, түвшин, орох утга (§5.5) */
export interface TrendThreshold {
  condition: ThresholdConditionId;
  side: 'high' | 'low';
  level: 'warning' | 'critical';
  value: number;
}

/** Босгын зурвас (чимэглэлийн дэвсгэр): `from` < `to`, y тэнхлэгийн мужаар хайчилсан */
export interface TrendBand {
  level: 'warning' | 'critical';
  from: number;
  to: number;
}

export interface TrendChartData {
  points: readonly TrendPoint[];
  thresholds: TrendThreshold[];
  bands: TrendBand[];
  /** y тэнхлэгийн муж; зөв утга нэг ч байхгүй бол `null` */
  domain: [number, number] | null;
  latest: number | null;
  min: number | null;
  max: number | null;
}

/** Хоосон түүхийн тогтвортой лавлагаа (selector бүр шинэ массив буцаахгүй) */
const EMPTY_POINTS: readonly TrendPoint[] = [];

/** Давхар × хэмжигдэхүүний хандлагын цуваа (snapshot-ийн лавлагаа — structural sharing, §11.2) */
export function selectTrendPoints(
  snapshot: LiveSnapshot,
  floorId: FloorId,
  metric: MetricType,
): readonly TrendPoint[] {
  return snapshot.history[floorId]?.[metric] ?? EMPTY_POINTS;
}

/** Тухайн хэмжигдэхүүний босгын шугамууд (§5.5; дотоод босго) */
export function trendThresholds(metric: MetricType): TrendThreshold[] {
  const result: TrendThreshold[] = [];
  for (const [condition, definition] of Object.entries(indoorThresholds) as [
    ThresholdConditionId,
    (typeof indoorThresholds)[ThresholdConditionId],
  ][]) {
    if (definition.metric !== metric) continue;
    result.push(
      { condition, side: definition.side, level: 'warning', value: definition.warningEnter },
      { condition, side: definition.side, level: 'critical', value: definition.criticalEnter },
    );
  }
  return result;
}

/**
 * Хандлагын графикийн өгөгдөл. y тэнхлэгийн муж нь утгыг бүхэлд нь багтааж, хамгийн ойрын анхааруулгын босгыг үргэлж
 * харуулна; утга анхааруулгын босгыг давсан бол ноцтой босгыг ч багтаана (босго хүртэлх зай харагдана). `null` цэг
 * (зөв хэмжилтгүй) нь тасархай болж үлдэнэ — хэзээ ч тэг биш (FR-M5).
 */
export function selectTrendChart(
  points: readonly TrendPoint[],
  metric: MetricType,
): TrendChartData {
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const thresholds = trendThresholds(metric);
  if (values.length === 0) {
    return { points, thresholds, bands: [], domain: null, latest: null, min: null, max: null };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = points[points.length - 1];
  const latest = last?.value ?? null;

  let low = min;
  let high = max;
  for (const side of ['high', 'low'] as const) {
    const warning = thresholds.find((t) => t.side === side && t.level === 'warning');
    const critical = thresholds.find((t) => t.side === side && t.level === 'critical');
    if (warning === undefined || critical === undefined) continue;
    if (side === 'high') {
      high = Math.max(high, max >= warning.value ? critical.value : warning.value);
    } else {
      low = Math.min(low, min <= warning.value ? critical.value : warning.value);
    }
  }
  // Ирмэгт 8%-ийн зай; муж тэг өргөнтэй бол нэгж зай
  const pad = high > low ? (high - low) * 0.08 : 1;
  const domain: [number, number] = [low - pad, high + pad];

  const bands: TrendBand[] = [];
  const clip = (level: TrendBand['level'], from: number, to: number) => {
    const a = Math.max(from, domain[0]);
    const b = Math.min(to, domain[1]);
    if (b > a) bands.push({ level, from: a, to: b });
  };
  for (const side of ['high', 'low'] as const) {
    const warning = thresholds.find((t) => t.side === side && t.level === 'warning');
    const critical = thresholds.find((t) => t.side === side && t.level === 'critical');
    if (warning === undefined || critical === undefined) continue;
    if (side === 'high') {
      clip('warning', warning.value, critical.value);
      clip('critical', critical.value, domain[1]);
    } else {
      clip('warning', critical.value, warning.value);
      clip('critical', domain[0], critical.value);
    }
  }
  return { points, thresholds, bands, domain, latest, min, max };
}

// ---------- Дохио ба үйл явдлын шүүлт (FR-A2, FR-A3, Phase 6d, D83) ----------

/** Шүүлттэй дохионы жагсаалт. Шийдэгдсэн нь `recentResolved`-ээс, шинэ нь эхэнд; бусад нь идэвхтэйн эрэмбээр. */
export function selectFilteredAlerts(snapshot: LiveSnapshot, filter: AlertFilter): Alert[] {
  const source =
    filter.status === 'resolved'
      ? [...snapshot.alerts.recentResolved].sort(
          (a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0) || a.id.localeCompare(b.id),
        )
      : selectActiveAlerts(snapshot).filter(
          (alert) => filter.status === 'open' || alert.status === filter.status,
        );
  return source.filter(
    (alert) =>
      (filter.severity === 'all' || alert.severity === filter.severity) &&
      (filter.floor === 'all' ||
        (filter.floor === 'building'
          ? alert.scope.floorId === undefined
          : alert.scope.floorId === filter.floor)) &&
      (filter.metric === 'all' || alert.scope.metric === filter.metric),
  );
}

/** Дохионы тоо: ажиллаж буй (идэвхтэй + хүлээн авсан) ба шийдэгдсэн — шүүлтийн шошгонд */
export function selectAlertCounts(snapshot: LiveSnapshot): { open: number; resolved: number } {
  return { open: snapshot.alerts.active.length, resolved: snapshot.alerts.recentResolved.length };
}

/** Шүүлттэй бүрэн үйл явдлын түүх — шинэ нь эхэнд (ring buffer-ийн бүх үйл явдал, §11.4) */
export function selectFilteredEvents(snapshot: LiveSnapshot, filter: EventFilter): SystemEvent[] {
  const result: SystemEvent[] = [];
  for (let i = snapshot.events.length - 1; i >= 0; i -= 1) {
    const event = snapshot.events[i]!;
    if (filter.category !== 'all' && event.category !== filter.category) continue;
    if (filter.severity !== 'all' && event.severity !== filter.severity) continue;
    if (filter.floor !== 'all' && event.floorId !== filter.floor) continue;
    result.push(event);
  }
  return result;
}
