// Үйл явдлын хязгаартай бүртгэл (CLAUDE.md §10, §11.4, FR-A3, FR-A4). Зөвхөн нэмэгдэнэ; хязгаараас хэтэрвэл хамгийн
// хуучныг хаяна. `seq` үргэлж өснө — ID давхцахгүй.
import { bufferLimits } from '@/domain/config/simulation';
import type { SystemEvent } from '@/domain/types';

export type SystemEventDraft = Omit<SystemEvent, 'id' | 'seq'>;

export interface EventLog {
  /** Хуучнаас шинэ рүү (шинэ нь сүүлд) */
  events: SystemEvent[];
  nextSeq: number;
}

export const createEventLog = (): EventLog => ({ events: [], nextSeq: 1 });

const eventIdOf = (seq: number) => `E-${String(seq).padStart(6, '0')}`;

/** Ноорогт `id`, `seq` оноож нэмнэ. Ноорог хоосон бол ижил лавлагаа буцаана (structural sharing). */
export function appendEvents(
  log: EventLog,
  drafts: readonly SystemEventDraft[],
  limit: number = bufferLimits.events,
): EventLog {
  if (drafts.length === 0) return log;
  let seq = log.nextSeq;
  const added = drafts.map((draft): SystemEvent => {
    const event = { id: eventIdOf(seq), seq, ...draft };
    seq += 1;
    return event;
  });
  return { events: [...log.events, ...added].slice(-limit), nextSeq: seq };
}
