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
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const Icon = ICONS[status];
  return (
    <span className={`ui-status ui-status--${status}`} data-status={status}>
      <Icon className="ui-status__icon" aria-hidden="true" focusable="false" />
      <span>{label ?? mn.classification.statusLabel[status]}</span>
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
export function HealthIndicator({ worstValid, worst, hasDataIssue }: HealthIndicatorProps) {
  return (
    <span className="ui-health">
      <StatusBadge status={worstValid ?? worst} />
      {hasDataIssue && worstValid !== null && (
        <StatusBadge status="offline" label={mn.common.dataIssue} />
      )}
    </span>
  );
}
