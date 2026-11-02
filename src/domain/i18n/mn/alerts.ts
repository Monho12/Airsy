// Дохионы Монгол бичвэр (CLAUDE.md §4.4, §8.9). Эзэмшигч: Симуляцийн инженер (§14.3; Phase 2-т D48).
import type { Alert, AlertType } from '@/domain/types';

export const alerts = {
  type: {
    threshold: 'Босго давсан',
    sensor_offline: 'Мэдрэгч холболтгүй',
    sensor_invalid: 'Буруу утга',
    outdoor_air_restricted: 'Гадна агаарыг хязгаарласан',
    control_degraded: 'Удирдлага нөөц горимд',
    emergency: 'Яаралтай байдал (симуляци)',
  } satisfies Record<AlertType, string>,

  severity: {
    warning: 'Анхааруулга',
    critical: 'Ноцтой',
  } satisfies Record<Alert['severity'], string>,

  status: {
    active: 'Идэвхтэй',
    acknowledged: 'Хүлээн авсан',
    resolved: 'Шийдэгдсэн',
  } satisfies Record<Alert['status'], string>,

  /** «CO₂ өндөр — 2-р давхар» (§10) */
  thresholdTitle(metricShortLabel: string, side: 'high' | 'low', floorLabel: string): string {
    return `${metricShortLabel} ${side === 'high' ? 'өндөр' : 'бага'} — ${floorLabel}`;
  },

  sensorOfflineTitle(floorLabel: string): string {
    return `Мэдрэгч холболтгүй — ${floorLabel}`;
  },

  sensorOfflineMessage(areaName: string, metricShortLabel: string): string {
    return `${areaName}: ${metricShortLabel} мэдрэгчээс утга ирэхгүй байна (өгөгдөлгүй, 0 биш).`;
  },

  sensorInvalidTitle(locationLabel: string): string {
    return `Буруу утга — ${locationLabel}`;
  },

  sensorInvalidMessage(areaName: string, metricShortLabel: string, explanation: string): string {
    return `${areaName}: ${metricShortLabel} мэдрэгч. ${explanation}`;
  },

  /** Хоосон төлөв (§8.7) */
  emptyActive: 'Идэвхтэй дохио алга — бүх давхар хэвийн.',
} as const;
