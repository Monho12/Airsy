// D60: анхдагч камераас мэдрэгчийн тэмдэг харагдах эсэх (§8.6 «тэмдгүүд харагдахаар»). WebGL-гүй — камераас
// зангилааны төв хүртэлх хэрчмийг layout-ийн хатуу эзэлхүүн (давхрын хавтан, дээвэр, core) огтлох эсэхээр шалгана.
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import type { Vec3 } from '@/domain/types';

import { defaultCameraPose, floorFocusPose } from './cameraMath';
import { createBuildingLayout, type BuildingLayout } from './layout';
import { createSensorNodes } from './sensorNodeData';

interface Box {
  min: Vec3;
  max: Vec3;
}

const boxOf = (center: Vec3, [w, h, d]: [number, number, number]): Box => ({
  min: { x: center.x - w / 2, y: center.y - h / 2, z: center.z - d / 2 },
  max: { x: center.x + w / 2, y: center.y + h / 2, z: center.z + d / 2 },
});

/** Тунгалаг биш эзэлхүүн (нүүр ба бүсийн хавтгай тунгалаг тул халхлахгүй) */
const occluders = (layout: BuildingLayout): Box[] => [
  ...layout.floors.map((floor) => boxOf(floor.slab.center, floor.slab.size)),
  boxOf(layout.roofSlab.center, layout.roofSlab.size),
  boxOf(layout.core.center, layout.core.size),
];

const AXES = ['x', 'y', 'z'] as const;

/** Хэрчим (from → to) хайрцгийг огтлох эсэх (slab арга) */
function segmentHitsBox(from: Vec3, to: Vec3, box: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  for (const axis of AXES) {
    const d = to[axis] - from[axis];
    if (Math.abs(d) < 1e-12) {
      if (from[axis] < box.min[axis] || from[axis] > box.max[axis]) return false;
      continue;
    }
    let a = (box.min[axis] - from[axis]) / d;
    let b = (box.max[axis] - from[axis]) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return t1 > 1e-6 && t0 < 1 - 1e-6;
}

const layout = createBuildingLayout(buildingConfig);
const nodes = createSensorNodes(buildingConfig, layout);
const boxes = occluders(layout);
const visibleFrom = (camera: Vec3, point: Vec3) =>
  !boxes.some((box) => segmentHitsBox(camera, point, box));

describe('D60: мэдрэгчийн тэмдэг анхдагч камераас харагдана (§8.6)', () => {
  it('анхдагч харагдац: ≥ 16/24 зангилааны төв саадгүй (D60-аас өмнө 4/24)', () => {
    const { position } = defaultCameraPose(layout);
    const clear = nodes.filter((node) => visibleFrom(position, node.position));
    expect(clear.length).toBeGreaterThanOrEqual(16);
  });

  it('давхарт төвлөрөхөд (D88: дээрээс 40°, дээрх давхар сүүдэр) тэр давхрын хоёр бүсийн зангилаа саадгүй', () => {
    const start = defaultCameraPose(layout);
    for (const floor of layout.floors) {
      const { position } = floorFocusPose(start, layout, floor.id)!;
      // Сүүдэр давхар (сонгосон давхрын дээрх хавтан, дээвэр, хонгилын дээд хэсэг) халхлахгүй — тунгалаг (D88)
      const ceiling = floor.elevation + layout.height / layout.floors.length;
      const solid = boxes
        .map((box) => ({ ...box, max: { ...box.max, y: Math.min(box.max.y, ceiling) } }))
        .filter((box) => box.min.y < ceiling - 1e-6);
      for (const node of nodes.filter((n) => n.floorId === floor.id)) {
        const clear = !solid.some((box) => segmentHitsBox(position, node.position, box));
        expect(clear, `${floor.id} ${node.areaId}`).toBe(true);
      }
    }
  });
});
