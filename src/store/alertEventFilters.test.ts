// Дохио ба үйл явдлын шүүлтийн selector ба uiStore-ийн шүүлтийн төлөв (FR-A2, FR-A3, Phase 6d, D83).
import { beforeEach, describe, expect, it } from 'vitest';

import type { Alert, LiveSnapshot, SystemEvent } from '@/domain/types';

import { createMockSnapshot } from './mockSnapshot';
import { selectAlertCounts, selectFilteredAlerts, selectFilteredEvents } from './selectors';
import {
  defaultAlertFilter,
  defaultEventFilter,
  initialUiState,
  useUiStore,
  type AlertFilter,
} from './uiStore';

const base = createMockSnapshot();

function alert(id: string, patch: Partial<Alert>): Alert {
  return {
    id,
    key: `test:${id}`,
    type: 'threshold',
    severity: 'warning',
    status: 'active',
    scope: {},
    title: id,
    message: id,
    raisedAt: base.simTime,
    updatedAt: base.simTime,
    acknowledgedAt: null,
    resolvedAt: null,
    peakValue: null,
    ...patch,
  };
}

const active = [
  alert('a1', { severity: 'critical', scope: { floorId: 'F02', metric: 'co2' } }),
  alert('a2', { status: 'acknowledged', scope: { floorId: 'F04', metric: 'humidity' } }),
  alert('a3', { type: 'outdoor_air_restricted', scope: {} }),
];
const resolved = [
  alert('r1', { status: 'resolved', resolvedAt: base.simTime + 1000, scope: { floorId: 'F02' } }),
  alert('r2', { status: 'resolved', resolvedAt: base.simTime + 5000, scope: { floorId: 'F06' } }),
];
const snapshot: LiveSnapshot = { ...base, alerts: { active, recentResolved: resolved } };
const ids = (alerts: Alert[]) => alerts.map((a) => a.id);
const withFilter = (patch: Partial<AlertFilter>) =>
  selectFilteredAlerts(snapshot, { ...defaultAlertFilter, ...patch });

describe('selectFilteredAlerts', () => {
  it('анхдагч (идэвхтэй ба хүлээн авсан): ноцтой нь эхэнд', () => {
    expect(ids(withFilter({}))).toEqual(['a1', 'a2', 'a3']);
  });

  it('төлөвөөр: зөвхөн идэвхтэй, зөвхөн хүлээн авсан', () => {
    expect(ids(withFilter({ status: 'active' }))).toEqual(['a1', 'a3']);
    expect(ids(withFilter({ status: 'acknowledged' }))).toEqual(['a2']);
  });

  it('шийдэгдсэн: recentResolved-ээс, сүүлд шийдэгдсэн нь эхэнд', () => {
    expect(ids(withFilter({ status: 'resolved' }))).toEqual(['r2', 'r1']);
    expect(ids(withFilter({ status: 'resolved', floor: 'F02' }))).toEqual(['r1']);
  });

  it('ноцтой байдал, давхар, барилгын түвшин, хэмжигдэхүүнээр', () => {
    expect(ids(withFilter({ severity: 'critical' }))).toEqual(['a1']);
    expect(ids(withFilter({ severity: 'warning' }))).toEqual(['a2', 'a3']);
    expect(ids(withFilter({ floor: 'F04' }))).toEqual(['a2']);
    expect(ids(withFilter({ floor: 'building' }))).toEqual(['a3']);
    expect(ids(withFilter({ metric: 'co2' }))).toEqual(['a1']);
    expect(ids(withFilter({ metric: 'pm25' }))).toEqual([]);
  });

  it('тоо: ажиллаж буй ба шийдэгдсэн', () => {
    expect(selectAlertCounts(snapshot)).toEqual({ open: 3, resolved: 2 });
  });
});

describe('selectFilteredEvents', () => {
  const event = (seq: number, patch: Partial<SystemEvent>): SystemEvent => ({
    id: `e${seq}`,
    seq,
    timestamp: base.simTime + seq * 1000,
    type: 'DEVICE_STATE_CHANGED',
    category: 'control',
    severity: 'info',
    message: `e${seq}`,
    actor: 'system',
    ...patch,
  });
  const events = [
    event(1, { category: 'simulation', type: 'SIMULATION_STARTED' }),
    event(2, { floorId: 'F02' }),
    event(3, { category: 'alert', type: 'ALERT_RAISED', severity: 'warning', floorId: 'F02' }),
    event(4, { category: 'sensor', severity: 'warning', floorId: 'F04' }),
  ];
  const eventSnapshot: LiveSnapshot = { ...base, events };
  const run = (patch: Partial<typeof defaultEventFilter>) =>
    selectFilteredEvents(eventSnapshot, { ...defaultEventFilter, ...patch }).map((e) => e.id);

  it('шүүлтгүй: бүгд, шинэ нь эхэнд', () => {
    expect(run({})).toEqual(['e4', 'e3', 'e2', 'e1']);
  });

  it('ангилал, ач холбогдол, давхраар (давхаргүй үйл явдал давхрын шүүлтэд орохгүй)', () => {
    expect(run({ category: 'control' })).toEqual(['e2']);
    expect(run({ severity: 'warning' })).toEqual(['e4', 'e3']);
    expect(run({ floor: 'F02' })).toEqual(['e3', 'e2']);
    expect(run({ floor: 'F02', severity: 'warning' })).toEqual(['e3']);
  });
});

describe('uiStore: шүүлтийн төлөв (§10.2)', () => {
  beforeEach(() => useUiStore.setState(initialUiState));

  it('setAlertFilter / setEventFilter нь зөвхөн өгсөн талбарыг өөрчилнө', () => {
    useUiStore.getState().setAlertFilter({ severity: 'critical' });
    useUiStore.getState().setAlertFilter({ floor: 'F02' });
    expect(useUiStore.getState().alertFilter).toEqual({
      ...defaultAlertFilter,
      severity: 'critical',
      floor: 'F02',
    });
    useUiStore.getState().setEventFilter({ category: 'alert' });
    expect(useUiStore.getState().eventFilter).toEqual({ ...defaultEventFilter, category: 'alert' });
  });
});
