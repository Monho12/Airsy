// Симуляцийн тохиргоо (CLAUDE.md §5.8, §11.1, §11.4, D45, D68–D70).
// ⚠️ Загварын тогтмолууд нь АНХНЫ ТААРУУЛГЫН УТГА — баталгаажсан физик тогтмол биш (D68).
import type { MetricType, SimTimeMs, SimulationSpeed } from '@/domain/types';

/** Дэмжигдсэн хурд (FR-S1, §11.1) — runtime-ийн шалгалт ба төлөвийн мөрийн dropdown хоёулаа эндээс */
export const simulationSpeeds: readonly SimulationSpeed[] = [1, 2, 5, 10];

/** Симуляцийн нэг алхам, ms (§11.1: dt = 1000 ms) */
const STEP_MS = 1000;
/** Ганц timer-ийн tick, ms (D70). `STEP_MS / TICK_MS` нь бүхэл тоо байх ёстой. */
const TICK_MS = 200;

export const simulationConfig = {
  /** 2026-10-19 (Даваа) 09:00:00 Улаанбаатарын цагаар = 2026-10-19T01:00:00Z (D45) */
  startTime: Date.UTC(2026, 9, 19, 1, 0, 0) as SimTimeMs,
  /** Бүх сценари ба эхлэлийн тогтмол seed (§7.1, D69) */
  defaultSeed: 20261019,
  stepMs: STEP_MS,
  tickMs: TICK_MS,
  /** 1× хурдаар нэг алхамд хэрэгтэй tick-ийн тоо: tick бүрт `acc += speed`, `floor(acc / ticksPerStep)` алхам (D70) */
  ticksPerStep: STEP_MS / TICK_MS,
} as const;

/**
 * §5.8-ын загварын тогтмол (D68). Хугацааны нэгж — секунд. Хурдны тогтмолуудыг зөвхөн «1× хурдаар ~30–90 с-д нөлөө
 * харагдах» зорилтоор сонгосон тааруулгын утга; тооцоолсон хугацааны тогтмолыг тест баталгаажуулна.
 */
export const simulationModel = {
  /** k_oa — гадна агаарын солилцоо, с⁻¹ */
  kOutdoorAir: 1 / 18,
  /** k_ex — агаар гаргах, с⁻¹ */
  kExhaust: 1 / 18,
  /** k_flt — эргэлтийн агаарын шүүлтүүр, с⁻¹ */
  kFiltration: 1 / 18,
  /** Гадна агаарын PM2.5-ын шүүлтүүрийн үр ашиг (0–1) */
  filterEfficiency: 0.5,
  /** `heatGain`-ийг °C/с-ээр илэрхийлэх тул 1 (физик дулаан багтаамж биш) */
  thermalMass: 1,
  /** setpoint руу буцах хурд, с⁻¹ */
  hvacRecovery: 1 / 90,
  /** Чийгшлийн гадна агаартай холбогдох коэффициент */
  humidityCoupling: 1,
} as const;

/** Мэдрэгчийн илгээж буй утгын жигд тархалттай шуугиан ±a (D69) — бүсийн дотоод төлөвт нэмэхгүй */
export const sensorNoiseAmplitude: Record<MetricType, number> = {
  temperature: 0.05,
  co2: 5,
  humidity: 0.3,
  pm25: 0.3,
  voc: 1.5,
};

/** Хязгаартай санах ой (§11.4) */
export const bufferLimits = {
  events: 500,
  recentResolvedAlerts: 100,
  trendPointsPerSeries: 300,
} as const;
