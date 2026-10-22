// Seed-тэй PRNG (§11.1, D3, D69): ижил seed → яг ижил дараалал.
import { describe, expect, it } from 'vitest';

import { createRng, uniformNoise } from './rng';

const take = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng (mulberry32)', () => {
  it('ижил seed → ижил дараалал; өөр seed → өөр дараалал', () => {
    expect(take(20261019, 50)).toEqual(take(20261019, 50));
    expect(take(20261019, 50)).not.toEqual(take(20261020, 50));
  });

  it('утга [0, 1) мужид', () => {
    for (const value of take(1, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('uniformNoise нь [−a, a] мужид, дундаж ойролцоогоор 0', () => {
    const rng = createRng(7);
    const values = Array.from({ length: 20_000 }, () => uniformNoise(rng, 5));
    expect(Math.max(...values)).toBeLessThanOrEqual(5);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-5);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThan(0.1);
  });
});
