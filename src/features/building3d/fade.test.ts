// Зөөлөн шилжилтийн алхам (D94)
import { describe, expect, it } from 'vitest';

import { FADE_EPSILON, fadeStep } from './fade';

describe('fadeStep', () => {
  it('зорилт руу монотон ойртож, ~0.3 с-д (60 fps) яг зорилтод хүрнэ', () => {
    let value = 0.04;
    let frames = 0;
    let done = false;
    while (!done && frames < 200) {
      const previous = value;
      ({ value, done } = fadeStep(value, 1, 1 / 60));
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      frames += 1;
    }
    expect(done).toBe(true);
    expect(value).toBe(1);
    expect(frames).toBeGreaterThan(5); // нэг кадрт үсрэхгүй
    expect(frames).toBeLessThan(40); // ≈ 0.5 с-ээс бага
  });

  it('сул зогсолтын дараах том delta нэг кадрт үсрүүлэхгүй', () => {
    const { value, done } = fadeStep(0, 1, 5);
    expect(done).toBe(false);
    expect(value).toBeLessThan(0.5);
  });

  it('зорилтод аль хэдийн ойр бол шууд done', () => {
    expect(fadeStep(1 - FADE_EPSILON / 2, 1, 1 / 60)).toEqual({ value: 1, done: true });
  });
});
