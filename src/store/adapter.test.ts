import { beforeEach, describe, expect, it } from 'vitest';

import type { LiveSnapshot } from '@/domain/types';

import { applySnapshot } from './adapter';
import { initialLiveState, useLiveStore } from './liveStore';
import { createMockSnapshot } from './mockSnapshot';

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
});

describe('liveStore + applySnapshot (D53, §9.3-ын 6-р дүрэм)', () => {
  it('эхний snapshot ирэхээс өмнө null (§8.7 — ачаалж байна)', () => {
    expect(useLiveStore.getState().snapshot).toBeNull();
  });

  it('applySnapshot нь snapshot-ийг бүхэлд нь тавина (ижил лавлагаа)', () => {
    const snapshot = createMockSnapshot();
    applySnapshot(snapshot);
    expect(useLiveStore.getState().snapshot).toBe(snapshot);
  });

  it('publish бүрт сүүлийнх нь үлдэнэ', () => {
    const first = createMockSnapshot();
    const second = { ...createMockSnapshot(), simTime: first.simTime + 1000 };
    applySnapshot(first);
    applySnapshot(second);
    expect(useLiveStore.getState().snapshot).toBe(second);
  });

  it('дэмжигдээгүй schemaVersion-ийг татгалзана', () => {
    const bad = { ...createMockSnapshot(), schemaVersion: 2 } as unknown as LiveSnapshot;
    expect(() => applySnapshot(bad)).toThrow();
    expect(useLiveStore.getState().snapshot).toBeNull();
  });
});
