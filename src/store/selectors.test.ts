import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import type { Alert, LiveSnapshot, SystemEvent } from '@/domain/types';

import { createMockSnapshot, MOCK_SAMPLE } from './mockSnapshot';
import {
  RECENT_EVENT_LIMIT,
  selectActiveAlerts,
  selectAreaSummary,
  selectFloorDevices,
  selectFloorList,
  selectFloorSummary,
  selectOutdoorConditions,
  selectRecentEvents,
  selectStatusBar,
} from './selectors';

const snapshot = createMockSnapshot();

describe('selectStatusBar (UC-1)', () => {
  it('барилгын төлөв = хамгийн муу зөв (warning) + өгөгдлийн асуудал; дохионы тоо; автомат горим', () => {
    expect(selectStatusBar(snapshot)).toEqual({
      health: { worst: 'warning', worstValid: 'warning', hasDataIssue: true },
      activeAlertCount: 2,
      autoMode: true,
    });
  });
});

describe('selectFloorList / selectFloorSummary (§5.6)', () => {
  it('давхрууд барилгын дарааллаар (доороос → дээш)', () => {
    expect(selectFloorList(snapshot).map((s) => s.floor.id)).toEqual(
      buildingConfig.building.floorIds,
    );
  });

  it('F02: анхааруулга, 1 дохио; CO₂ нэгтгэл max = 1080', () => {
    const f02 = selectFloorSummary(snapshot, 'F02')!;
    expect(f02.health).toEqual({ worst: 'warning', worstValid: 'warning', hasDataIssue: false });
    expect(f02.activeAlertCount).toBe(1);
    expect(f02.aggregates.co2).toMatchObject({ max: MOCK_SAMPLE.warningValue, validCount: 2 });
    expect(f02.aggregates.co2?.levels).toEqual({ kind: 'one-sided', high: 'warning' });
  });

  it('F04: холболтгүй мэдрэгч нэгтгэлд орохгүй — min/max нь 0 биш, validCount 1', () => {
    const f04 = selectFloorSummary(snapshot, 'F04')!;
    expect(f04.health).toEqual({ worst: 'offline', worstValid: 'normal', hasDataIssue: true });
    const baseline = buildingConfig.areas['F04-B']!.baseline.co2;
    expect(f04.aggregates.co2).toEqual({
      max: baseline,
      min: baseline,
      validCount: 1,
      levels: { kind: 'one-sided', high: 'normal' },
    });
  });

  it('зөв хэмжилтгүй хэмжигдэхүүнд нэгтгэл огт байхгүй (тэг биш)', () => {
    const allOffline: LiveSnapshot = {
      ...snapshot,
      readings: Object.fromEntries(
        Object.entries(snapshot.readings).map(([id, r]) =>
          id.startsWith('F04-') && r.metric === 'co2'
            ? [
                id,
                {
                  ...r,
                  value: null,
                  connection: 'offline',
                  status: 'offline',
                  levels: null,
                  condition: null,
                },
              ]
            : [id, r],
        ),
      ),
    };
    expect(selectFloorSummary(allOffline, 'F04')!.aggregates.co2).toBeUndefined();
  });

  it('хэвийн давхар; байхгүй давхарт undefined', () => {
    expect(selectFloorSummary(snapshot, 'F07')!.health.worst).toBe('normal');
    expect(selectFloorSummary(snapshot, 'F99')).toBeUndefined();
  });
});

describe('selectAreaSummary', () => {
  it('бүсийн 5 утга ба өгөгдлийн асуудал', () => {
    const area = selectAreaSummary(snapshot, 'F04-A')!;
    expect(Object.keys(area.readings).sort()).toEqual([
      'co2',
      'humidity',
      'pm25',
      'temperature',
      'voc',
    ]);
    expect(area.readings.co2!.value).toBeNull();
    expect(area.health.hasDataIssue).toBe(true);
    expect(selectAreaSummary(snapshot, 'F99-A')).toBeUndefined();
  });
});

