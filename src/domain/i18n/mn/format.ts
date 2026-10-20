// Тоо ба хугацааны Монгол хэлбэржүүлэлт — цорын ганц эх сурвалж (CLAUDE.md §8.9, D44, D45). Эзэмшигч: Frontend (§14.3).
// Тоо: `Intl.NumberFormat('mn-MN')`, нарийвчлал §5.4-өөр. Хугацаа: тогтмол `Asia/Ulaanbaatar`, 24 цаг (`h23`).
import type { MetricUnit, SimTimeMs } from '@/domain/types';

/** Харагдах хугацааны тогтмол бүс (D45) — машины бүсээс үл хамаарна. */
export const DISPLAY_TIME_ZONE = 'Asia/Ulaanbaatar';

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

const timeFormat = new Intl.DateTimeFormat('mn-MN', {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Симуляцийн хугацааг «ЦЦ:ММ:СС» хэлбэрээр (Улаанбаатар, 24 цаг; D45). */
export function formatTimeMn(time: SimTimeMs): string {
  return timeFormat.format(new Date(time));
}

/** «7-р давхар» (§8.9-ийн нэр томьёо) */
export function floorLabelMn(level: number): string {
  return `${level}-р давхар`;
}
