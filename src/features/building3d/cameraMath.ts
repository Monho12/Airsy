// Камерын хязгаар ба төвлөрлийн цэвэр тооцоо (CLAUDE.md FR-B3, §8.5, D57). WebGL-гүйгээр тестлэгдэнэ.
// Хөдөлгөөн нь зөвхөн хэрэглэгчийн үйлдлээр (давхар сонгох, «Харагдацыг сэргээх») — тасралтгүй/чимэглэлийн хөдөлгөөнгүй.
import { MathUtils } from 'three';

import type { FloorId, Vec3 } from '@/domain/types';

import type { BuildingLayout } from './layout';

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface CameraLimits {
  minDistance: number;
  maxDistance: number;
  /** Дээрээс хэмжсэн өнцөг, радиан: 0 = шууд дээрээс, π/2 = хэвтээ */
  minPolarAngle: number;
  maxPolarAngle: number;
}

/** Ойртуулах доод хязгаар: нэг давхрыг ойроос харах хэмжээ (анхдагч зайны хувь) */
const MIN_DISTANCE_RATIO = 0.3;
/** Холдуулах дээд хязгаар (анхдагч зайны хувь) */
const MAX_DISTANCE_RATIO = 1.6;
/** Газрын доороос харахгүй — хэвтээгээс бага зэрэг дээш хүртэл */
const MAX_POLAR_ANGLE = MathUtils.degToRad(85);
const MIN_POLAR_ANGLE = MathUtils.degToRad(5);

/** Зөөлрүүлэлтийн хурд (MathUtils.damp-ийн λ, 1/с; D57) */
export const CAMERA_DAMP_LAMBDA = 6.5;
/**
 * Эхлэлийн зайны энэ хувь үлдэхэд хөдөлгөөнийг дуусгаж яг зорилт дээр тавина. Экспоненциал бууралтад
 * хугацаа зайнаас хамаарахгүй: ln(1 / 0.005) / 6.5 ≈ 0.82 с — §8.5-ын 600–900 ms-д багтана.
 */
export const CAMERA_SETTLE_RATIO = 0.005;
/** Маш богино шилжилтийн доод босго, м */
export const CAMERA_SETTLE_EPSILON = 0.01;

const distanceBetween = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const poseDistance = (a: CameraPose, b: CameraPose) =>
  Math.max(distanceBetween(a.position, b.position), distanceBetween(a.target, b.target));

/** Шилжилтийн эхэнд нэг удаа тооцох зогсох босго (м) */
export function settleDistance(start: CameraPose, goal: CameraPose): number {
  return Math.max(CAMERA_SETTLE_EPSILON, poseDistance(start, goal) * CAMERA_SETTLE_RATIO);
}

/** Анхдагч харагдац (layout-ийн тооцоо; барилга бүхэлдээ багтана) */
export function defaultCameraPose(layout: BuildingLayout): CameraPose {
  return { position: { ...layout.camera.position }, target: { ...layout.camera.target } };
}

/** Хязгаартай эргүүлэх/ойртуулах (FR-B3). Анхдагч зай үргэлж зөвшөөрөгдсөн мужид. */
export function cameraLimits(layout: BuildingLayout): CameraLimits {
  const base = distanceBetween(layout.camera.position, layout.camera.target);
  return {
    minDistance: base * MIN_DISTANCE_RATIO,
    maxDistance: base * MAX_DISTANCE_RATIO,
    minPolarAngle: MIN_POLAR_ANGLE,
    maxPolarAngle: MAX_POLAR_ANGLE,
  };
}

/** Давхрын төв: хавтангийн дээд тал ба дараагийн давхрын хооронд, барилгын тэнхлэг дээр. */
export function floorFocusTarget(layout: BuildingLayout, floorId: FloorId): Vec3 | null {
  const floor = layout.floors.find((candidate) => candidate.id === floorId);
  if (floor === undefined) return null;
  const floorHeight = layout.height / layout.floors.length;
  return { x: 0, y: floor.elevation + floorHeight / 2, z: 0 };
}

/**
 * Сонгосон давхарт төвлөрөх (§8.5): зорилтыг давхрын төв рүү зөөж, хэрэглэгчийн сонгосон эргэлт ба
 * ойртуулалтыг (камерын зорилтоос харьцангуй байрлал) хадгална.
 */
export function focusPose(current: CameraPose, target: Vec3): CameraPose {
  return {
    target: { ...target },
    position: {
      x: current.position.x + (target.x - current.target.x),
      y: current.position.y + (target.y - current.target.y),
      z: current.position.z + (target.z - current.target.z),
    },
  };
}

const dampVec = (from: Vec3, to: Vec3, lambda: number, dt: number): Vec3 => ({
  x: MathUtils.damp(from.x, to.x, lambda, dt),
  y: MathUtils.damp(from.y, to.y, lambda, dt),
  z: MathUtils.damp(from.z, to.z, lambda, dt),
});

/**
 * Нэг frame-ийн алхам. `settle` нь шилжилтийн эхэнд `settleDistance`-ээр тооцсон босго.
 * `done` үед байрлал яг зорилт дээр (дахин зурах шаардлагагүй).
 */
export function stepCamera(
  current: CameraPose,
  goal: CameraPose,
  dt: number,
  settle = CAMERA_SETTLE_EPSILON,
  lambda = CAMERA_DAMP_LAMBDA,
): { pose: CameraPose; done: boolean } {
  const pose = {
    position: dampVec(current.position, goal.position, lambda, dt),
    target: dampVec(current.target, goal.target, lambda, dt),
  };
  if (poseDistance(pose, goal) <= settle) {
    return { pose: { position: { ...goal.position }, target: { ...goal.target } }, done: true };
  }
  return { pose, done: false };
}
