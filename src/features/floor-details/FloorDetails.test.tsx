import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { formatTimeMn, mn } from '@/domain/i18n/mn';
import type { LiveSnapshot, SensorReading } from '@/domain/types';
import { applySnapshot } from '@/store/adapter';
import { initialLiveState, useLiveStore } from '@/store/liveStore';
import { createMockSnapshot } from '@/store/mockSnapshot';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { FloorDetails } from './FloorDetails';

beforeEach(() => {
  useLiveStore.setState(initialLiveState, true);
  useUiStore.setState(initialUiState);
});

function renderFloor(floorId: string, snapshot: LiveSnapshot = createMockSnapshot()) {
  applySnapshot(snapshot);
  useUiStore.getState().selectFloor(floorId);
  render(<FloorDetails />);
  return snapshot;
}

/** Бүсийн гарчгийн доорх «Хэмжсэн: … · …» мөр */
function areaMeta(areaId: string): HTMLElement {
  const area = screen.getByRole('region', { name: buildingConfig.areas[areaId]!.name });
  const meta = area.querySelector<HTMLElement>('[data-connection]');
  if (meta === null) throw new Error(`${areaId}: хэмжилтийн мөр олдсонгүй`);
  return meta;
}

function withAreaReadings(
  areaId: string,
  change: (reading: SensorReading, index: number) => SensorReading,
): LiveSnapshot {
  const snapshot = createMockSnapshot();
  const readings = { ...snapshot.readings };
  Object.values(buildingConfig.sensors)
    .filter((sensor) => sensor.areaId === areaId)
    .forEach((sensor, index) => {
      readings[sensor.id] = change(readings[sensor.id]!, index);
    });
  return { ...snapshot, readings };
}

describe('FloorDetails — бүсийн хэмжилтийн хугацаа ба холболт (FR-M1)', () => {
  it('бүх мэдрэгч холбогдсон бүс: «Хэмжсэн: ЦЦ:ММ:СС · Холбогдсон»', () => {
    const snapshot = renderFloor('F02');
    const expected = `${mn.common.measuredAt}: ${formatTimeMn(snapshot.simTime)} · ${mn.common.connection.online}`;
    for (const areaId of ['F02-A', 'F02-B']) {
      const meta = areaMeta(areaId);
      expect(meta).toHaveTextContent(expected);
      expect(meta).toHaveAttribute('data-connection', 'online');
      expect(within(meta).getByText(formatTimeMn(snapshot.simTime))).toHaveAttribute(
        'dateTime',
        new Date(snapshot.simTime).toISOString(),
      );
    }
  });

  it('нэг мэдрэгч салсан бүс «Холбогдсон» биш, холболтгүй мэдрэгчийн тоог харуулна', () => {
    const snapshot = renderFloor('F04');
    const meta = areaMeta('F04-A');
    expect(meta).toHaveTextContent(
      `${mn.common.measuredAt}: ${formatTimeMn(snapshot.simTime)} · ${mn.common.sensorsOffline(1)}`,
    );
    expect(meta).not.toHaveTextContent(mn.common.connection.online);
    expect(meta).toHaveAttribute('data-connection', 'offline');
    // Хөрш бүс бүрэн холбогдсон хэвээр
    expect(areaMeta('F04-B')).toHaveTextContent(mn.common.connection.online);
  });

  it('бүгд салсан бүс: «Холболтгүй», хэмжилтийн хугацааг зохиохгүй', () => {
    renderFloor(
      'F04',
      withAreaReadings('F04-B', (reading) => ({
        ...reading,
        connection: 'offline',
        status: 'offline',
        value: null,
        levels: null,
        condition: null,
      })),
    );
    const meta = areaMeta('F04-B');
    expect(meta).toHaveTextContent(mn.common.connection.offline);
    expect(meta).not.toHaveTextContent(mn.common.measuredAt);
    expect(meta).not.toHaveTextContent(mn.common.connection.online);
    expect(meta.querySelector('time')).toBeNull();
  });

  it('хуучирсан мэдрэгчтэй бүс «Холбогдсон» биш', () => {
    renderFloor(
      'F03',
      withAreaReadings('F03-A', (reading, index) =>
        index === 0 ? { ...reading, connection: 'stale' } : reading,
      ),
    );
    const meta = areaMeta('F03-A');
    expect(meta).toHaveTextContent(mn.common.sensorsStale(1));
    expect(meta).not.toHaveTextContent(mn.common.connection.online);
    expect(meta).toHaveAttribute('data-connection', 'stale');
  });
});
