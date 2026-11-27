// Шинэ ноцтой дохиог дэлгэц уншигчид мэдэгдэх `aria-live="polite"` бүс (FR-A5, CLAUDE.md §8.8, Phase 7).
// Харагдахгүй (`visually-hidden`); зөвхөн шинээр үүссэн эсвэл ноцтой болж хүндэрсэн дохиог мэдэгдэнэ. Хэт олон удаа
// мэдэгдэхгүйн тулд хоёр мэдэгдлийн хооронд дор хаяж `ANNOUNCE_COOLDOWN_MS` хүлээж, энэ хооронд гарсан дохиог нэг
// мөрөнд нэгтгэнэ. Store-ыг `subscribe`-аар сонсдог тул snapshot бүрт компонент дахин зурагдахгүй (§11.2).
import { useEffect, useState } from 'react';

import { mn } from '@/domain/i18n/mn';
import type { AlertId, LiveSnapshot } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';

import {
  ANNOUNCE_COOLDOWN_MS,
  currentCriticalAlerts,
  newlyCriticalAlerts,
} from './criticalAnnouncement';

interface Announcement {
  text: string;
  /** Ижил бичвэрийг дахин мэдэгдэхэд DOM-ын зангилааг солихын тулд (`key`) */
  seq: number;
}

export function CriticalAlertAnnouncer() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let previous = new Set<AlertId>();
    let pending: AlertId[] = [];
    let lastAnnouncedAt = Number.NEGATIVE_INFINITY;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Хүлээгдэж буй дохионоос одоо ч ноцтой хэвээр байгааг л мэдэгдэнэ
    const flush = () => {
      timer = null;
      const active = useLiveStore.getState().snapshot?.alerts.active ?? [];
      const titles = currentCriticalAlerts(active)
        .filter((alert) => pending.includes(alert.id))
        .map((alert) => alert.title);
      pending = [];
      if (titles.length === 0) return;
      lastAnnouncedAt = Date.now();
      setAnnouncement((prev) => ({
        text: mn.alerts.criticalAnnouncement(titles),
        seq: (prev?.seq ?? 0) + 1,
      }));
    };

    const check = (snapshot: LiveSnapshot | null) => {
      const active = snapshot?.alerts.active ?? [];
      const fresh = newlyCriticalAlerts(active, previous);
      previous = new Set(currentCriticalAlerts(active).map((alert) => alert.id));
      for (const alert of fresh) if (!pending.includes(alert.id)) pending.push(alert.id);
      if (pending.length === 0 || timer !== null) return;
      const wait = lastAnnouncedAt + ANNOUNCE_COOLDOWN_MS - Date.now();
      if (wait <= 0) flush();
      else timer = setTimeout(flush, wait);
    };

    check(useLiveStore.getState().snapshot);
    const unsubscribe = useLiveStore.subscribe((state, prevState) => {
      if (state.snapshot?.alerts !== prevState.snapshot?.alerts) check(state.snapshot);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {announcement !== null && <p key={announcement.seq}>{announcement.text}</p>}
    </div>
  );
}
