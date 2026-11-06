// Үйл явдлын Монгол бичвэр (CLAUDE.md §8.9 — `type` enum-ийг UI-д түүхий хэлбэрээр хэзээ ч харуулахгүй).
// Эзэмшигч: Симуляцийн инженер (§14.3; Phase 2-т D48).
import type { SystemEvent, SystemEventType } from '@/domain/types';

export const events = {
  type: {
    SIMULATION_STARTED: 'Симуляци эхэлсэн',
    SIMULATION_PAUSED: 'Симуляци түр зогссон',
    SIMULATION_RESET: 'Симуляцийг эхнээс нь эхлүүлсэн',
    SPEED_CHANGED: 'Хурд өөрчлөгдсөн',
    SCENARIO_STARTED: 'Сценари эхэлсэн',
    SCENARIO_STEP: 'Сценарийн алхам',
    SCENARIO_COMPLETED: 'Сценари дууссан',
    SCENARIO_STOPPED: 'Сценари зогссон',
    SENSOR_DISCONNECTED: 'Мэдрэгч салсан',
    SENSOR_RECONNECTED: 'Мэдрэгч дахин холбогдсон',
    SENSOR_INVALID_READING: 'Буруу утга',
    ALERT_RAISED: 'Дохио үүссэн',
    ALERT_ESCALATED: 'Дохио хүндэрсэн',
    ALERT_DEESCALATED: 'Дохио хөнгөрсөн',
    ALERT_RESOLVED: 'Дохио шийдэгдсэн',
    ALERT_ACKNOWLEDGED: 'Дохиог хүлээн авсан',
    DEVICE_STATE_CHANGED: 'Төхөөрөмжийн төлөв өөрчлөгдсөн',
    MANUAL_OVERRIDE_SET: 'Гар удирдлага тавьсан',
    MANUAL_OVERRIDE_CLEARED: 'Гар удирдлагыг цуцалсан',
    MANUAL_OVERRIDE_EXPIRED: 'Гар удирдлагын хугацаа дууссан',
    AUTO_MODE_ENABLED: 'Автомат горим асаасан',
    AUTO_MODE_DISABLED: 'Автомат горим унтраасан',
    CONTROL_CONSTRAINT_ACTIVE: 'Хязгаарлалт идэвхжсэн',
    CONTROL_CONSTRAINT_CLEARED: 'Хязгаарлалт арилсан',
    CONTROL_FALLBACK_ACTIVE: 'Нөөц горим идэвхжсэн',
    CONTROL_FALLBACK_CLEARED: 'Нөөц горим дууссан',
    EMERGENCY_STARTED: 'Яаралтай байдал эхэлсэн (симуляци)',
    EMERGENCY_ENDED: 'Яаралтай байдал дууссан (симуляци)',
  } satisfies Record<SystemEventType, string>,

  category: {
    simulation: 'Симуляци',
    scenario: 'Сценари',
    sensor: 'Мэдрэгч',
    alert: 'Дохио',
    control: 'Удирдлага',
    operator: 'Оператор',
  } satisfies Record<SystemEvent['category'], string>,

  /** Хоосон төлөв (§8.7) */
  empty: 'Үйл явдал алга.',

  // ---------- Шүүлттэй бүрэн түүх (FR-A3, Phase 6d, D83) ----------
  severity: {
    info: 'Мэдээлэл',
    warning: 'Анхааруулга',
    critical: 'Ноцтой',
  } satisfies Record<SystemEvent['severity'], string>,
  filter: {
    label: 'Үйл явдлын шүүлт',
    category: 'Ангилал',
    severity: 'Ач холбогдол',
    floor: 'Давхар',
    all: 'Бүгд',
    reset: 'Шүүлтийг цэвэрлэх',
    noMatch: 'Шүүлтэд тохирох үйл явдал алга.',
  },
  showMore: 'Цааш харуулах',
  /** «Харуулж буй: 50 / 500» — түүх хамгийн ихдээ 500 (§11.4) */
  shown: (shown: number, total: number) => `Харуулж буй: ${shown} / ${total}`,

  simulationStarted: 'Симуляци эхэлсэн — бүх утга браузер дотор үүсгэсэн симуляци.',

  sensorDisconnected(floorLabel: string, areaName: string, metricShortLabel: string): string {
    return `${floorLabel}, ${areaName}: ${metricShortLabel} мэдрэгч салсан.`;
  },

  alertRaised(alertTitle: string): string {
    return `Дохио үүссэн: ${alertTitle}.`;
  },

  // ---------- Phase 4 (D72) ----------
  simulationResumed: 'Симуляци үргэлжилсэн.',
  simulationPaused: 'Симуляци түр зогссон.',

  speedChanged(from: number, to: number): string {
    return `Симуляцийн хурд ${from}× → ${to}×.`;
  },

  /** `location` нь «7-р давхар, Нээлттэй оффис (хойд)» эсвэл гадна станц */
  sensorDisconnectedAt(location: string, metricShortLabel: string): string {
    return `${location}: ${metricShortLabel} мэдрэгч салсан (симуляцийн эвдрэл).`;
  },

  sensorReconnected(location: string, metricShortLabel: string): string {
    return `${location}: ${metricShortLabel} мэдрэгч дахин холбогдсон.`;
  },

  sensorInvalidReading(location: string, metricShortLabel: string, valueText: string): string {
    return `${location}: ${metricShortLabel} мэдрэгч буруу утга (${valueText}) илгээв.`;
  },

  alertEscalated(alertTitle: string): string {
    return `Дохио ноцтой болж хүндэрсэн: ${alertTitle}.`;
  },

  alertDeescalated(alertTitle: string): string {
    return `Дохио анхааруулга болж хөнгөрсөн: ${alertTitle}.`;
  },

  alertResolved(alertTitle: string): string {
    return `Дохио шийдэгдсэн: ${alertTitle}.`;
  },

  // ---------- Phase 5 — удирдлага (§6.2, §6.7) ----------

  /** Автомат шийдвэрийн мөр: «Агаар оруулах сэнс F02: Бага → Их (Агаарын чанар — анхааруулга).» */
  deviceStateChanged(deviceName: string, from: string, to: string, ruleName: string): string {
    return `${deviceName}: ${from} → ${to} (${ruleName}).`;
  },
  manualOverrideSet(deviceName: string, from: string, to: string): string {
    return `${deviceName}: гар удирдлага, ${from} → ${to}.`;
  },
  manualOverrideCleared(deviceName: string): string {
    return `${deviceName}: автомат руу буцаав.`;
  },
  manualOverrideExpired(deviceName: string): string {
    return `${deviceName}: гар удирдлагын хугацаа дуусч, автомат руу буцав.`;
  },
  autoModeEnabled: 'Автомат горимыг асаав.',
  autoModeDisabled: 'Автомат горимыг унтраав — систем зөвхөн зөвлөмж харуулна.',
  constraintActive(outdoorPmText: string): string {
    return `Гадна агаар бохир (PM2.5 ${outdoorPmText}) — гадна агаарын хаалтыг «Бага зэрэг»-ээр хязгаарлав.`;
  },
  constraintCleared: 'Гадна агаарын хязгаарлалт арилав.',
  fallbackActive(floorLabel: string): string {
    return `${floorLabel}: нэг ба түүнээс олон бүсэд CO₂-ийн зөв хэмжилт алга — удирдлага нөөц горимд орлоо.`;
  },
  fallbackCleared(floorLabel: string): string {
    return `${floorLabel}: бүх бүсийн CO₂-ийн хэмжилт сэргэж, нөөц горим дуусав.`;
  },
} as const;
