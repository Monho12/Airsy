// Дохионы амьдралын мөчлөг (CLAUDE.md §4.4, §6.6, D35, D72). Цэвэр функц: ижил төлөв + нөхцөл → ижил үр дүн.
// Debounce-ийн тоолуур энд (domain/runtime-ийн төлөвт), snapshot-д ч UI-д ч биш (§6.6 «Тоолуурын байршил»).
import { bufferLimits } from '@/domain/config/simulation';
import { timingThresholds } from '@/domain/config/thresholds';
import type { Alert, AlertType, SimTimeMs } from '@/domain/types';

export type ConditionLevel = 'normal' | 'warning' | 'critical';

/** Нэг дохионы түлхүүрийн энэ алхмын нөхцөл (§5.2-ын түлхүүр — түлхүүр бүрт нэг идэвхтэй дохио) */
export interface AlertCondition {
  key: string;
  type: AlertType;
  scope: Alert['scope'];
  /**
   * `null` — зөв хэмжилтгүй тул үнэлэх боломжгүй: идэвхтэй дохиог хадгалж (шийдэгдсэн гэж үзэхгүй, §6.1),
   * шинээр үүсгэхгүй, debounce-ийг дахин эхлүүлнэ (D75).
   */
  level: ConditionLevel | null;
  title: string;
  /** Утга ба босгыг агуулсан бичвэр; үүсэх, хүндрэх, хөнгөрөх агшинд дохионд бичигдэнэ */
  message: string;
  /** Оргил утгыг хянах утга (босгын дохиод), бусад үед `null` */
  value: number | null;
  peak: 'max' | 'min' | null;
}

interface PendingCounter {
  /** ≥ анхааруулга нөхцөл дараалсан алхмын тоо */
  elevated: number;
  /** Ноцтой нөхцөл дараалсан алхмын тоо */
  critical: number;
}

export interface AlertEvaluatorState {
  /** `raisedAt`, дараа нь үүссэн дарааллаар */
  active: Alert[];
  /** Хуучнаас шинэ рүү, хязгаартай (§11.4) */
  recentResolved: Alert[];
  pending: Readonly<Record<string, PendingCounter>>;
  nextAlertNumber: number;
}

export type AlertTransition =
  | { kind: 'raised'; alert: Alert }
  | { kind: 'escalated'; alert: Alert }
  | { kind: 'deescalated'; alert: Alert }
  | { kind: 'resolved'; alert: Alert };

export const createAlertEvaluatorState = (): AlertEvaluatorState => ({
  active: [],
  recentResolved: [],
  pending: {},
  nextAlertNumber: 1,
});

export interface EvaluateAlertsOptions {
  debounceSteps?: number;
  recentResolvedLimit?: number;
}

const alertIdOf = (n: number) => `A-${String(n).padStart(4, '0')}`;

function withPeak(alert: Alert, condition: AlertCondition): Alert {
  if (condition.peak === null || condition.value === null) return alert;
  const current = alert.peakValue ?? condition.value;
  const peak =
    condition.peak === 'max'
      ? Math.max(current, condition.value)
      : Math.min(current, condition.value);
  return peak === alert.peakValue ? alert : { ...alert, peakValue: peak };
}

/**
 * Нэг алхмын үнэлгээ (§4.4):
 * - **Үүсэх:** ≥ анхааруулга нөхцөл дараалсан `debounceSteps` алхам → шинэ `AlertId`; тэр хугацаанд ноцтой нь бас
 *   `debounceSteps` үргэлжилсэн бол шууд ноцтой.
 * - **Хүндрэх:** `warning → critical` нь дараалсан `debounceSteps` алхам; хүлээн авсан байсан бол `active` руу буцна.
 * - **Хөнгөрөх:** `critical → warning` тэр даруй (ангиллын ноцтой гарах босго аль хэдийн хангагдсан, §5.6).
 * - **Шийдэгдэх:** нөхцөл `normal` болмогц (debounce-гүй — hysteresis хангалттай) → `recentResolved` руу.
 * - **Дахин үүсэх:** шийдэгдсэний дараа debounce-оос шинээр эхэлж, шинэ `AlertId`.
 */
