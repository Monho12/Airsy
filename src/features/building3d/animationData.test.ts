import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { fanAirflow } from '@/domain/config/control';
import { createMockSnapshot } from '@/store/mockSnapshot';

import {
  bundleOffset,
  createAirflowLayout,
  createStreamlineData,
  fanAngularSpeed,
  FAN_MAX_ANGULAR_SPEED,
  floorAirflow,
  floorEmphasis,
  pathLength,
  STREAMLINE_EMPHASIS,
  STREAMLINE_SEGMENTS,
  STREAMLINE_SPREAD,
  streamlineCount,
  streamlineSeed,
  streamlineStreakSpeed,
  STREAMLINE_STREAK_MAX_SPEED,
  STREAMLINE_STREAK_MIN_SPEED,
  STREAMLINES_PER_PATH,
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

describe('урсгалын шугамын тоо ба тодрол (D85)', () => {
  it('урсгалтай өснө: OFF 0 · LOW 4 · MEDIUM 5 · HIGH 7 · BOOST 8', () => {
    expect(streamlineCount(fanAirflow.OFF)).toBe(0);
    expect(streamlineCount(fanAirflow.LOW)).toBe(4);
    expect(streamlineCount(fanAirflow.MEDIUM)).toBe(5);
    expect(streamlineCount(fanAirflow.HIGH)).toBe(7);
    expect(streamlineCount(fanAirflow.BOOST)).toBe(STREAMLINES_PER_PATH);
    // Бага ч гэсэн урсгал байвал багцын ~25%
    expect(streamlineCount(0.01)).toBe(2);
    expect(streamlineCount(Number.NaN)).toBe(0);
  });

  it('зураасны хурд: OFF 0, LOW-д ч хөдөлнө, урсгалтай хурдасна', () => {
    expect(streamlineStreakSpeed(fanAirflow.OFF)).toBe(0);
    expect(streamlineStreakSpeed(Number.NaN)).toBe(0);
    expect(streamlineStreakSpeed(fanAirflow.LOW)).toBeGreaterThan(STREAMLINE_STREAK_MIN_SPEED);
    expect(streamlineStreakSpeed(fanAirflow.HIGH)).toBeGreaterThan(
      streamlineStreakSpeed(fanAirflow.MEDIUM),
    );
    expect(streamlineStreakSpeed(fanAirflow.BOOST)).toBeCloseTo(STREAMLINE_STREAK_MAX_SPEED);
  });

  it('сонгосон давхар бүрэн, бусад ~30%, сонголтгүй үед дунд зэрэг', () => {
    expect(floorEmphasis('F07', 'F07')).toBe(STREAMLINE_EMPHASIS.selected);
    expect(floorEmphasis('F06', 'F07')).toBe(STREAMLINE_EMPHASIS.other);
    expect(floorEmphasis('F06', null)).toBe(STREAMLINE_EMPHASIS.none);
    expect(STREAMLINE_EMPHASIS.other).toBeLessThan(STREAMLINE_EMPHASIS.none);
  });

  it('шугамын фаз [0, 1) мужид, давхцахгүй', () => {
    const seeds = Array.from({ length: 200 }, (_, i) => streamlineSeed(i));
    expect(seeds.every((p) => p >= 0 && p < 1)).toBe(true);
    expect(new Set(seeds.map((p) => p.toFixed(6))).size).toBe(200);
  });
});

describe('багцын хэлбэр (D85)', () => {
  it('хоёр үзүүрт нийлж, дунд хэсэгт дэлгэрнэ; зай хязгаартай', () => {
    const last = STREAMLINES_PER_PATH - 1;
    const width = (t: number) => bundleOffset(t, last).lateral - bundleOffset(t, 0).lateral;
    expect(width(0.5)).toBeGreaterThan(width(0) * 2);
    expect(width(0.5)).toBeGreaterThan(width(1) * 2);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      for (let slot = 0; slot <= last; slot += 1) {
        const { lateral, vertical } = bundleOffset(t, slot);
        expect(Math.abs(lateral)).toBeLessThanOrEqual(STREAMLINE_SPREAD + 1e-9);
        // Давхрын өндөр (3.6 м) дотор үлдэнэ: зам 1.5–2.8 м
        expect(Math.abs(vertical)).toBeLessThan(0.4);
      }
    }
  });
});

describe('агаарын урсгалын зам (§5.1.1)', () => {
  it('замын урт', () => {
    const path = [
      { x: -14, y: 2.8, z: -6 },
      { x: 0, y: 1.5, z: -6 },
      { x: 14, y: 2.8, z: -6 },
    ];
    expect(pathLength(path)).toBeCloseTo(2 * Math.hypot(14, 1.3));
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

describe('урсгалын шугамын geometry (D85)', () => {
  const config = createBuildingConfig(12);
  const floors = createAirflowLayout(config, createBuildingLayout(config));
  const data = createStreamlineData(floors);
  const paths = floors.reduce((sum, f) => sum + f.paths.length, 0);

  it('зам бүрт 8 шугам + 2 далавчтай сум; нэг geometry', () => {
    expect(data.lineCount).toBe(paths * STREAMLINES_PER_PATH);
    expect(data.arrowCount).toBe(paths * 2);
    const vertices = data.lineCount * (STREAMLINE_SEGMENTS + 1) * 2 + data.arrowCount * 2 * 2;
    expect(data.side.length).toBe(vertices);
    expect(data.position.length).toBe(vertices * 3);
    expect(data.index.length).toBe((data.lineCount * STREAMLINE_SEGMENTS + data.arrowCount) * 6);
    expect(Math.max(...data.index)).toBe(vertices - 1);
  });

  it('атрибутын муж: along [0, 1], тал ±1, давхрын индекс, нэгж шүргэгч', () => {
    expect(data.along.every((a) => a >= 0 && a <= 1)).toBe(true);
    expect(data.side.every((s) => s === 1 || s === -1)).toBe(true);
    expect(Math.min(...data.floor)).toBe(0);
    expect(Math.max(...data.floor)).toBe(floors.length - 1);
    for (let v = 0; v < data.side.length; v += 97) {
      const t = data.tangent.subarray(v * 3, v * 3 + 3);
      expect(Math.hypot(t[0]!, t[1]!, t[2]!)).toBeCloseTo(1, 5);
    }
  });

  it('шугам supply-аас эхэлж exhaust-д дуусна; давхрын шал ба таазны хооронд', () => {
    const lastVertex = (STREAMLINE_SEGMENTS + 1) * 2 - 1;
    expect(data.position[0]).toBeCloseTo(-14, 0);
    expect(data.position[lastVertex * 3]).toBeCloseTo(14, 0);
    expect(data.along[0]).toBe(0);
    expect(data.along[lastVertex]).toBe(1);
    const f3 = floors.findIndex((f) => f.floorId === 'F03');
    const floorY = 2 * config.building.floorHeight;
    for (let v = 0; v < data.floor.length; v += 1) {
      if (data.floor[v] !== f3) continue;
      const y = data.position[v * 3 + 1]!;
      expect(y).toBeGreaterThan(floorY);
      expect(y).toBeLessThan(floorY + config.building.floorHeight);
    }
  });

  it('20 давхарт ч нэг geometry (давхрын индекс 0–19)', () => {
    const c20 = createBuildingConfig(20);
    const d20 = createStreamlineData(createAirflowLayout(c20, createBuildingLayout(c20)));
    expect(Math.max(...d20.floor)).toBe(19);
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
