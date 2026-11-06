// Сценарийн самбар, баталгаажуулах dialog ба яаралтай мөр (UC-7, UC-10, FR-S3, FR-S4, §6.9, §7.1, §7.4, §8.7, §8.8).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { registerRuntime } from '@/store/runtime';

import { EmergencyBar } from './EmergencyBar';
import { ScenarioPanel } from './ScenarioPanel';

const text = mn.scenarios;

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

function withActive(snapshot: LiveSnapshot, progress = 0.42): LiveSnapshot {
  return {
    ...snapshot,
    simulation: {
      ...snapshot.simulation,
      activeScenario: { id: 'high-co2', targetAreaId: null, startedAt: snapshot.simTime, progress },
    },
  };
}

function withEmergency(snapshot: LiveSnapshot): LiveSnapshot {
  return {
    ...withActive(snapshot),
    simulation: {
      ...snapshot.simulation,
      activeScenario: {
        id: 'fire-emergency',
        targetAreaId: null,
        startedAt: snapshot.simTime,
        progress: 0.9,
      },
    },
    control: {
      ...snapshot.control,
      emergency: { fireFloorId: 'F08', startedAt: snapshot.simTime },
    },
  };
}

function setup(
  mutate: (snapshot: LiveSnapshot) => LiveSnapshot = (s) => s,
  result?: CommandResult,
) {
  const { runtime, dispatch } = fakeRuntime(result);
  registerRuntime(runtime);
  applySnapshot(mutate(createMockSnapshot()));
  render(
    <>
      <EmergencyBar />
      <ScenarioPanel />
    </>,
  );
  return { user: userEvent.setup(), dispatch };
}

const startButton = (id: keyof typeof text.name) =>
  screen.getByRole('button', { name: text.panel.startLabel(text.name[id]) });

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
});

afterEach(() => {
  registerRuntime(null);
});

describe('ScenarioPanel', () => {
  it('8 сценарийг §7.2-ын дарааллаар, идэвхтэй сценаригүй мессежтэй зурна', () => {
    setup();
    const list = screen.getByRole('list', { name: text.panel.listLabel });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent(text.name['normal-operation']);
    expect(items[7]).toHaveTextContent(text.name.recovery);
    expect(screen.getByText(text.panel.noActive)).toBeInTheDocument();
  });

  it('идэвхтэй сценари байхгүй үед энгийн сценари шууд эхэлнэ (dialog-гүй)', async () => {
    const { user, dispatch } = setup();
    await user.click(startButton('high-co2'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'scenario/start', scenarioId: 'high-co2' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('S6 эхлүүлэхэд анхааруулгатай dialog; Болих → команд илгээхгүй, focus буцна', async () => {
    const { user, dispatch } = setup();
    const button = startButton('fire-emergency');
    await user.click(button);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent(text.emergencyDisclaimer);
    // Анхдагч focus — «Болих» (аюулгүй сонголт)
    expect(within(dialog).getByRole('button', { name: text.confirm.cancel })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: text.confirm.cancel }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
    expect(button).toHaveFocus();
  });

  it('S6-г баталгаажуулбал scenario/start илгээнэ', async () => {
    const { user, dispatch } = setup();
    await user.click(startButton('fire-emergency'));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: text.confirm.confirmStart }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'scenario/start', scenarioId: 'fire-emergency' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dialog: Escape-ээр хаагдана, Tab нь dialog дотор эргэлдэнэ (§8.8)', async () => {
    const { user, dispatch } = setup();
    await user.click(startButton('fire-emergency'));
    const dialog = screen.getByRole('dialog');
    const cancel = within(dialog).getByRole('button', { name: text.confirm.cancel });
    const confirm = within(dialog).getByRole('button', { name: text.confirm.confirmStart });
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('өөр сценари идэвхтэй үед явц харагдаж, шинэ сценари эхлүүлэхэд баталгаажуулалт асууна', async () => {
    const { user, dispatch } = setup((s) => withActive(s));
    const progress = screen.getByRole('progressbar', {
      name: text.panel.progressLabel(text.name['high-co2']),
    });
    expect(progress).toHaveAttribute('aria-valuenow', '42');
    await user.click(startButton('voc-cleaning'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(text.confirm.switchBody(text.name['high-co2']));
    expect(dialog).toHaveTextContent(text.confirm.softResetNote);
    await user.click(within(dialog).getByRole('button', { name: text.confirm.confirmStart }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'scenario/start', scenarioId: 'voc-cleaning' });
  });

  it('Сэргэлтэд зөөлөн шинэчлэлийн тайлбар гарахгүй (одоогийн төлөвөөс эхэлнэ)', async () => {
    const { user } = setup((s) => withActive(s));
    await user.click(startButton('recovery'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveTextContent(text.confirm.softResetNote);
  });

  it('«Зогсоох» scenario/stop илгээнэ', async () => {
    const { user, dispatch } = setup((s) => withActive(s));
    await user.click(
      screen.getByRole('button', { name: text.panel.stopLabel(text.name['high-co2']) }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: 'scenario/stop' });
  });

  it('«Симуляцийг эхнээс нь» үргэлж баталгаажуулалттай', async () => {
    const { user, dispatch } = setup();
    await user.click(screen.getByRole('button', { name: text.panel.reset }));
    const dialog = screen.getByRole('dialog', { name: text.confirm.resetTitle });
    expect(dispatch).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: text.confirm.confirmReset }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'simulation/reset' });
  });

  it('татгалзсан командын Монгол шалтгааныг харуулна', async () => {
    const { user } = setup(undefined, { ok: false, reason: 'Шалтгаан' });
    await user.click(startButton('high-co2'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Шалтгаан');
  });

  it('runtime байхгүй бол удирдлага огт зурагдахгүй (§8.7)', () => {
    applySnapshot(createMockSnapshot());
    render(<ScenarioPanel />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
  });

  it('эхний snapshot-оос өмнө ачаалж буй төлөв', () => {
    render(<ScenarioPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(mn.common.loading);
  });
});

describe('Яаралтай байдал (§6.9, §7.4 A, B)', () => {
  it('яаралтай байдалгүй үед мөр зурагдахгүй', () => {
    setup();
    expect(screen.queryByText(text.emergencyBar.title)).not.toBeInTheDocument();
  });

  it('мөр анхааруулга, галын давхартай; «Яаралтай симуляцийг дуусгах» emergency/end илгээнэ', async () => {
    const { user, dispatch } = setup(withEmergency);
    const bar = screen.getByRole('alert');
    expect(bar).toHaveTextContent(text.emergencyBar.title);
    expect(bar).toHaveTextContent(text.emergencyDisclaimer);
    expect(bar).toHaveTextContent(text.emergencyBar.fireFloor(floorLabelMn(8)));
    expect(bar).toHaveTextContent(text.emergencyBar.visualNote);
    await user.click(within(bar).getByRole('button', { name: text.emergencyBar.end }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'emergency/end' });
  });

  it('яаралтай үед Сэргэлт тайлбартайгаар идэвхгүй', () => {
    setup(withEmergency);
    const recovery = startButton('recovery');
    expect(recovery).toBeDisabled();
    expect(recovery).toHaveAccessibleDescription(text.panel.recoveryBlocked);
  });

  it('яаралтай үед өөр сценари эхлүүлэхэд яаралтай байдал дуусахыг анхааруулна (§7.4 B)', async () => {
    const { user } = setup(withEmergency);
    await user.click(startButton('high-co2'));
    expect(screen.getByRole('dialog')).toHaveTextContent(text.confirm.emergencySwitchBody);
  });
});
