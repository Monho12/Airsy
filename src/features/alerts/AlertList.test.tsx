// Дохионы самбар: шүүлт, хүлээн авах, шийдэгдсэн түүх (UC-9, FR-A2, §4.4, §8.7, D83).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { Alert, LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { registerRuntime } from '@/store/runtime';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { AlertList } from './AlertList';

const text = mn.alerts;
const base = createMockSnapshot();

function alert(id: string, patch: Partial<Alert>): Alert {
  return {
    id,
    key: `test:${id}`,
    type: 'threshold',
    severity: 'warning',
    status: 'active',
    scope: {},
    title: `Дохио ${id}`,
    message: `Мессеж ${id}`,
    raisedAt: base.simTime,
    updatedAt: base.simTime,
    acknowledgedAt: null,
    resolvedAt: null,
    peakValue: null,
    ...patch,
  };
}

const snapshot: LiveSnapshot = {
  ...base,
  alerts: {
    active: [
      alert('a1', { severity: 'critical', scope: { floorId: 'F02', metric: 'co2' } }),
      alert('a2', {
        status: 'acknowledged',
        acknowledgedAt: base.simTime,
        scope: { floorId: 'F04' },
      }),
      alert('a3', { type: 'emergency', severity: 'critical', title: 'Яаралтай' }),
    ],
    recentResolved: [
      alert('r1', { status: 'resolved', resolvedAt: base.simTime + 1000, title: 'Шийдэгдсэн r1' }),
    ],
  },
};

function setup(result: CommandResult = { ok: true }, withRuntime = true) {
  const dispatch = vi.fn<(command: AerisCommand) => Promise<CommandResult>>(async () => result);
  if (withRuntime) {
    const runtime: AerisRuntime = {
      start: vi.fn(),
      stop: vi.fn(),
      getSnapshot: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      dispatch,
    };
    registerRuntime(runtime);
  }
  applySnapshot(snapshot);
  render(<AlertList />);
  return { user: userEvent.setup(), dispatch };
}

const items = () => within(screen.getByRole('list')).getAllByRole('listitem');

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
  useUiStore.setState(initialUiState);
});
afterEach(() => registerRuntime(null));

describe('AlertList', () => {
  it('анхдагч: идэвхтэй ба хүлээн авсан дохио, ноцтой нь эхэнд (тэнцвэл ID-аар)', () => {
    setup();
    expect(items().map((item) => within(item).getByText(/^Дохио|^Яаралтай/).textContent)).toEqual([
      'Дохио a1',
      'Яаралтай',
      'Дохио a2',
    ]);
  });

  it('идэвхтэй дохиог хүлээн авна (alert/acknowledge)', async () => {
    const { user, dispatch } = setup();
    await user.click(screen.getByRole('button', { name: text.acknowledgeLabel('Дохио a1') }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'alert/acknowledge', alertId: 'a1' });
  });

  it('хүлээн авсан ба идэвхтэй emergency дохионд товч байхгүй; emergency-д шалтгаан', () => {
    setup();
    expect(
      screen.queryByRole('button', { name: text.acknowledgeLabel('Дохио a2') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: text.acknowledgeLabel('Яаралтай') }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(text.emergencyAckNote)).toBeInTheDocument();
  });

  it('татгалзсан хүлээн авалтын шалтгааныг харуулна', async () => {
    const { user } = setup({ ok: false, reason: 'Татгалзсан' });
    await user.click(screen.getByRole('button', { name: text.acknowledgeLabel('Дохио a1') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Татгалзсан');
  });

  it('ноцтой байдал ба давхраар шүүнэ; тохирохгүй бол мессеж; цэвэрлэх', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: mn.common.filters.toggle }));
    await user.selectOptions(screen.getByLabelText(text.filter.severity), 'warning');
    expect(items()).toHaveLength(1);
    expect(items()[0]).toHaveTextContent('Дохио a2');
    await user.selectOptions(screen.getByLabelText(text.filter.floor), 'F02');
    expect(screen.getByText(text.filter.noMatch)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: text.filter.reset }));
    expect(items()).toHaveLength(3);
  });

  it('шийдэгдсэн түүх: recentResolved, хүлээн авах товчгүй', async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText(text.filter.status), 'resolved');
    expect(items()).toHaveLength(1);
    expect(items()[0]).toHaveTextContent('Шийдэгдсэн r1');
    expect(items()[0]).toHaveTextContent(text.status.resolved);
    expect(within(items()[0]!).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: text.resolvedTitle })).toBeInTheDocument();
  });

  it('runtime байхгүй бол хүлээн авах товч зурахгүй (§8.7)', () => {
    setup(undefined, false);
    expect(
      screen.queryByRole('button', { name: text.acknowledgeLabel('Дохио a1') }),
    ).not.toBeInTheDocument();
  });
});
