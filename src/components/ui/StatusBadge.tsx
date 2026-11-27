// Төлөвийн тэмдэг — үргэлж тэмдэг + бичвэр (CLAUDE.md §8.3: зөвхөн өнгөөр хэзээ ч биш).
import {
  Ban,
  CircleCheck,
  CircleSlash,
  Octagon,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { mn } from '@/domain/i18n/mn';
import type { HealthStatus } from '@/domain/types';

const ICONS: Record<HealthStatus, LucideIcon> = {
  normal: CircleCheck,
  warning: TriangleAlert, // ▲ гурвалжин
  critical: Octagon, // ⬣ найман өнцөгт
  offline: CircleSlash, // ⊘ зураастай тойрог
  invalid: Ban,
};

interface StatusBadgeProps {
  status: HealthStatus;
  /** Шошгыг өөрчлөх шаардлагатай бол (жишээ нь дохионы ноцтой байдал); анхдагч нь төлөвийн шошго */
  label?: string;
  /**
   * Нягт: зөвхөн тэмдэг харагдана (хэлбэр нь төлөв бүрт өөр — зөвхөн өнгө биш, §8.3), шошго дэлгэц уншигчид ба
   * tooltip-д. Нарийн баганад (давхрын жагсаалт, D100).
   */
  compact?: boolean;
}

export function StatusBadge({ status, label, compact = false }: StatusBadgeProps) {
  const Icon = ICONS[status];
  const text = label ?? mn.classification.statusLabel[status];
  return (
    <span
      className={`ui-status ui-status--${status}`}
      data-status={status}
      title={compact ? text : undefined}
    >
      <Icon className="ui-status__icon" aria-hidden="true" focusable="false" />
      <span className={compact ? 'visually-hidden' : undefined}>{text}</span>
    </span>
  );
}

interface HealthIndicatorProps {
  /** Хамгийн муу *зөв* төлөв; зөв утга огт байхгүй бол `null` (§5.6) */
  worstValid: HealthStatus | null;
  /** Хамгийн муу төлөв (D51) — зөв утга байхгүй үед харуулна */
  worst: HealthStatus;
  hasDataIssue: boolean;
}

/** Бүс/давхар/барилгын төлөв: нэг холболтгүй мэдрэгч жинхэнэ анхааруулгыг далдлахгүй (§5.6). */
export function HealthIndicator({
  worstValid,
  worst,
  hasDataIssue,
  compact = false,
}: HealthIndicatorProps & { compact?: boolean }) {
  return (
    <span className="ui-health">
      <StatusBadge status={worstValid ?? worst} compact={compact} />
      {hasDataIssue && worstValid !== null && (
        <StatusBadge status="offline" label={mn.common.dataIssue} compact={compact} />
      )}
    </span>
  );
}
