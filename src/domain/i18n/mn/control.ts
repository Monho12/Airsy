// Удирдлагын горимын Монгол бичвэр (CLAUDE.md §6.7, §8.9). Эзэмшигч: Симуляцийн инженер (§14.3; Phase 2-т D48).
// Phase 2-т зөвхөн унших тэмдэг; дүрмийн нэр/шалтгаан Phase 5-д нэмэгдэнэ.
import type { ControlMode } from '@/domain/types';

export const control = {
  autoModeLabel: 'Автомат горим',
  autoModeOn: 'Асаалттай',
  autoModeOff: 'Унтраалттай',

  mode: {
    auto: 'Автомат',
    manual: 'Гар удирдлага',
    emergency: 'Яаралтай байдал (симуляци)',
  } satisfies Record<ControlMode, string>,
} as const;
