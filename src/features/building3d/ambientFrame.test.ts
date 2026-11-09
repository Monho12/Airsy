// Орчны анимацийн frame-ийн хязгаар (D104): хүсэлт хэчнээн олон ч ~30 fps-ээс давж зурахгүй.
import { describe, expect, it, vi } from 'vitest';

import { acquireAmbientScheduler, AMBIENT_FRAME_MS, createAmbientScheduler } from './ambientFrame';

describe('createAmbientScheduler', () => {
  it('frame бүрт хүссэн ч 1 секундэд ≤ 1000 / AMBIENT_FRAME_MS удаа зурна', () => {
    vi.useFakeTimers();
    const invalidate = vi.fn();
    const scheduler = createAmbientScheduler(invalidate, AMBIENT_FRAME_MS, () => Date.now());
    // 144 Hz-ийн дэлгэц: ~7 ms тутам хүсэлт
    for (let t = 0; t < 1000; t += 7) {
      scheduler.request();
      vi.advanceTimersByTime(7);
    }
    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / AMBIENT_FRAME_MS));
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(25);
    vi.useRealTimers();
  });

  it('cancel хүлээгдэж буй frame-ийг цуцална', () => {
    vi.useFakeTimers();
    const invalidate = vi.fn();
    const scheduler = createAmbientScheduler(invalidate);
    scheduler.request();
    scheduler.cancel();
    vi.advanceTimersByTime(100);
    expect(invalidate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('нэг canvas-ийн хэрэглэгчид нэг scheduler-ийг хуваалцаж, сүүлийнх нь чөлөөлөхөд цуцлагдана', () => {
    vi.useFakeTimers();
    const invalidate = vi.fn();
    const [a, releaseA] = acquireAmbientScheduler(invalidate);
    const [b, releaseB] = acquireAmbientScheduler(invalidate);
    expect(a).toBe(b);
    a.request();
    b.request();
    vi.advanceTimersByTime(AMBIENT_FRAME_MS);
    expect(invalidate).toHaveBeenCalledTimes(1);
    releaseA();
    b.request();
    releaseB();
    vi.advanceTimersByTime(100);
    expect(invalidate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
