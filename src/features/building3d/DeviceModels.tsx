// Агааржуулалтын төхөөрөмжийн загвар (CLAUDE.md §8.6, FR-B6, §11.3): давхар бүрт сэнсний бүрхүүл + далбаа,
// түвшний заагч, гадна агаарын хаалтын хүрээ + ламель. Бүгд instanced (5 draw call, давхрын тооноос үл хамаарна).
// Phase 5 (FR-B8, D78): далбаа урсгалын коэффициенттой пропорциональ хурдаар зөөлөн хурдсан эргэнэ, ламель зорилтот
// өнцөг рүү зөөлөн шилжинэ (`THREE.MathUtils.damp`, D57). Хөдөлгөөн багасгах үед эргэхгүй, ламель шууд (§8.5).
// Сонгогдохгүй (handler-гүй).
// Төлөвийг 2D төхөөрөмжийн жагсаалт бичвэрээр харуулна — 3D нь цорын ганц зам биш (§8.8).
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, MathUtils, Object3D, type InstancedMesh } from 'three';

import type { BuildingConfig } from '@/domain/config/building';
import { fanLevelOrder } from '@/domain/config/control';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

import { useAmbientFrame } from './useAmbientFrame';
import { useCeilingClipPlanes } from './useCeilingClip';

import { fanAngularSpeed } from './animationData';
import {
  createDeviceModels,
  deviceVisualStates,
  FAN_LEVEL_SEGMENTS,
  type DamperVisual,
  type DeviceModelLayout,
  type FanVisual,
} from './deviceModelData';
import type { BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';

// ---------- Дүрслэлийн хэмжээ, м (барилгын өгөгдөл биш) ----------
const FAN_RADIUS = 0.55;
const BLADES_PER_FAN = 4;
const BLADE_SIZE: [number, number, number] = [0.14, 0.42, 0.03];
const BLADE_OFFSET = 0.25;
const PIP_SIZE: [number, number, number] = [0.16, 0.08, 0.04];
const PIP_SPACING = 0.22;
/** Түвшний заагч сэнсний доор */
const PIP_DROP = FAN_RADIUS + 0.25;
const DAMPER_SIZE = 1.2;
const DAMPER_BAR = 0.06;
const LOUVERS_PER_DAMPER = 3;
const LOUVER_SIZE: [number, number, number] = [DAMPER_SIZE - 0.12, 0.36, 0.03];
/** Хаалтын хүрээний 4 тал: [x, y, өргөн, өндөр] (хүрээний төвөөс) */
const DAMPER_BARS: [number, number, number, number][] = [
  [0, DAMPER_SIZE / 2, DAMPER_SIZE, DAMPER_BAR],
  [0, -DAMPER_SIZE / 2, DAMPER_SIZE, DAMPER_BAR],
  [-DAMPER_SIZE / 2, 0, DAMPER_BAR, DAMPER_SIZE],
  [DAMPER_SIZE / 2, 0, DAMPER_BAR, DAMPER_SIZE],
];

/** Зөөлрүүлэлтийн хурд (1/с): сэнсний хурдсалт ба ламелийн шилжилт (§8.5 «зөөлөн хурдсана») */
const FAN_DAMPING = 1.5;
const LOUVER_DAMPING = 3;

// Effect ба frame бүрт шинэ объект үүсгэхгүй (§11.3)
const scratch = new Object3D();
const scratchColor = new Color();

/** Instance-ийг байрлуулна; `visible === false` бол масштаб 0 (харагдахгүй, raycast-д ч оролцохгүй) */
function place(
  mesh: InstancedMesh,
  index: number,
  position: [number, number, number],
  options: {
    rotationX?: number;
    rotationZ?: number;
    scale?: [number, number, number];
    visible?: boolean;
  } = {},
) {
  const { rotationX = 0, rotationZ = 0, scale = [1, 1, 1], visible = true } = options;
  scratch.position.set(...position);
  scratch.rotation.set(rotationX, 0, rotationZ);
  if (visible) scratch.scale.set(...scale);
  else scratch.scale.set(0, 0, 0);
  scratch.updateMatrix();
  mesh.setMatrixAt(index, scratch.matrix);
}

function paint(mesh: InstancedMesh, index: number, color: string) {
  mesh.setColorAt(index, scratchColor.set(color));
}

function finish(mesh: InstancedMesh) {
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Сэнсний далбааг `spin` өнцгөөр эргүүлж байрлуулна */
function placeBlades(
  blades: InstancedMesh,
  fanIndex: number,
  fan: FanVisual,
  model: DeviceModelLayout,
  spin: number,
) {
  const { x, y, z } = model.position;
  for (let b = 0; b < BLADES_PER_FAN; b += 1) {
    const angle = Math.PI / 4 + (b * Math.PI) / 2 + spin;
    place(
      blades,
      fanIndex * BLADES_PER_FAN + b,
      [x - Math.sin(angle) * BLADE_OFFSET, y + Math.cos(angle) * BLADE_OFFSET, z],
      { rotationZ: angle, visible: fan.known },
    );
  }
}

/** Хаалтын ламелийг `angle` өнцгөөр байрлуулна (0 = босоо/хаалттай, π/2 = хэвтээ/нээлттэй) */
function placeLouvers(
  louvers: InstancedMesh,
  damperIndex: number,
  damper: DamperVisual,
  model: DeviceModelLayout,
  angle: number,
) {
  const { x, y, z } = model.position;
  for (let l = 0; l < LOUVERS_PER_DAMPER; l += 1) {
    const offsetY = (l - (LOUVERS_PER_DAMPER - 1) / 2) * LOUVER_SIZE[1];
    place(louvers, damperIndex * LOUVERS_PER_DAMPER + l, [x, y + offsetY, z], {
      rotationX: damper.known ? angle : 0,
      visible: damper.known,
    });
  }
}

const targetSpeed = (fan: FanVisual) =>
  fan.known ? fanAngularSpeed(fanLevelOrder[fan.litSegments] ?? 'OFF') : 0;
const targetLouver = (damper: DamperVisual) => (damper.known ? damper.louverAngle : 0);

export function DeviceModels({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  const models = useMemo(() => createDeviceModels(config, layout), [config, layout]);
  // Зөвхөн төхөөрөмжийн хэсгийг уншина — structural sharing-ээр өөрчлөгдөөгүй бол дахин зурахгүй (§11.2)
  const devices = useLiveStore((state) => state.snapshot?.devices ?? null);
  const visuals = useMemo(() => deviceVisualStates(devices, models), [devices, models]);
  const invalidate = useThree((state) => state.invalidate);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  // Сонгосон давхрын дээрх төхөөрөмжийг тайрна (D88) — дээрээс харахад сонгосон давхрыг халхлахгүй
  const clipPlanes = useCeilingClipPlanes(layout);

  // Сэнс ба хаалт тусдаа instanced mesh-тэй
  const { fans, dampers } = useMemo(() => {
    const fanList: { model: DeviceModelLayout; visual: FanVisual }[] = [];
    const damperList: { model: DeviceModelLayout; visual: DamperVisual }[] = [];
    models.forEach((model, i) => {
      const visual = visuals[i];
      if (visual?.kind === 'fan') fanList.push({ model, visual });
      else if (visual?.kind === 'damper') damperList.push({ model, visual });
    });
    return { fans: fanList, dampers: damperList };
  }, [models, visuals]);

  const shroudRef = useRef<InstancedMesh>(null);
  const bladeRef = useRef<InstancedMesh>(null);
  const pipRef = useRef<InstancedMesh>(null);
  const frameRef = useRef<InstancedMesh>(null);
  const louverRef = useRef<InstancedMesh>(null);
  // Анимацийн төлөв (React төлөв биш — frame бүрт өөрчлөгдөнө, §11.2): далбааны өнцөг/хурд, ламелийн одоогийн өнцөг
  const spin = useRef<number[]>([]);
  const speed = useRef<number[]>([]);
  const louverAngle = useRef<number[]>([]);

  useLayoutEffect(() => {
    const shroud = shroudRef.current;
    const blades = bladeRef.current;
    const pips = pipRef.current;
    const frames = frameRef.current;
    const louvers = louverRef.current;
    if (
      shroud === null ||
      blades === null ||
      pips === null ||
      frames === null ||
      louvers === null
    ) {
      return;
    }

    fans.forEach(({ model, visual: fan }, fanIndex) => {
      const { x, y, z } = model.position;
      // Бүрхүүл: мэдэгдэхгүй төлөвт «өгөгдөлгүй» саарал (§8.3)
      place(shroud, fanIndex, [x, y, z]);
      paint(shroud, fanIndex, fan.known ? colors.deviceFrame : colors.status.offline);

      // Далбаа: ажиллаж буй бол тод, унтраалттай бол бүдэг; мэдэгдэхгүй бол зурахгүй (таамаглахгүй)
      placeBlades(blades, fanIndex, fan, model, spin.current[fanIndex] ?? 0);
      for (let b = 0; b < BLADES_PER_FAN; b += 1) {
        paint(
          blades,
          fanIndex * BLADES_PER_FAN + b,
          fan.known && fan.running ? colors.deviceActive : colors.deviceIdle,
        );
      }

      // Түвшний заагч: LOW 1 … BOOST 4 гэрэлтэнэ (§5.7)
      for (let p = 0; p < FAN_LEVEL_SEGMENTS; p += 1) {
        const index = fanIndex * FAN_LEVEL_SEGMENTS + p;
        const lit = fan.known && p < fan.litSegments;
        place(
          pips,
          index,
          [x + (p - (FAN_LEVEL_SEGMENTS - 1) / 2) * PIP_SPACING, y - PIP_DROP, z],
          {
            visible: fan.known,
          },
        );
        paint(pips, index, lit ? colors.deviceActive : colors.deviceIdle);
      }
    });

    dampers.forEach(({ model, visual: damper }, damperIndex) => {
      const { x, y, z } = model.position;
      DAMPER_BARS.forEach(([bx, by, w, h], bar) => {
        const index = damperIndex * DAMPER_BARS.length + bar;
        place(frames, index, [x + bx, y + by, z], { scale: [w, h, DAMPER_BAR] });
        paint(frames, index, damper.known ? colors.deviceFrame : colors.status.offline);
      });

      // Ламель X тэнхлэгээр эргэнэ: 0 = босоо (хаалттай), π/2 = хэвтээ (бүрэн нээлттэй). Анх удаа эсвэл хөдөлгөөн
      // багасгах үед шууд зорилтод; бусад үед одоогийн өнцгөөс `useFrame` зөөлөн шилжүүлнэ.
      if (reducedMotion || louverAngle.current[damperIndex] === undefined) {
        louverAngle.current[damperIndex] = targetLouver(damper);
      }
      placeLouvers(louvers, damperIndex, damper, model, louverAngle.current[damperIndex]!);
      for (let l = 0; l < LOUVERS_PER_DAMPER; l += 1) {
        paint(louvers, damperIndex * LOUVERS_PER_DAMPER + l, colors.deviceActive);
      }
    });

    [shroud, blades, pips, frames, louvers].forEach(finish);
    invalidate(); // `frameloop="demand"`
  }, [fans, dampers, colors, invalidate, reducedMotion]);

  // Анимаци (FR-B8): хөдөлгөөн багасгах үед ажиллахгүй — сэнс эргэлгүй төлөвөө харуулна (§8.5)
  const requestAmbientFrame = useAmbientFrame();
  useFrame((_, delta) => {
    const blades = bladeRef.current;
    const louvers = louverRef.current;
    if (reducedMotion || blades === null || louvers === null) return;
    const dt = Math.min(delta, 0.1); // таб нуугдсаны дараах том delta-г хязгаарлана
    let moving = false;
    fans.forEach(({ model, visual }, i) => {
      const goal = targetSpeed(visual);
      const current = MathUtils.damp(speed.current[i] ?? 0, goal, FAN_DAMPING, dt);
      speed.current[i] = Math.abs(current - goal) < 1e-3 ? goal : current;
      if (speed.current[i] === 0) return;
      spin.current[i] = ((spin.current[i] ?? 0) + speed.current[i]! * dt) % (Math.PI * 2);
      placeBlades(blades, i, visual, model, spin.current[i]!);
      moving = true;
    });
    dampers.forEach(({ model, visual }, i) => {
      const goal = targetLouver(visual);
      const currentAngle = louverAngle.current[i] ?? goal;
      if (currentAngle === goal) return;
      const next = MathUtils.damp(currentAngle, goal, LOUVER_DAMPING, dt);
      louverAngle.current[i] = Math.abs(next - goal) < 1e-3 ? goal : next;
      placeLouvers(louvers, i, visual, model, louverAngle.current[i]!);
      moving = true;
    });
    if (!moving) return;
    blades.instanceMatrix.needsUpdate = true;
    louvers.instanceMatrix.needsUpdate = true;
    requestAmbientFrame(); // `frameloop="demand"` — дараагийн frame, ~30 fps-ээр (D104)
  });

  // instance-ийн тоо үүсгэх үед тогтдог — давхрын тоо өөрчлөгдвөл `key`-ээр дахин үүсгэнэ
  const fanCount = fans.length;
  const damperCount = dampers.length;
  return (
    <group name="devices">
      <instancedMesh
        key={`shroud-${fanCount}`}
        ref={shroudRef}
        args={[undefined, undefined, fanCount]}
      >
        <torusGeometry args={[FAN_RADIUS, 0.07, 8, 32]} />
        <meshBasicMaterial clippingPlanes={clipPlanes} />
      </instancedMesh>
      <instancedMesh
        key={`blade-${fanCount}`}
        ref={bladeRef}
        args={[undefined, undefined, fanCount * BLADES_PER_FAN]}
      >
        <boxGeometry args={BLADE_SIZE} />
        <meshBasicMaterial clippingPlanes={clipPlanes} />
      </instancedMesh>
      <instancedMesh
        key={`pip-${fanCount}`}
        ref={pipRef}
        args={[undefined, undefined, fanCount * FAN_LEVEL_SEGMENTS]}
      >
        <boxGeometry args={PIP_SIZE} />
        <meshBasicMaterial clippingPlanes={clipPlanes} />
      </instancedMesh>
      <instancedMesh
        key={`frame-${damperCount}`}
        ref={frameRef}
        args={[undefined, undefined, damperCount * DAMPER_BARS.length]}
      >
        {/* Нэгж куб — тал бүрийн хэмжээг instance-ийн масштабаар */}
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial clippingPlanes={clipPlanes} />
      </instancedMesh>
      <instancedMesh
        key={`louver-${damperCount}`}
        ref={louverRef}
        args={[undefined, undefined, damperCount * LOUVERS_PER_DAMPER]}
      >
        <boxGeometry args={LOUVER_SIZE} />
        <meshBasicMaterial clippingPlanes={clipPlanes} />
      </instancedMesh>
    </group>
  );
}
