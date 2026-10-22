// Төлөвийн мөр ба симуляцийн удирдлага (FR-S1, §8.2, §8.5, §8.7, §9.4, D74).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { registerRuntime } from '@/store/runtime';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { StatusBar } from './StatusBar';

const text = mn.common.simulation;

function fakeRuntime(result: CommandResult = { ok: true }) {
  const dispatch = vi.fn<(command: AerisCommand) => Promise<CommandResult>>(async () => result);
  const runtime: AerisRuntime = {
    start: vi.fn(),
    stop: vi.fn(),
    getSnapshot: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    dispatch,
  };
  return { runtime, dispatch };
}

const snapshotWith = (simulation: Partial<LiveSnapshot['simulation']>): LiveSnapshot => {
  const base = createMockSnapshot();
  return { ...base, simulation: { ...base.simulation, ...simulation } };
};

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
  useUiStore.setState(initialUiState);
});

afterEach(() => registerRuntime(null));

describe('StatusBar — симуляцийн удирдлага', () => {
  it('runtime бүртгэгдээгүй бол удирдлага огт байхгүй (§8.7)', () => {
    applySnapshot(snapshotWith({ running: true }));
    render(<StatusBar />);
    expect(screen.queryByRole('group', { name: text.controlsLabel })).toBeNull();
    expect(screen.getByText(mn.control.autoModeLabel)).toBeInTheDocument();
  });

  it('ажиллаж байхад: «Түр зогсоох» товч, ШУУД тэмдэг лугшилттай; товч дарахад pause илгээнэ', async () => {
    const { runtime, dispatch } = fakeRuntime();
    registerRuntime(runtime);
    applySnapshot(snapshotWith({ running: true, speed: 1 }));
    render(<StatusBar />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(text.live);
    expect(status).toHaveClass('sim-live--pulse');

    await userEvent.click(screen.getByRole('button', { name: text.pause }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'simulation/pause' });
  });

  it('түр зогссон үед: «Үргэлжлүүлэх» товч, ТҮР ЗОГССОН тэмдэг лугшилтгүй; play илгээнэ', async () => {
    const { runtime, dispatch } = fakeRuntime();
    registerRuntime(runtime);
    applySnapshot(snapshotWith({ running: false }));
    render(<StatusBar />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(text.paused);
    expect(status).not.toHaveClass('sim-live--pulse');

    await userEvent.click(screen.getByRole('button', { name: text.play }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'simulation/play' });
  });

  it('хөдөлгөөн багасгах үед ШУУД лугшихгүй (§8.5)', () => {
    registerRuntime(fakeRuntime().runtime);
    useUiStore.setState({ reducedMotion: true });
    applySnapshot(snapshotWith({ running: true }));
    render(<StatusBar />);
    expect(screen.getByRole('status')).toHaveTextContent(text.live);
    expect(screen.getByRole('status')).not.toHaveClass('sim-live--pulse');
  });

  it('хурдны dropdown (§8.2 `1× ▾`): 1×, 2×, 5×, 10×; сонгоход setSpeed илгээнэ', async () => {
    const { runtime, dispatch } = fakeRuntime();
    registerRuntime(runtime);
    applySnapshot(snapshotWith({ running: true, speed: 1 }));
    render(<StatusBar />);

    const select = screen.getByRole('combobox', { name: text.speed });
    expect(select).toHaveValue('1');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      '1×',
      '2×',
      '5×',
      '10×',
    ]);
    await userEvent.selectOptions(select, '5');
    expect(dispatch).toHaveBeenCalledWith({ type: 'simulation/setSpeed', speed: 5 });
  });

  it('snapshot-ийн хурд өөрчлөгдөхөд dropdown дагана (шинэ төлөв subscribe-аар ирнэ)', () => {
    registerRuntime(fakeRuntime().runtime);
    applySnapshot(snapshotWith({ running: true, speed: 1 }));
    render(<StatusBar />);
    act(() => applySnapshot(snapshotWith({ running: true, speed: 10 })));
    expect(screen.getByRole('combobox', { name: text.speed })).toHaveValue('10');
  });

  it('татгалзсан командын Монгол шалтгааныг харуулна (§9.4)', async () => {
    const reason = mn.common.runtime.notRunning;
    registerRuntime(fakeRuntime({ ok: false, reason }).runtime);
    applySnapshot(snapshotWith({ running: true }));
    render(<StatusBar />);
    await userEvent.click(screen.getByRole('button', { name: text.pause }));
    expect(await screen.findByRole('alert')).toHaveTextContent(reason);
  });
});
