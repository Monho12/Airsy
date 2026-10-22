// Seed-тэй санамсаргүй тоо (CLAUDE.md §11.1, D3, D69) — mulberry32. Ижил seed → яг ижил дараалал.
// Domain-д `Math.random()` хориотой (§9.3-ын 3-р дүрэм); бүх санамсаргүй байдал эндээс.

export interface Rng {
  /** [0, 1) мужийн дараагийн тоо */
  next(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** [−amplitude, +amplitude] мужийн жигд тархалттай тоо (D69) */
export function uniformNoise(rng: Rng, amplitude: number): number {
  return (rng.next() * 2 - 1) * amplitude;
}
