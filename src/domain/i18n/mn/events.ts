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

  simulationStarted: 'Симуляци эхэлсэн — бүх утга браузер дотор үүсгэсэн симуляци.',

  sensorDisconnected(floorLabel: string, areaName: string, metricShortLabel: string): string {
    return `${floorLabel}, ${areaName}: ${metricShortLabel} мэдрэгч салсан.`;
  },

  alertRaised(alertTitle: string): string {
    return `Дохио үүссэн: ${alertTitle}.`;
  },
} as const;
