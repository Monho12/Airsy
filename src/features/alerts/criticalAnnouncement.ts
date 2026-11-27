// Шинэ ноцтой дохиог дэлгэц уншигчид мэдэгдэх логик (FR-A5, CLAUDE.md §8.8, Phase 7). Цэвэр функц — тестлэхэд хялбар.
import type { Alert, AlertId } from '@/domain/types';

/** Хоёр мэдэгдлийн хоорондох хамгийн бага бодит хугацаа (мс) — «хэт олон удаа биш» (§8.8) */
export const ANNOUNCE_COOLDOWN_MS = 5000;

/** Одоо ноцтой түвшинд байгаа идэвхтэй (эсвэл хүлээн авсан) дохио */
export function currentCriticalAlerts(active: readonly Alert[]): Alert[] {
  return active.filter((alert) => alert.severity === 'critical' && alert.status !== 'resolved');
}

/**
 * Өмнө нь ноцтой байгаагүй, шинээр ноцтой болсон дохио (шинээр үүссэн эсвэл хүндэрсэн).
 * `previous` нь өмнөх шинэчлэлийн ноцтой дохионы ID — ноцтойгоос гараад буцаж ноцтой болбол дахин мэдэгдэнэ.
 */
export function newlyCriticalAlerts(
  active: readonly Alert[],
  previous: ReadonlySet<AlertId>,
): Alert[] {
  return currentCriticalAlerts(active).filter((alert) => !previous.has(alert.id));
}
