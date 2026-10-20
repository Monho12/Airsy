// Snapshot-оос гаргаж авах өгөгдөл (CLAUDE.md §5.6, §10.2). Цэвэр функцүүд — төлөвийг хэзээ ч хадгалахгүй.
// Бүс/давхар/барилгын төлөв, тоо, жагсаалтыг уншихдаа тооцно. UI нь эдгээрийг memo-той дуудна (§11.2).
import { aggregateFloorMetric, isValidMeasurement, summarizeHealth } from '@/domain/classification';
import type { HealthSummary } from '@/domain/classification';
import { buildingConfig, METRICS, type BuildingConfig } from '@/domain/config/building';
import { outdoorAirThresholds } from '@/domain/config/thresholds';
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
  SensorReading,
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
