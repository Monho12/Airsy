// Үйл явдлын хязгаартай бүртгэл (§10, §11.4, FR-A4).
import { describe, expect, it } from 'vitest';

import { bufferLimits } from '@/domain/config/simulation';

import { appendEvents, createEventLog, type SystemEventDraft } from './eventLog';

const draft = (timestamp: number): SystemEventDraft => ({
  timestamp,
  type: 'SIMULATION_STARTED',
  category: 'simulation',
  severity: 'info',
  message: 'x',
  actor: 'system',
});

describe('appendEvents', () => {
  it('seq үргэлж өсч, ID давхцахгүй', () => {
    let log = createEventLog();
    log = appendEvents(log, [draft(1), draft(2)]);
    log = appendEvents(log, [draft(3)]);
    expect(log.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(new Set(log.events.map((e) => e.id)).size).toBe(3);
    expect(log.nextSeq).toBe(4);
  });

  it(`хязгаар (${bufferLimits.events}) хэтрэхэд хамгийн хуучныг хаяна; seq дахин эхлэхгүй`, () => {
    let log = createEventLog();
    for (let i = 0; i < bufferLimits.events + 25; i += 1) log = appendEvents(log, [draft(i)]);
    expect(log.events).toHaveLength(bufferLimits.events);
    expect(log.events[0]!.seq).toBe(26);
    expect(log.events.at(-1)!.seq).toBe(bufferLimits.events + 25);
  });

  it('ноорог хоосон бол ижил лавлагаа (structural sharing)', () => {
    const log = appendEvents(createEventLog(), [draft(1)]);
    expect(appendEvents(log, [])).toBe(log);
  });
});
