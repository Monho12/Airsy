import { describe, expect, it } from 'vitest';

import { niceTicks } from './niceTicks';

describe('niceTicks (D102)', () => {
  it('CO₂-ийн муж — 100-ын алхамтай дугуй тоо', () => {
    expect(niceTicks(677, 1024)).toEqual([700, 800, 900, 1000]);
  });
  it('температур — аравтын алхам, мужаас гарахгүй', () => {
    const ticks = niceTicks(21.8, 23.4);
    expect(ticks).toEqual([22, 22.5, 23]);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(21.8);
  });
  it('хоосон муж', () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});