export function evaluateAlerts(
  state: AlertEvaluatorState,
  conditions: readonly AlertCondition[],
  now: SimTimeMs,
  {
    debounceSteps = timingThresholds.alertDebounceSteps,
    recentResolvedLimit = bufferLimits.recentResolvedAlerts,
  }: EvaluateAlertsOptions = {},
): { state: AlertEvaluatorState; transitions: AlertTransition[] } {
  const transitions: AlertTransition[] = [];
  const activeByKey = new Map(state.active.map((alert) => [alert.key, alert]));
  const updated = new Map<string, Alert>(); // түлхүүр → шинэчилсэн идэвхтэй дохио
  const resolvedKeys = new Set<string>();
  const raised: Alert[] = [];
  const resolved: Alert[] = [];
  const pending: Record<string, PendingCounter> = {};
  let nextAlertNumber = state.nextAlertNumber;

  for (const condition of conditions) {
    const current = activeByKey.get(condition.key);
    if (condition.level === null) continue; // өгөгдөлгүй — хадгална, тоолуур дахин эхэлнэ

    if (condition.level === 'normal') {
      if (current !== undefined) {
        const alert: Alert = { ...current, status: 'resolved', resolvedAt: now, updatedAt: now };
        resolvedKeys.add(condition.key);
        resolved.push(alert);
        transitions.push({ kind: 'resolved', alert });
      }
      continue;
    }

    const previous = state.pending[condition.key] ?? { elevated: 0, critical: 0 };
    const counter: PendingCounter = {
      elevated: previous.elevated + 1,
      critical: condition.level === 'critical' ? previous.critical + 1 : 0,
    };
    pending[condition.key] = counter;

    if (current === undefined) {
      if (counter.elevated < debounceSteps) continue;
      const alert: Alert = {
        id: alertIdOf(nextAlertNumber),
        key: condition.key,
        type: condition.type,
        severity: counter.critical >= debounceSteps ? 'critical' : 'warning',
        status: 'active',
        scope: condition.scope,
        title: condition.title,
        message: condition.message,
        raisedAt: now,
        updatedAt: now,
        acknowledgedAt: null,
        resolvedAt: null,
        peakValue: condition.peak === null ? null : condition.value,
      };
      nextAlertNumber += 1;
      raised.push(alert);
      transitions.push({ kind: 'raised', alert });
      continue;
    }

    if (current.severity === 'warning' && counter.critical >= debounceSteps) {
      const alert = withPeak(
        {
          ...current,
          severity: 'critical',
          status: 'active',
          acknowledgedAt: null,
          message: condition.message,
          updatedAt: now,
        },
        condition,
      );
      updated.set(condition.key, alert);
      transitions.push({ kind: 'escalated', alert });
    } else if (current.severity === 'critical' && condition.level === 'warning') {
      const alert = withPeak(
        { ...current, severity: 'warning', message: condition.message, updatedAt: now },
        condition,
      );
      updated.set(condition.key, alert);
      transitions.push({ kind: 'deescalated', alert });
    } else {
      const alert = withPeak(current, condition);
      if (alert !== current) updated.set(condition.key, alert);
    }
  }

  // Өөрчлөлтгүй бол массивын лавлагааг хадгална (structural sharing, §11.2)
  const activeChanged = updated.size > 0 || resolvedKeys.size > 0 || raised.length > 0;
  const active = activeChanged
    ? [
        ...state.active
          .filter((alert) => !resolvedKeys.has(alert.key))
          .map((alert) => updated.get(alert.key) ?? alert),
        ...raised,
      ]
    : state.active;
  const recentResolved =
    resolved.length > 0
      ? [...state.recentResolved, ...resolved].slice(-recentResolvedLimit)
      : state.recentResolved;

  return { state: { active, recentResolved, pending, nextAlertNumber }, transitions };
}
