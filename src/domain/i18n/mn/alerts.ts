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

  // ---------- Удирдлагын төлөвийн дохио (§9.5-ын 6b, Phase 5) ----------
  controlDegradedTitle(floorLabel: string): string {
    return `Удирдлага нөөц горимд — ${floorLabel}`;
  },
  controlDegradedMessage(floorLabel: string): string {
    return `${floorLabel}: нэг ба түүнээс олон бүсэд CO₂-ийн зөв хэмжилт алга. Агааржуулалтыг доод тал нь «Дунд» түвшинд барьж байна.`;
  },
  outdoorAirRestrictedTitle: 'Гадна агаарыг хязгаарласан — барилга',
  outdoorAirRestrictedMessage:
    'Гадна PM2.5 өндөр тул бүх давхрын гадна агаарын хаалтыг «Бага зэрэг»-ээс илүү нээхгүй.',
  emergencyTitle: 'Яаралтай байдал (симуляци) — барилга',
  emergencyMessage(fireFloorLabel: string): string {
    return `${fireFloorLabel}-т галын дохиоллын сигнал (симуляци). Сургалтын жишээ стратеги идэвхтэй.`;
  },

  /** «Шийдэгдсэн» харагдацын самбарын гарчиг (D83-ын 7) */
  resolvedTitle: 'Шийдэгдсэн дохио',

  /** Хоосон төлөв (§8.7) */
  emptyActive: 'Идэвхтэй дохио алга — бүх давхар хэвийн.',

  // ---------- Шүүлт, хүлээн авах, шийдэгдсэн түүх (FR-A2, Phase 6d, D83) ----------
  filter: {
    label: 'Дохионы шүүлт',
    severity: 'Ноцтой байдал',
    floor: 'Давхар',
    metric: 'Хэмжигдэхүүн',
    status: 'Төлөв',
    all: 'Бүгд',
    building: 'Барилга (давхаргүй)',
    statusOption: {
      open: 'Идэвхтэй ба хүлээн авсан',
      active: 'Идэвхтэй',
      acknowledged: 'Хүлээн авсан',
      resolved: 'Шийдэгдсэн',
    },
    reset: 'Шүүлтийг цэвэрлэх',
    noMatch: 'Шүүлтэд тохирох дохио алга.',
    emptyResolved: 'Шийдэгдсэн дохио алга.',
  },
  /** Самбарын гарчгийн тоо: «3 / 5» — шүүлтэд тохирсон / нийт */
  shownCount: (shown: number, total: number) =>
    shown === total ? `${total}` : `${shown} / ${total}`,
  /** Товчны үйл үг; төлөвийн шошго нь «Хүлээн авсан» (§8.9, D83) */
  acknowledge: 'Хүлээн авах',
  acknowledgeLabel: (title: string) => `Дохиог хүлээн авах: ${title}`,
  acknowledgedAt: 'Хүлээн авсан',
  resolvedAt: 'Шийдэгдсэн',
  raisedAt: 'Үүссэн',
  emergencyAckNote:
    'Идэвхтэй үед хүлээн авах боломжгүй — яаралтай симуляцийг дуусгахад шийдэгдэнэ.',

  /** Шинэ ноцтой дохиог дэлгэц уншигчид мэдэгдэх (FR-A5, §8.8, Phase 7) */
  criticalAnnouncement(titles: readonly string[]): string {
    return titles.length === 1
      ? `Шинэ ноцтой дохио: ${titles[0]}.`
      : `${titles.length} шинэ ноцтой дохио: ${titles.join('; ')}.`;
  },
} as const;
