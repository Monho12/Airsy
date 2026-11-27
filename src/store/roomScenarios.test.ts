// Өрөөний сценари эхлүүлэх нийтлэг зам (D99): баталгаажуулалт хэрэгтэй үед dialog-ийн төлөв, эс бөгөөс шууд команд.
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AerisCommand, AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { LiveSnapshot } from '@/domain/types';

import { createMockSnapshot } from './mockSnapshot';
import { requestRoomScenario, roomScenarioNeedsConfirm } from './roomScenarios';
import { initialUiState, useUiStore } from './uiStore';

function fakeRuntime() {
  const dispatch = vi.fn<(command: AerisCommand) => Promise<CommandResult>>(async () => ({
    ok: true,
  }));
  const runtime: AerisRuntime = {
    start: vi.fn(),
    stop: vi.fn(),
    getSnapshot: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    dispatch,
  };
  return { runtime, dispatch };
}

const base = createMockSnapshot();
const withActive: LiveSnapshot = {
  ...base,
  simulation: {
    ...base.simulation,
    activeScenario: { id: 'high-co2', targetAreaId: null, startedAt: base.simTime, progress: 0.2 },
  },
};

afterEach(() => useUiStore.setState(initialUiState));

describe('requestRoomScenario', () => {
  it('идэвхтэй сценаригүй үед шууд scenario/startRoom илгээнэ', async () => {
    const { runtime, dispatch } = fakeRuntime();
    expect(roomScenarioNeedsConfirm(base)).toBe(false);
    await expect(
      requestRoomScenario(runtime, base, 'room-kitchen-cooking', 'F07-H'),
    ).resolves.toEqual({
      ok: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'scenario/startRoom',
      scenarioId: 'room-kitchen-cooking',
      areaId: 'F07-H',
    });
    expect(useUiStore.getState().pendingRoomScenario).toBeNull();
  });

  it('өөр сценари идэвхтэй бол команд илгээхгүй, баталгаажуулалтын төлөв тавина', async () => {
    const { runtime, dispatch } = fakeRuntime();
    await expect(
      requestRoomScenario(runtime, withActive, 'room-restroom-humidity', 'F12-G'),
    ).resolves.toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    expect(useUiStore.getState().pendingRoomScenario).toEqual({
      scenarioId: 'room-restroom-humidity',
      areaId: 'F12-G',
    });
  });

  it('яаралтай байдал идэвхтэй бол баталгаажуулалт шаардлагатай', () => {
    const emergency: LiveSnapshot = {
      ...base,
      control: { ...base.control, emergency: { fireFloorId: 'F08', startedAt: base.simTime } },
    };
    expect(roomScenarioNeedsConfirm(emergency)).toBe(true);
  });
});
