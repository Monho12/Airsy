// Симуляцийн тохиргоо (CLAUDE.md §11.1). Phase 2-т зөвхөн эхлэх цаг (D45); seed болон загварын тогтмол Phase 4-т.
import type { SimTimeMs } from '@/domain/types';

export const simulationConfig: { readonly startTime: SimTimeMs } = {
  /** 2026-10-19 (Даваа) 09:00:00 Улаанбаатарын цагаар = 2026-10-19T01:00:00Z (D45) */
  startTime: Date.UTC(2026, 9, 19, 1, 0, 0),
};
