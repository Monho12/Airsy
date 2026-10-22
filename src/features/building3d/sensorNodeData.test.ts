// Мэдрэгчийн зангилааны байрлал, instance → бүс, төлөв (§5.3, §5.6, §8.6, FR-B5). WebGL-гүй.
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { createMockSnapshot, MOCK_SAMPLE } from '@/store/mockSnapshot';

import { createBuildingLayout } from './layout';
import {
  areaIdAtInstance,
  createSensorNodes,
  detailLabelAreaId,
  sensorNodeStatuses,
} from './sensorNodeData';

const layout = createBuildingLayout(buildingConfig);
const nodes = createSensorNodes(buildingConfig, layout);
const areaOfSensor = (sensorId: string) => buildingConfig.sensors[sensorId]!.areaId!;

describe('createSensorNodes — байрлал (§5.1.1, §5.3)', () => {
  it.each([6, 12, 20])(
    '%i давхар: бүс бүрт яг нэг зангилаа, layout-ийн бүсийн дарааллаар',
    (count) => {
      const config = createBuildingConfig(count);
      const l = createBuildingLayout(config);
      const result = createSensorNodes(config, l);
      expect(result.map((node) => node.areaId)).toEqual(
        l.floors.flatMap((floor) => floor.zones.map((zone) => zone.id)),
      );
      expect(result).toHaveLength(count * 2);
    },
  );

  it('анхдагч барилга: 24 зангилаа (120 дотоод мэдрэгч ÷ 5 хэмжигдэхүүн)', () => {
    const indoor = Object.values(buildingConfig.sensors).filter((s) => s.location === 'indoor');
    expect(nodes).toHaveLength(indoor.length / 5);
    expect(new Set(nodes.map((node) => node.areaId)).size).toBe(nodes.length);
  });

  it('байрлал = Area.markerPosition, y нь давхрын шалны өндрөөс (давхардсан өгөгдөлгүй)', () => {
    for (const node of nodes) {
      const area = buildingConfig.areas[node.areaId]!;
      const floor = layout.floors.find((candidate) => candidate.id === area.floorId)!;
      expect(node.floorId).toBe(area.floorId);
      expect(node.position).toEqual({
        x: area.markerPosition.x,
        y: floor.elevation + area.markerPosition.y,
        z: area.markerPosition.z,
      });
    }
  });
});

describe('areaIdAtInstance — instanceId → areaId (§8.6)', () => {
  it('instance бүр өөрийн бүс рүү', () => {
    nodes.forEach((node, index) => expect(areaIdAtInstance(nodes, index)).toBe(node.areaId));
  });

  it.each([undefined, -1, nodes.length, 1.5, Number.NaN])(
    '%s → null (таамаглахгүй)',
    (instanceId) => {
      expect(areaIdAtInstance(nodes, instanceId)).toBeNull();
    },
  );
});

describe('sensorNodeStatuses — 2D HealthIndicator-ийн дүрэм (§5.6)', () => {
  const snapshot = createMockSnapshot();
  const statuses = sensorNodeStatuses(snapshot, nodes);
  const statusOf = (areaId: string) => statuses[nodes.findIndex((n) => n.areaId === areaId)]!;

  it('анхааруулгатай бүс (F02-A CO₂ 1,080) → warning, өгөгдлийн асуудалгүй', () => {
    expect(statusOf(areaOfSensor(MOCK_SAMPLE.warningSensorId))).toEqual({
      status: 'warning',
      dataIssue: false,
    });
  });

  it('нэг мэдрэгч холболтгүй (F04-A) → зөв утгуудаар normal + саарал цагираг (асуудал далдлахгүй)', () => {
    expect(statusOf(areaOfSensor(MOCK_SAMPLE.offlineSensorId))).toEqual({
      status: 'normal',
      dataIssue: true,
    });
  });

  it('бусад бүс → normal', () => {
    expect(statusOf('F07-B')).toEqual({ status: 'normal', dataIssue: false });
  });

  it('бүсийн бүх мэдрэгч холболтгүй → offline (саарал), цагирагүй', () => {
    const offline = structuredClone(snapshot);
    for (const sensor of Object.values(buildingConfig.sensors)) {
      if (sensor.areaId !== 'F07-B') continue;
      offline.readings[sensor.id] = {
        ...offline.readings[sensor.id]!,
        connection: 'offline',
        value: null,
        status: 'offline',
        levels: null,
        condition: null,
      };
    }
    const result = sensorNodeStatuses(offline, nodes);
    expect(result[nodes.findIndex((n) => n.areaId === 'F07-B')]).toEqual({
      status: 'offline',
      dataIssue: false,
    });
  });

  it('snapshot байхгүй (ачаалж байна) → бүгд offline, 0 эсвэл хэвийн гэж таамаглахгүй', () => {
    expect(sensorNodeStatuses(null, nodes).every((s) => s.status === 'offline')).toBe(true);
  });
});

describe('detailLabelAreaId — нэг л дэлгэрэнгүй шошго (§8.6, 2026-10-22-ны шийдвэр)', () => {
  it('бүс сонгогдсон → зөвхөн сонгосон бүс (өөр бүс дээр hover хийсэн ч)', () => {
    expect(detailLabelAreaId('F04-B', 'F01-B')).toBe('F04-B');
    expect(detailLabelAreaId('F04-B', null)).toBe('F04-B');
    expect(detailLabelAreaId('F04-B', 'F04-B')).toBe('F04-B');
  });

  it('бүс сонгогдоогүй → hover хийсэн бүс', () => {
    expect(detailLabelAreaId(null, 'F01-B')).toBe('F01-B');
  });

  it('сонголт ч hover ч байхгүй → шошгогүй', () => {
    expect(detailLabelAreaId(null, null)).toBeNull();
  });
});
