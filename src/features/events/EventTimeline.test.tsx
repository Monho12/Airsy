// Үйл явдлын түүх: шүүлт ба хуудаслалт (UC-9, FR-A3, §11.4, D83).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { mn } from '@/domain/i18n/mn';
import type { LiveSnapshot, SystemEvent } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { RECENT_EVENT_LIMIT } from '@/store/selectors';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { EventTimeline } from './EventTimeline';

const text = mn.events;
const base = createMockSnapshot();

function events(count: number): SystemEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    seq: i,
    timestamp: base.simTime + i * 1000,
    type: i % 2 === 0 ? 'DEVICE_STATE_CHANGED' : 'ALERT_RAISED',
    category: i % 2 === 0 ? 'control' : 'alert',
    severity: i % 2 === 0 ? 'info' : 'warning',
    message: `Үйл явдал ${i}`,
    floorId: i % 4 === 1 ? 'F02' : 'F07',
    actor: 'system',
  }));
}

function setup(count: number) {
  const snapshot: LiveSnapshot = { ...base, events: events(count) };
  applySnapshot(snapshot);
  render(<EventTimeline />);
  return userEvent.setup();
}

const rows = () => within(screen.getByRole('list')).getAllByRole('listitem');

beforeEach(() => {
  useLiveStore.setState(initialLiveState);
  useUiStore.setState(initialUiState);
});

describe('EventTimeline', () => {
  it('эхний хуудас (50), шинэ нь эхэнд; «Цааш харуулах» дараагийн 50-ийг нэмнэ', async () => {
    const user = setup(120);
    expect(rows()).toHaveLength(RECENT_EVENT_LIMIT);
    expect(rows()[0]).toHaveTextContent('Үйл явдал 119');
    expect(screen.getByText(text.shown(50, 120))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: text.showMore }));
    expect(rows()).toHaveLength(100);
    await user.click(screen.getByRole('button', { name: text.showMore }));
    expect(rows()).toHaveLength(120);
    expect(screen.queryByRole('button', { name: text.showMore })).not.toBeInTheDocument();
  });

  it('ангилал ба давхраар шүүнэ; шүүлт өөрчлөгдөхөд эхний хуудас руу буцна', async () => {
    const user = setup(120);
    await user.click(screen.getByRole('button', { name: text.showMore }));
    await user.selectOptions(screen.getByLabelText(text.filter.category), 'alert');
    expect(rows()).toHaveLength(RECENT_EVENT_LIMIT);
    expect(screen.getByText(text.shown(50, 60))).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(text.filter.floor), 'F02');
    // i % 4 === 1 → бүгд alert; 120-д 30 ширхэг
    expect(rows()).toHaveLength(30);
    expect(rows()[0]).toHaveTextContent('Үйл явдал 117');
  });

  it('тохирох үйл явдал алга бол мессеж, цэвэрлэх товч', async () => {
    const user = setup(4);
    await user.selectOptions(screen.getByLabelText(text.filter.severity), 'critical');
    expect(screen.getByText(text.filter.noMatch)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: text.filter.reset }));
    expect(rows()).toHaveLength(4);
  });
});
