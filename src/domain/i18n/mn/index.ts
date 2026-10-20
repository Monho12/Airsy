// Монгол UI бичвэрийн цорын ганц нэгтгэсэн цэг (CLAUDE.md §8.9). Сэдэв бүр тусдаа файлд.
import { classification } from './classification';
import { common } from './common';

export const mn = {
  common,
  classification,
} as const;

export { formatMetricValueMn, formatNumberMn } from './classification';
export type { ThresholdExplanationInput } from './classification';
