// Төлөвийн эрэмбэ ба нэгтгэл (CLAUDE.md §5.6, D51).
import type { HealthStatus, ThresholdLevel, ThresholdLevels } from '@/domain/types';

/** Муугаас → сайн руу: critical > warning > offline > invalid > normal (D51 — тэнцээгүй, тогтмол дараалал). */
export const STATUS_PRIORITY: readonly HealthStatus[] = [
  'critical',
  'warning',
  'offline',
  'invalid',
  'normal',
];

const STATUS_RANK: Record<HealthStatus, number> = {
  critical: 4,
  warning: 3,
  offline: 2,
  invalid: 1,
  normal: 0,
};

/** Төлөвийн жин — их байх тусам муу. */
export function statusRank(status: HealthStatus): number {
  return STATUS_RANK[status];
}

/** Хамгийн муу төлөв. Хоосон бол `normal` (бүс бүр 5 мэдрэгчтэй тул ердийн үед хоосон байхгүй). */
export function worstStatus(statuses: Iterable<HealthStatus>): HealthStatus {
  let worst: HealthStatus = 'normal';
  for (const status of statuses) {
    if (STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

/** Хоёр түвшний мууг нь буцаана. */
export function worseLevel(a: ThresholdLevel, b: ThresholdLevel): ThresholdLevel {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** `levels`-ийн тал бүрийн хамгийн муу түвшин (§5.6; ерөнхий төлөвийг хадгалахгүй, эндээс гаргана). */
export function worstLevel(levels: ThresholdLevels): ThresholdLevel {
  return levels.kind === 'two-sided' ? worseLevel(levels.high, levels.low) : levels.high;
}

export interface HealthSummary {
  /** Бүх төлөвийн хамгийн муу нь (D51-ийн эрэмбээр) */
  worst: HealthStatus;
  /** Зөвхөн зөв утгын (`normal`/`warning`/`critical`) хамгийн муу нь; зөв утга байхгүй бол `null` */
  worstValid: Exclude<HealthStatus, 'offline' | 'invalid'> | null;
  /** `offline` эсвэл `invalid` байгаа эсэх — «өгөгдлийн асуудал» тэмдэгт (§5.6) */
  hasDataIssue: boolean;
}

/**
 * Бүс/давхар/барилгын төлөвийг харуулахад: нэг холболтгүй мэдрэгч жинхэнэ ноцтой утгыг
 * далдлахгүйн тулд хамгийн муу *зөв* төлөвийг ба өгөгдлийн асуудлыг тусад нь өгнө (§5.6).
 */
export function summarizeHealth(statuses: Iterable<HealthStatus>): HealthSummary {
  let worst: HealthStatus = 'normal';
  let worstValid: HealthSummary['worstValid'] = null;
  let hasDataIssue = false;
  for (const status of statuses) {
    if (STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
    if (status === 'offline' || status === 'invalid') {
      hasDataIssue = true;
    } else if (worstValid === null || STATUS_RANK[status] > STATUS_RANK[worstValid]) {
      worstValid = status;
    }
  }
  return { worst, worstValid, hasDataIssue };
}
