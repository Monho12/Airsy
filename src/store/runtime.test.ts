// Runtime-ийн бүртгэл (§9.3-ын 2-р дүрэм, D73).
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AerisRuntime } from '@/domain/runtime/AerisRuntime';

import { registerRuntime, useRuntime } from './runtime';

const fakeRuntime = (): AerisRuntime => ({
  start: vi.fn(),
  stop: vi.fn(),
  getSnapshot: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  dispatch: vi.fn(async () => ({ ok: true as const })),
});

afterEach(() => registerRuntime(null));

describe('registerRuntime / useRuntime', () => {
  it('бүртгэлгүй үед null; бүртгэхэд тэр runtime (interface-ээр л)', () => {
    const { result } = renderHook(() => useRuntime());
    expect(result.current).toBeNull();
    const runtime = fakeRuntime();
    act(() => registerRuntime(runtime));
    expect(result.current).toBe(runtime);
  });
});
