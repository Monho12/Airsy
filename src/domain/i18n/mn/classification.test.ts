// Босгын тайлбарын дугуйлалт (Phase 7d): утга босготой ижил харагдахгүй.
import { describe, expect, it } from 'vitest';

import { classification } from './classification';

const base = {
  metric: 'humidity',
  unit: '%RH',
  decimals: 0,
  side: 'low',
  level: 'warning',
  enter: 30,
  exit: 32,
  heldByHysteresis: false,
} as const;

describe('classification.threshold — дугуйлалт', () => {
  it('29.6 нь «30%» биш «29.6%» — босго (30%)-оос ялгаатай', () => {
    const text = classification.threshold({ ...base, value: 29.6 });
    expect(text).toContain('29.6');
    expect(text).toContain('(30%)');
  });

  it('босгоос хол утга энгийн нарийвчлалаар', () => {
    expect(classification.threshold({ ...base, value: 24 })).toContain(' 24% байна');
  });

  it('hysteresis-ээр барьж буй үед гарах босготой ч ялгаатай', () => {
    const text = classification.threshold({ ...base, value: 31.7, heldByHysteresis: true });
    expect(text).toContain('31.7');
  });
});
