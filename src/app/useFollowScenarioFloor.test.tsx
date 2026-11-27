// Сценари эхлэхэд гол давхар сонгогдоно (D100); дараа нь операторын сонголтыг давж бичихгүй.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { useFollowScenarioFloor } from './useFollowScenarioFloor';

const base = createMockSnapshot();
const running = (id: 'high-co2' | 'normal-operation', startedAt: number): LiveSnapshot => ({
  ...base,
  simulation: {
    ...base.simulation,
    activeScenario: { id, targetAreaId: null, startedAt, progress: 0 },
  },
});

beforeEach(() => {
  useLiveStore.setState(initialLiveState, true);
  useUiStore.setState(initialUiState);
  applySnapshot(base);
});

describe('useFollowScenarioFloor', () => {
  it('шинэ сценари эхлэхэд гол давхрыг нэг удаа сонгоно', () => {
    renderHook(() => useFollowScenarioFloor());
    useUiStore.getState().selectFloor('F12');
    act(() => applySnapshot(running('high-co2', base.simTime)));
    expect(useUiStore.getState().selectedFloorId).toBe('F02');
    // Оператор өөр давхар сонгосны дараах snapshot сонголтыг өөрчлөхгүй
    act(() => useUiStore.getState().selectFloor('F09'));
    act(() =>
      applySnapshot({ ...running('high-co2', base.simTime), simTime: base.simTime + 1000 }),
    );
    expect(useUiStore.getState().selectedFloorId).toBe('F09');
  });

  it('барилгын хэмжээний сценари (S1) сонголтыг өөрчлөхгүй', () => {
    renderHook(() => useFollowScenarioFloor());
    useUiStore.getState().selectFloor('F05');
    act(() => applySnapshot(running('normal-operation', base.simTime)));
    expect(useUiStore.getState().selectedFloorId).toBe('F05');
  });
});
