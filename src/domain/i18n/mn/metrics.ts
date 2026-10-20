// Хэмжигдэхүүний Монгол нэр (CLAUDE.md §5.4 «UI дахь нэр», §8.9). Эзэмшигч: Frontend (§14.3).
import type { MetricType } from '@/domain/types';

export const metrics = {
  /** Бүтэн нэр — гарчиг, шошгонд (§5.4; VOC нь «(симуляци)»-тэй, §8.9) */
  label: {
    temperature: 'Температур',
    co2: 'Нүүрсхүчлийн хий (CO₂)',
    humidity: 'Харьцангуй чийгшил',
    pm25: 'Нарийн тоосонцор (PM2.5)',
    voc: 'VOC индекс (симуляци)',
  } satisfies Record<MetricType, string>,

  /** Богино нэр — өгүүлбэр дотор («CO₂ 1,240 ppm байна.») ба нягт харагдацад */
  shortLabel: {
    temperature: 'Температур',
    co2: 'CO₂',
    humidity: 'Харьцангуй чийгшил',
    pm25: 'PM2.5',
    voc: 'VOC индекс',
  } satisfies Record<MetricType, string>,
} as const;
