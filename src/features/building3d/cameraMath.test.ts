// Камерын хязгаар ба төвлөрөл (FR-B3, §8.5). WebGL-гүй цэвэр тооцоо.
import { MathUtils } from 'three';
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';

import {
  CAMERA_DAMP_LAMBDA,
  cameraLimits,
  defaultCameraPose,
  floorFocusPose,
  floorFocusTarget,
  FOCUS_ELEVATION_DEG,
  focusPose,
  settleDistance,
  stepCamera,
  type CameraPose,
} from './cameraMath';
import { createBuildingLayout } from './layout';

const layout = createBuildingLayout(buildingConfig);
const length = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('анхдагч харагдац ба хязгаар (FR-B3)', () => {
  it('анхдагч харагдац нь layout-ийн (барилга бүхэлдээ багтдаг) камер, хуулбар объект', () => {
    const pose = defaultCameraPose(layout);
    expect(pose).toEqual(layout.camera);
    expect(pose.position).not.toBe(layout.camera.position);
  });

  it.each([1, 6, 12, 20])('%i давхар: анхдагч зай ойртуулах/холдуулах хязгаар дотор', (count) => {
    const l = createBuildingLayout(createBuildingConfig(count));
    const { minDistance, maxDistance } = cameraLimits(l);
    const distance = length(l.camera.position, l.camera.target);
    expect(minDistance).toBeLessThan(distance);
    expect(maxDistance).toBeGreaterThan(distance);
  });

  it('эргүүлэх өнцөг газрын доороос харахгүй, анхдагч өнцөг хязгаар дотор', () => {
    const { minPolarAngle, maxPolarAngle } = cameraLimits(layout);
    expect(maxPolarAngle).toBeLessThan(Math.PI / 2);
    const { position, target } = layout.camera;
    const polar = Math.acos((position.y - target.y) / length(position, target));
    expect(polar).toBeGreaterThan(minPolarAngle);
    expect(polar).toBeLessThan(maxPolarAngle);
  });
});

describe('сонгосон давхарт төвлөрөх (§8.5)', () => {
  it('зорилт нь давхрын дунд өндөр, барилгын тэнхлэг дээр', () => {
    const floorHeight = buildingConfig.building.floorHeight;
    for (const floor of layout.floors) {
      expect(floorFocusTarget(layout, floor.id)).toEqual({
        x: 0,
        y: floor.elevation + floorHeight / 2,
        z: 0,
      });
    }
    expect(floorFocusTarget(layout, 'F99')).toBeNull();
  });

  it('хэрэглэгчийн эргэлт/ойртуулалтыг хадгалж зөвхөн зорилтыг зөөнө', () => {
    const current: CameraPose = {
      position: { x: 30, y: 50, z: 10 },
      target: { x: 0, y: 20, z: 0 },
    };
    const goal = focusPose(current, { x: 0, y: 5, z: 0 });
    expect(goal.target).toEqual({ x: 0, y: 5, z: 0 });
    expect(goal.position).toEqual({ x: 30, y: 35, z: 10 });
    expect(length(goal.position, goal.target)).toBeCloseTo(
      length(current.position, current.target),
    );
  });
});

describe('зөөлөн шилжилт (§8.5: 600–900 ms)', () => {
  const start = defaultCameraPose(layout);
  const goal = focusPose(start, floorFocusTarget(layout, 'F02')!);

  /** `fps`-ээр хэдэн секундэд дуусахыг тооцно (CameraRig-ийн адил: босгыг эхэнд нэг удаа) */
  function settleTime(from: CameraPose, to: CameraPose, fps = 60) {
    const dt = 1 / fps;
    const settle = settleDistance(from, to);
    let pose = from;
    for (let frame = 1; frame < fps * 5; frame += 1) {
      const step = stepCamera(pose, to, dt, settle);
      pose = step.pose;
      if (step.done) return { t: frame * dt, pose };
    }
    throw new Error('камер зорилтод хүрсэнгүй');
  }

  it.each([
    ['F02 (хол)', 'F02'],
    ['F06 (ойр)', 'F06'],
    ['F12 (дээд)', 'F12'],
  ])('%s: зайнаас үл хамааран 600–900 ms-д хүрч, яг зорилт дээр зогсоно', (_, floorId) => {
    const to = focusPose(start, floorFocusTarget(layout, floorId)!);
    const { t, pose } = settleTime(start, to);
    expect(t).toBeGreaterThanOrEqual(0.6);
    expect(t).toBeLessThanOrEqual(0.9);
    expect(pose).toEqual(to);
  });

  it('30 fps-д ч 600–900 ms', () => {
    const { t } = settleTime(start, goal, 30);
    expect(t).toBeGreaterThanOrEqual(0.6);
    expect(t).toBeLessThanOrEqual(0.9);
  });

  it('алхам бүр зорилт руу ойртож, хэтрэхгүй', () => {
    let pose = start;
    let previous = length(pose.target, goal.target);
    for (let i = 0; i < 30; i += 1) {
      pose = stepCamera(pose, goal, 1 / 60, settleDistance(start, goal), CAMERA_DAMP_LAMBDA).pose;
      const remaining = length(pose.target, goal.target);
      expect(remaining).toBeLessThanOrEqual(previous);
      expect(pose.target.y).toBeGreaterThanOrEqual(goal.target.y);
      previous = remaining;
    }
  });

  it('ижил оролт → ижил алхам (тодорхой)', () => {
    expect(stepCamera(start, goal, 1 / 60)).toEqual(stepCamera(start, goal, 1 / 60));
  });
});

describe('давхарт төвлөрөх харагдац (D88)', () => {
  const start = defaultCameraPose(layout);

  it('зорилт давхрын төв; дээрээс 40°; зай камерын хязгаарт, анхдагчаас ойр', () => {
    const pose = floorFocusPose(start, layout, 'F07')!;
    expect(pose.target).toEqual(floorFocusTarget(layout, 'F07'));
    const dx = pose.position.x - pose.target.x;
    const dy = pose.position.y - pose.target.y;
    const dz = pose.position.z - pose.target.z;
    const distance = Math.hypot(dx, dy, dz);
    expect(MathUtils.radToDeg(Math.asin(dy / distance))).toBeCloseTo(FOCUS_ELEVATION_DEG);
    const limits = cameraLimits(layout);
    expect(distance).toBeGreaterThanOrEqual(limits.minDistance);
    expect(distance).toBeLessThanOrEqual(limits.maxDistance);
    const base = Math.hypot(
      start.position.x - start.target.x,
      start.position.y - start.target.y,
      start.position.z - start.target.z,
    );
    expect(distance).toBeLessThan(base);
  });

  it('хэрэглэгчийн хэвтээ чиглэлийг (azimuth) хадгална', () => {
    const rotated = {
      target: start.target,
      position: { x: start.target.x - 50, y: start.position.y, z: start.target.z + 10 },
    };
    const pose = floorFocusPose(rotated, layout, 'F03')!;
    const before = Math.atan2(
      rotated.position.x - rotated.target.x,
      rotated.position.z - rotated.target.z,
    );
    const after = Math.atan2(pose.position.x - pose.target.x, pose.position.z - pose.target.z);
    expect(after).toBeCloseTo(before);
  });

  it('тохиргоонд байхгүй давхарт null', () => {
    expect(floorFocusPose(start, layout, 'F99')).toBeNull();
  });
});
