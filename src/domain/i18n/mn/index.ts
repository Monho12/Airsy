// Монгол UI бичвэрийн цорын ганц нэгтгэсэн цэг (CLAUDE.md §8.9). Сэдэв бүр тусдаа файлд.
import { alerts } from './alerts';
import { classification } from './classification';
import { common } from './common';
import { control } from './control';
import { devices } from './devices';
import { events } from './events';
import { metrics } from './metrics';

export const mn = {
  common,
  classification,
  metrics,
  devices,
  control,
  alerts,
  events,
} as const;

export {
  DISPLAY_TIME_ZONE,
  floorLabelMn,
  formatMetricValueMn,
  formatNumberMn,
  formatTimeMn,
} from './format';
export type { ThresholdExplanationInput } from './classification';
