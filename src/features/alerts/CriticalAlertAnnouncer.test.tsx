// Шинэ ноцтой дохионы дэлгэц уншигчийн мэдэгдэл (FR-A5, §8.8).
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { Alert, LiveSnapshot } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';

import { CriticalAlertAnnouncer } from './CriticalAlertAnnouncer';
import { ANNOUNCE_COOLDOWN_MS, newlyCriticalAlerts } from './criticalAnnouncement';

const base = createMockSnapshot();

function alert(id: string, patch: Partial<Alert> = {}): Alert {
  return {
    id,
    key: `test:${id}`,
    type: 'threshold',
    severity: 'critical',
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

function withAlerts(active: Alert[]): LiveSnapshot {
  return { ...base, alerts: { active, recentResolved: [] } };
}

function publish(active: Alert[]) {
  act(() => applySnapshot(withAlerts(active)));
}

const region = () => screen.getByRole('status');

describe('newlyCriticalAlerts', () => {
  it('зөвхөн өмнө нь ноцтой байгаагүй ноцтой дохиог буцаана', () => {
    const list = [alert('a'), alert('b'), alert('c', { severity: 'warning' })];
    expect(newlyCriticalAlerts(list, new Set(['a'])).map((x) => x.id)).toEqual(['b']);
  });
});

describe('CriticalAlertAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLiveStore.setState(initialLiveState, true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('polite live бүс үргэлж байх ба эхэндээ хоосон', () => {
    publish([]);
    render(<CriticalAlertAnnouncer />);
    expect(region()).toHaveAttribute('aria-live', 'polite');
    expect(region()).toBeEmptyDOMElement();
  });

  it('шинэ ноцтой дохиог мэдэгдэж, анхааруулгыг мэдэгдэхгүй', () => {
    publish([]);
    render(<CriticalAlertAnnouncer />);
    publish([alert('w', { severity: 'warning' })]);
    expect(region()).toBeEmptyDOMElement();
    publish([alert('w', { severity: 'warning' }), alert('c')]);
    expect(region()).toHaveTextContent(mn.alerts.criticalAnnouncement(['Дохио c']));
  });

  it('анхааруулгаас ноцтой болж хүндэрсэн дохиог мэдэгдэнэ', () => {
    publish([alert('x', { severity: 'warning' })]);
    render(<CriticalAlertAnnouncer />);
    publish([alert('x')]);
    expect(region()).toHaveTextContent('Дохио x');
  });

  it('ижил дохиог дахин мэдэгдэхгүй; cooldown-ийн дотор гарсныг нэгтгэнэ', () => {
    publish([]);
    render(<CriticalAlertAnnouncer />);
    publish([alert('a')]);
    expect(region()).toHaveTextContent(mn.alerts.criticalAnnouncement(['Дохио a']));
    publish([alert('a')]);
    publish([alert('a'), alert('b')]);
    publish([alert('a'), alert('b'), alert('c')]);
    // Cooldown дуусаагүй — хуучин мэдэгдэл хэвээр
    expect(region()).toHaveTextContent(mn.alerts.criticalAnnouncement(['Дохио a']));
    act(() => vi.advanceTimersByTime(ANNOUNCE_COOLDOWN_MS));
    expect(region()).toHaveTextContent(mn.alerts.criticalAnnouncement(['Дохио b', 'Дохио c']));
  });

  it('хүлээх хугацаанд шийдэгдсэн дохиог мэдэгдэхгүй', () => {
    publish([]);
    render(<CriticalAlertAnnouncer />);
    publish([alert('a')]);
    publish([alert('a'), alert('b')]);
    publish([alert('a')]);
    act(() => vi.advanceTimersByTime(ANNOUNCE_COOLDOWN_MS));
    expect(region()).toHaveTextContent(mn.alerts.criticalAnnouncement(['Дохио a']));
  });
});
