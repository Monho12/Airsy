// Өрөөний сценарийн загвар (С7, D93): аль өрөөнд аль загвар, тохирохгүй үед null, гал/утаа өрөөнөөс байхгүй.
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';

import { createRoomScenario, roomScenarioIdsFor } from './rooms';

const area = (id: string) => buildingConfig.areas[id]!;

describe('roomScenarioIdsFor', () => {
  it('өрөөний төрөл бүрт загвар; мэдрэгч салгах бүх өрөөнд; нээлттэй оффист хоосон', () => {
    expect(roomScenarioIdsFor(area('F07-C'))).toEqual(['room-meeting', 'room-sensor-disconnect']);
    expect(roomScenarioIdsFor(area('F03-F'))).toEqual([
      'room-server-overheat',
      'room-sensor-disconnect',
    ]);
    expect(roomScenarioIdsFor(area('F07-F'))).toEqual(['room-sensor-disconnect']); // агуулах
    expect(roomScenarioIdsFor(area('F07-G'))[0]).toBe('room-restroom-humidity');
    expect(roomScenarioIdsFor(area('F07-H'))[0]).toBe('room-kitchen-cooking');
    expect(roomScenarioIdsFor(area('F07-A'))).toEqual([]);
    for (const a of Object.values(buildingConfig.areas)) {
      if (a.roomKind !== null) expect(roomScenarioIdsFor(a)).toContain('room-sensor-disconnect');
    }
  });
});

describe('createRoomScenario', () => {
  it('тохирохгүй загвар, нээлттэй оффис, үл мэдэгдэх бүсэд null', () => {
    expect(createRoomScenario('room-server-overheat', 'F07-H', buildingConfig)).toBeNull();
    expect(createRoomScenario('room-meeting', 'F07-A', buildingConfig)).toBeNull();
    expect(createRoomScenario('room-meeting', 'F99-C', buildingConfig)).toBeNull();
  });

  it('зорилтот бүс, нэр, зөөлөн шинэчлэл, «бүгд хэвийн» + minMs; бүх үйлдэл зөвхөн тэр бүсэд', () => {
    const def = createRoomScenario('room-kitchen-cooking', 'F07-H', buildingConfig)!;
    expect(def).toMatchObject({
      id: 'room-kitchen-cooking',
      targetAreaId: 'F07-H',
      startsFrom: 'baseline',
      requiresConfirmation: false,
      completion: { when: 'allNormal', minMs: 120_000 },
    });
    expect(def.name).toContain(area('F07-H').name);
    expect(def.name).toContain('7-р давхар');
    for (const step of def.steps) {
      expect(step.action).toMatchObject({ areaIds: ['F07-H'] });
    }
    // Гал/утаа өрөөнөөс эхлэхгүй (§6.9, D7)
    expect(def.steps.some((step) => step.action.type === 'startEmergency')).toBe(false);
  });

  it('мэдрэгч салгах: тухайн өрөөний CO₂ мэдрэгчийг салгаж, дахин холбоно', () => {
    const def = createRoomScenario('room-sensor-disconnect', 'F07-D', buildingConfig)!;
    expect(def.steps.map((step) => step.action)).toEqual([
      { type: 'disconnectSensor', sensorIds: ['F07-D-co2'] },
      { type: 'reconnectSensor', sensorIds: ['F07-D-co2'] },
    ]);
  });
});
