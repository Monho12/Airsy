// Төхөөрөмжийн гар удирдлага ба «Яагаад?» шалгагч (FR-C7, FR-C8, §6.7, §6.8, §8.7, §8.8, D78).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { AerisCommand, AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { ControlDecision, LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { registerRuntime } from '@/store/runtime';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { DeviceList } from './DeviceList';

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

const decision: ControlDecision = {
  deviceId: 'F02-SF',
  evaluatedAt: createMockSnapshot().simTime,
  candidates: [
    {
      ruleId: 'R-BASELINE',
      priority: 100,
      deviceKind: 'supply_fan',
      target: { kind: 'supply_fan', level: 'LOW' },
      role: 'demand',
      reason: 'суурь',
    },
    {
      ruleId: 'R-IAQ-WARNING',
      priority: 500,
      deviceKind: 'supply_fan',
      target: { kind: 'supply_fan', level: 'HIGH' },
      role: 'demand',
      reason: 'CO₂',
    },
  ],
  winningRuleId: 'R-IAQ-WARNING',
  contributingRuleIds: [],
  requestedState: { kind: 'supply_fan', level: 'HIGH' },
  constrainedState: { kind: 'supply_fan', level: 'HIGH' },
  constraintsApplied: [],
  minimumApplied: null,
  outcome: 'applied',
  reason: '2-р давхар: CO₂ 1,180 ppm — анхааруулга (≥ 1,000 ppm).',
};

function setup(mutate: (snapshot: LiveSnapshot) => LiveSnapshot = (s) => s) {
  const base = createMockSnapshot();
  applySnapshot(mutate({ ...base, decisions: { 'F02-SF': decision } }));
  useUiStore.getState().selectFloor('F02');
  render(<DeviceList />);
  return userEvent.setup();
}

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
  useUiStore.setState(initialUiState);
});
afterEach(() => registerRuntime(null));

describe('DeviceList — гар удирдлага', () => {
  it('dropdown-оор өөр төлөв сонгоход device/setManual илгээнэ', async () => {
    const { runtime, dispatch } = fakeRuntime();
    registerRuntime(runtime);
    const user = setup();
    const select = screen.getByRole('combobox', {
      name: mn.devices.manualSelectLabel(mn.devices.deviceName('supply_fan', 'F02')),
    });
    expect(within(select).getAllByRole('option')).toHaveLength(5);
    await user.selectOptions(select, 'BOOST');
    expect(dispatch).toHaveBeenCalledWith({
      type: 'device/setManual',
      deviceId: 'F02-SF',
      state: { kind: 'supply_fan', level: 'BOOST' },
    });
  });

  it('гар горимд ГАР тэмдэг, хугацаа ба «Автомат руу буцаах» (зөвхөн тэр төхөөрөмжид)', async () => {
    const { runtime, dispatch } = fakeRuntime();
    registerRuntime(runtime);
    const user = setup((s) => {
      const device = s.devices['F02-EF']!;
      return {
        ...s,
        devices: {
          ...s.devices,
          'F02-EF': {
            ...device,
            mode: 'manual',
            manualOverride: {
              state: device.state,
              setAt: s.simTime,
              expiresAt: s.simTime + 600_000,
            },
          },
        },
      };
    });
    expect(screen.getByText(mn.devices.modeBadge.manual)).toBeVisible();
    const buttons = screen.getAllByRole('button', { name: mn.devices.returnToAuto });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]!);
    expect(dispatch).toHaveBeenCalledWith({ type: 'device/returnToAuto', deviceId: 'F02-EF' });
  });

  it('татгалзвал Монгол шалтгааныг role=alert-аар харуулна', async () => {
    const { runtime } = fakeRuntime({ ok: false, reason: mn.control.manualBlockedByEmergency });
    registerRuntime(runtime);
    const user = setup();
    const select = screen.getAllByRole('combobox')[0]!;
    await user.selectOptions(select, 'HIGH');
    expect(await screen.findByRole('alert')).toHaveTextContent(mn.control.manualBlockedByEmergency);
  });

  it('яаралтай горимд dropdown идэвхгүй ба тайлбартай', () => {
    registerRuntime(fakeRuntime().runtime);
    setup((s) => ({
      ...s,
      devices: { ...s.devices, 'F02-SF': { ...s.devices['F02-SF']!, mode: 'emergency' } },
    }));
    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(screen.getByText(mn.devices.emergencyLockNote)).toBeVisible();
  });
});

describe('DeviceList — «Яагаад?» шалгагч (FR-C8)', () => {
  it('товч aria-expanded-ийг сэлгэж, мөрийн доор Монгол тайлбар задарна', async () => {
    registerRuntime(fakeRuntime().runtime);
    const user = setup();
    const why = screen.getByRole('button', {
      name: mn.devices.whyLabel(mn.devices.deviceName('supply_fan', 'F02')),
    });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(why.getAttribute('aria-controls')!)!;
    expect(panel).toHaveTextContent(mn.control.outcome.applied);
    expect(panel).toHaveTextContent(mn.control.ruleName['R-IAQ-WARNING']);
    expect(panel).toHaveTextContent(decision.reason);
    expect(within(panel).getAllByRole('listitem')).toHaveLength(2);
    expect(panel).not.toHaveTextContent('R-IAQ-WARNING'); // дотоод ID UI-д түүхий хэлбэрээр харагдахгүй (§8.9)
    await user.click(why);
    expect(document.getElementById(why.getAttribute('aria-controls')!)).toBeNull();
  });

  it('шийдвэргүй үед тодорхой хоосон мессеж', async () => {
    registerRuntime(fakeRuntime().runtime);
    const user = setup();
    await user.click(
      screen.getByRole('button', {
        name: mn.devices.whyLabel(mn.devices.deviceName('exhaust_fan', 'F02')),
      }),
    );
    expect(screen.getByText(mn.devices.inspector.noDecision)).toBeVisible();
  });
});
