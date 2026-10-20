// Ангиллын Монгол тайлбар (CLAUDE.md §5.6-ийн 7-р алхам, §8.9). Эзэмшигч: Ахлах архитектор (§14.3).
// Тоог `Intl.NumberFormat('mn-MN')`-ээр, нарийвчлалыг §5.4-өөр (D44). 2-р шатанд `format.ts` нэмэгдэхэд
// энэ тоо форматлагчийг тэнд нэгтгэнэ — хоёр өөр формат хэзээ ч бүү үүсгэ.
import type { MetricType, MetricUnit, ThresholdLevel } from '@/domain/types';

const metricLabel: Record<MetricType, string> = {
  temperature: 'Температур',
  co2: 'CO₂',
  humidity: 'Харьцангуй чийгшил',
  pm25: 'PM2.5',
  voc: 'VOC индекс',
};

const levelLabel: Record<Exclude<ThresholdLevel, 'normal'>, { title: string; word: string }> = {
  warning: { title: 'Анхааруулах', word: 'анхааруулга' },
  critical: { title: 'Ноцтой', word: 'ноцтой' },
};

const numberFormats = new Map<number, Intl.NumberFormat>();

/** Тоог `mn-MN` хэлбэрээр, тогтмол аравтын оронтой форматлана (D44). */
export function formatNumberMn(value: number, decimals: number): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat('mn-MN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

/** Утгыг нэгжтэй нь (§8.9: °C, ppm, %, µg/m³ хэвээр; VOC индекс нэгжгүй). */
export function formatMetricValueMn(value: number, unit: MetricUnit, decimals: number): string {
  const number = formatNumberMn(value, decimals);
  switch (unit) {
    case '%RH':
      return `${number}%`;
    case 'index':
      return number;
    default:
      return `${number} ${unit}`;
  }
}

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
    const head = `${metricLabel[input.metric]} ${fmt(input.value)} байна.`;
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
