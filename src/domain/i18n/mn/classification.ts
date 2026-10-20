// Ангиллын Монгол тайлбар (CLAUDE.md §5.6-ийн 7-р алхам, §8.9). Эзэмшигч: Ахлах архитектор (§14.3).
// Тоо форматлагч (`format.ts`, D44) ба хэмжигдэхүүний нэрийг (`metrics.ts`) хуваалцана — давхар формат үүсгэхгүй.
import type { HealthStatus, MetricType, MetricUnit, ThresholdLevel } from '@/domain/types';

import { formatMetricValueMn, formatNumberMn } from './format';
import { metrics } from './metrics';

const levelLabel: Record<Exclude<ThresholdLevel, 'normal'>, { title: string; word: string }> = {
  warning: { title: 'Анхааруулах', word: 'анхааруулга' },
  critical: { title: 'Ноцтой', word: 'ноцтой' },
};

export interface ThresholdExplanationInput {
  metric: MetricType;
  unit: MetricUnit;
  decimals: number;
  value: number;
  level: Exclude<ThresholdLevel, 'normal'>;
  side: 'high' | 'low';
  enter: number; // тухайн түвшний орох босго
  exit: number; // тухайн түвшний гарах босго
  /** Утга орох босгыг давахаа больсон ч гарах босгод хүрээгүй тул hysteresis-ээр барьж буй эсэх */
  heldByHysteresis: boolean;
}

export const classification = {
  /** Төлөвийн шошго (§8.9-ийн нэр томьёо) — UI-д үргэлж тэмдэгтэй хамт (§8.3) */
  statusLabel: {
    normal: 'Хэвийн',
    warning: 'Анхааруулга',
    critical: 'Ноцтой',
    offline: 'Холболтгүй',
    invalid: 'Буруу утга',
  } satisfies Record<HealthStatus, string>,

  /** Холболтгүй мэдрэгч (FR-M5) — хэзээ ч 0 гэж үзэхгүй. */
  offline: 'Өгөгдөлгүй — мэдрэгчээс утга ирэхгүй байна.',

  /** Тоон бус утга (`NaN`, `Infinity`, `null`) — §5.4. */
  invalidNonNumeric: 'Буруу утга — мэдрэгч тоон бус утга илгээсэн.',

  /** Боломжит мужаас гадуурх утга — §5.4. */
  invalidOutOfRange(value: number, min: number, max: number, unit: MetricUnit, decimals: number) {
    const range = `${formatNumberMn(min, decimals)}–${formatMetricValueMn(max, unit, decimals)}`;
    return `Буруу утга — ${formatMetricValueMn(value, unit, decimals)} нь боломжит мужаас (${range}) гадуур.`;
  },

  /** Босгын тайлбар, жишээ нь «CO₂ 1,240 ppm байна. Анхааруулах босго (1,000 ppm)-оос өндөр.» */
  threshold(input: ThresholdExplanationInput): string {
    const fmt = (n: number) => formatMetricValueMn(n, input.unit, input.decimals);
    const head = `${metrics.shortLabel[input.metric]} ${fmt(input.value)} байна.`;
    const { title, word } = levelLabel[input.level];
    const lowWord = input.side === 'low' ? ' доод' : '';
    if (!input.heldByHysteresis) {
      const relation = input.side === 'high' ? 'өндөр' : 'бага';
      return `${head} ${title}${lowWord} босго (${fmt(input.enter)})-оос ${relation}.`;
    }
    const movement = input.side === 'high' ? 'буурсан' : 'дээшилсэн';
    return `${head} ${title}${lowWord} босгоос (${fmt(input.enter)}) ${movement} ч гарах босго (${fmt(input.exit)})-д хүрээгүй тул ${word} хэвээр.`;
  },
} as const;
