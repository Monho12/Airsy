import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('FloorDetails — өрөөний нягт мөр (D89)', () => {
  it('А/Б бүтнээр, өрөө нягт мөрөөр; дарахад дэлгэрэнгүй задарна', async () => {
    const user = userEvent.setup();
    renderFloor('F07');
    // Нээлттэй оффис бүтнээр
    expect(
      screen.getByRole('region', { name: buildingConfig.areas['F07-A']!.name }),
    ).toBeInTheDocument();
    // Өрөө бүр нэг товч (хураасан)
    const roomIds = ['C', 'D', 'E', 'F', 'G', 'H'].map((l) => `F07-${l}`);
    const rows = roomIds.map((id) =>
      screen.getByRole('button', { name: new RegExp(buildingConfig.areas[id]!.name) }),
    );
    rows.forEach((row) => expect(row).toHaveAttribute('aria-expanded', 'false'));
    const kitchen = buildingConfig.areas['F07-H']!;
    expect(screen.queryByRole('region', { name: kitchen.name })).toBeNull();
    // Техникийн өрөөнд «Зөвхөн хяналт», хүнтэй өрөөнд үгүй
    expect(rows[5]).toHaveTextContent(mn.common.rooms.monitorOnly);
    expect(rows[0]).not.toHaveTextContent(mn.common.rooms.monitorOnly);
    // Гол утга: хэвийн үед техникийн өрөөнд температур, хүнтэй өрөөнд CO₂
    expect(rows[5]).toHaveTextContent(mn.metrics.shortLabel.temperature);
    expect(rows[0]).toHaveTextContent(mn.metrics.shortLabel.co2);

    await user.click(rows[5]!);
    expect(rows[5]).toHaveAttribute('aria-expanded', 'true');
    const body = screen.getByRole('region', { name: kitchen.name });
    expect(within(body).getByText(mn.metrics.label.voc)).toBeInTheDocument();
    expect(body.querySelector('[data-connection]')).not.toBeNull();
  });

  it('лобби (F01) өрөөгүй — өрөөний жагсаалт харагдахгүй', () => {
    renderFloor('F01');
    expect(screen.queryByText(mn.common.rooms.heading)).toBeNull();
  });
});