describe('selectAreaSummary — холболт ба хэмжилтийн хугацаа (FR-M1)', () => {
  const areaSensorIds = (areaId: string) =>
    Object.values(buildingConfig.sensors)
      .filter((sensor) => sensor.areaId === areaId)
      .map((sensor) => sensor.id);

  it('бүх мэдрэгч холбогдсон: хугацаа = утгын timestamp (simTime)', () => {
    expect(selectAreaSummary(snapshot, 'F02-A')!.connection).toEqual({
      measuredAt: snapshot.simTime,
      total: 5,
      online: 5,
      stale: 0,
      offline: 0,
    });
  });

  it('нэг мэдрэгч салсан (F04-A): холболтгүйг тоолно, хугацаа үлдсэн утгуудаас', () => {
    expect(
      selectAreaSummary(snapshot, MOCK_SAMPLE.offlineSensorId.slice(0, 5))!.connection,
    ).toEqual({
      measuredAt: snapshot.simTime,
      total: 5,
      online: 4,
      stale: 0,
      offline: 1,
    });
  });

  it('бүгд салсан: хугацаа null (зохиохгүй), бүгд холболтгүй', () => {
    const readings = { ...snapshot.readings };
    for (const id of areaSensorIds('F04-B')) {
      readings[id] = { ...readings[id]!, connection: 'offline', status: 'offline', value: null };
    }
    expect(selectAreaSummary({ ...snapshot, readings }, 'F04-B')!.connection).toEqual({
      measuredAt: null,
      total: 5,
      online: 0,
      stale: 0,
      offline: 5,
    });
  });

  it('хуучирсан утгыг тусад нь тоолно; snapshot-д байхгүй утга холболтгүй гэж тооцогдоно', () => {
    const [staleId, missingId] = areaSensorIds('F03-A');
    const readings = { ...snapshot.readings };
    readings[staleId!] = {
      ...readings[staleId!]!,
      connection: 'stale',
      timestamp: snapshot.simTime - 15_000,
    };
    delete readings[missingId!];
    expect(selectAreaSummary({ ...snapshot, readings }, 'F03-A')!.connection).toEqual({
      measuredAt: snapshot.simTime,
      total: 5,
      online: 3,
      stale: 1,
      offline: 1,
    });
  });
});

describe('selectOutdoorConditions (§10)', () => {
  it('OUT-* утгаас, CO₂ нь тохиргооны тогтмол', () => {
    expect(selectOutdoorConditions(snapshot)).toEqual({
      temperature: 18,
      humidity: 55,
      pm25: 8,
      co2: 420,
    });
  });

  it('холболтгүй/хуучирсан гадна мэдрэгч → null (0 биш)', () => {
    const out = snapshot.readings['OUT-pm25']!;
    const offline: LiveSnapshot = {
      ...snapshot,
      readings: {
        ...snapshot.readings,
        'OUT-pm25': { ...out, connection: 'offline', value: null, status: 'offline' },
      },
    };
    expect(selectOutdoorConditions(offline).pm25).toBeNull();
    const stale: LiveSnapshot = { ...snapshot, simTime: snapshot.simTime + 60_000 };
    expect(selectOutdoorConditions(stale)).toMatchObject({
      temperature: null,
      humidity: null,
      pm25: null,
    });
  });
});

describe('selectFloorDevices', () => {
  it('SF → EF → OAD дарааллаар; байхгүй давхарт хоосон', () => {
    expect(selectFloorDevices(snapshot, 'F07').map((d) => d.id)).toEqual([
      'F07-SF',
      'F07-EF',
      'F07-OAD',
    ]);
    expect(selectFloorDevices(snapshot, 'F99')).toEqual([]);
  });
});

describe('selectActiveAlerts', () => {
  it('ноцтой нь эхэнд, дараа нь шинэ нь эхэнд', () => {
    const base = snapshot.alerts.active[0]!;
    const make = (id: string, severity: Alert['severity'], raisedAt: number): Alert => ({
      ...base,
      id,
      severity,
      raisedAt,
    });
    const ordered = selectActiveAlerts({
      ...snapshot,
      alerts: {
        active: [
          make('A-1', 'warning', 10),
          make('A-2', 'critical', 5),
          make('A-3', 'warning', 20),
        ],
        recentResolved: [],
      },
    });
    expect(ordered.map((a) => a.id)).toEqual(['A-2', 'A-3', 'A-1']);
  });

  it('эх массивыг өөрчлөхгүй', () => {
    const before = [...snapshot.alerts.active];
    selectActiveAlerts(snapshot);
    expect(snapshot.alerts.active).toEqual(before);
  });
});

describe('selectRecentEvents (§11.4)', () => {
  it('шинэ нь эхэнд', () => {
    expect(selectRecentEvents(snapshot).map((e) => e.seq)).toEqual([4, 3, 2, 1]);
  });

  it('хязгаартай; 0 бол хоосон', () => {
    const many: SystemEvent[] = Array.from({ length: 120 }, (_, i) => ({
      ...snapshot.events[0]!,
      id: `E-${i}`,
      seq: i + 1,
    }));
    const result = selectRecentEvents({ ...snapshot, events: many });
    expect(result).toHaveLength(RECENT_EVENT_LIMIT);
    expect(result[0]!.seq).toBe(120);
    expect(selectRecentEvents(snapshot, 0)).toEqual([]);
  });
});
