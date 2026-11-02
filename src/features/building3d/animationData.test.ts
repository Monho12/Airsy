import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { fanAirflow } from '@/domain/config/control';
import { createMockSnapshot } from '@/store/mockSnapshot';

import {
  createAirflowLayout,
  fanAngularSpeed,
  FAN_MAX_ANGULAR_SPEED,
  floorAirflow,
  particleBudgetPerFloor,
  particleCount,
  particlePhase,
  pathLength,
  pointOnPath,
} from './animationData';
import { createBuildingLayout } from './layout';

describe('сэнсний эргэлт (FR-B8, §5.7)', () => {
  it('урсгалын коэффициенттой пропорциональ; OFF үед 0', () => {
    expect(fanAngularSpeed('OFF')).toBe(0);
    expect(fanAngularSpeed('BOOST')).toBe(FAN_MAX_ANGULAR_SPEED);
    expect(fanAngularSpeed('LOW')).toBeCloseTo(FAN_MAX_ANGULAR_SPEED * fanAirflow.LOW);
    expect(fanAngularSpeed('HIGH')).toBeGreaterThan(fanAngularSpeed('MEDIUM'));
  });
});

describe('бөөмсийн төсөв (§8.6, §11.3)', () => {
  it('давхар бүрт min(200, floor(2000 / floorCount)); нийт ≤ 2000', () => {
    expect(particleBudgetPerFloor(6)).toBe(200);
    expect(particleBudgetPerFloor(12)).toBe(166);
    expect(particleBudgetPerFloor(20)).toBe(100);
    for (const n of [1, 6, 12, 20]) expect(particleBudgetPerFloor(n) * n).toBeLessThanOrEqual(2000);
  });

  it('идэвхтэй тоо = төсөв × урсгал; OFF үед 0', () => {
    expect(particleCount(166, 0)).toBe(0);
    expect(particleCount(166, 1)).toBe(166);
    expect(particleCount(200, 0.25)).toBe(50);
  });

  it('фаз [0, 1) мужид, давхцахгүй', () => {
    const phases = Array.from({ length: 200 }, (_, i) => particlePhase(i));
    expect(phases.every((p) => p >= 0 && p < 1)).toBe(true);
    expect(new Set(phases.map((p) => p.toFixed(6))).size).toBe(200);
  });
});

describe('агаарын урсгалын зам (§5.1.1)', () => {
  const path = [
    { x: -14, y: 2.8, z: -6 },
    { x: 0, y: 1.5, z: -6 },
    { x: 14, y: 2.8, z: -6 },
  ];
  const length = pathLength(path);
  const out = { x: 0, y: 0, z: 0 };

  it('эхлэл, дунд, төгсгөл', () => {
    expect(pointOnPath(path, length, 0, out)).toEqual({ x: -14, y: 2.8, z: -6 });
    const mid = pointOnPath(path, length, 0.5, out);
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(1.5);
    expect(pointOnPath(path, length, 1.25, out).x).toBeCloseTo(
      pointOnPath(path, length, 0.25, { x: 0, y: 0, z: 0 }).x,
    );
  });

  it('давхар бүрийн замыг шалны өндрөөр шилжүүлнэ', () => {
    const config = createBuildingConfig(12);
    const airflow = createAirflowLayout(config, createBuildingLayout(config));
    expect(airflow).toHaveLength(12);
    const f3 = airflow.find((f) => f.floorId === 'F03')!;
    expect(f3.paths).toHaveLength(2);
    expect(f3.paths[0]!.points[0]!.y).toBeCloseTo(2 * config.building.floorHeight + 2.8);
  });
});

describe('давхрын урсгал (SF ба EF-ийн их нь)', () => {
  it('суурь төлөвт LOW (0.25); төхөөрөмж байхгүй бол 0', () => {
    const snapshot = createMockSnapshot();
    expect(floorAirflow(snapshot.devices, buildingConfig, 'F07')).toBe(fanAirflow.LOW);
    expect(floorAirflow(null, buildingConfig, 'F07')).toBe(0);
    const devices = {
      ...snapshot.devices,
      'F07-SF': {
        ...snapshot.devices['F07-SF']!,
        state: { kind: 'supply_fan' as const, level: 'OFF' as const },
      },
      'F07-EF': {
        ...snapshot.devices['F07-EF']!,
        state: { kind: 'exhaust_fan' as const, level: 'BOOST' as const },
      },
    };
    expect(floorAirflow(devices, buildingConfig, 'F07')).toBe(1);
  });
});
