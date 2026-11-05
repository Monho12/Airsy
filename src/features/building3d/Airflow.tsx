// Агаарын урсгалын бөөмс (CLAUDE.md §8.6, §11.2, §11.3, FR-B8, D78): давхар бүрийн `airflowPaths`-ийн дагуу
// оруулахаас гаргах руу урсана; тоо ба хурд нь тухайн давхрын сэнсний урсгалтай пропорциональ (OFF үед 0).
// Нэг instanced mesh (1 draw call); frame бүрийн төлөвийг React биш `useLiveStore.getState()`-ээс уншина (§11.2).
// Хөдөлгөөн багасгах үед бөөмс нуугдана (§8.5). Дүрслэл — агаарын урсгалын физик загвар биш.
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';

import type { BuildingConfig } from '@/domain/config/building';
import type { Vec3 } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

import {
  createAirflowLayout,
  floorAirflow,
  particleBudgetPerFloor,
  particleCount,
  particlePhase,
  pointOnPath,
  PARTICLE_MAX_SPEED,
} from './animationData';
import { emergencyFloorRole } from './emergencyData';
import type { BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';

const PARTICLE_RADIUS = 0.12;

// Frame бүрт объект үүсгэхгүй (§11.3)
const scratch = new Object3D();
const point: Vec3 = { x: 0, y: 0, z: 0 };
const normalColor = new Color();
const fireColor = new Color();

export function Airflow({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const floors = useMemo(() => createAirflowLayout(config, layout), [config, layout]);
  const budget = particleBudgetPerFloor(floors.length);
  const total = budget * floors.length;
  const meshRef = useRef<InstancedMesh>(null);
  /** Давхар бүрийн урсгалын явц (зам дагуух хувь) — хурдаар хуримтлагдана */
  const progress = useRef<number[]>([]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null || reducedMotion) return;
    const snapshot = useLiveStore.getState().snapshot;
    const devices = snapshot?.devices ?? null;
    const emergency = snapshot?.control.emergency ?? null;
    normalColor.set(colors.airflow);
    fireColor.set(colors.status.critical);
    // Таб нуугдсаны дараах том delta-г хязгаарлана (бөөмс үсрэхгүй)
    const dt = Math.min(delta, 0.1);
    floors.forEach((floor, f) => {
      const airflow = floorAirflow(devices, config, floor.floorId);
      const count = particleCount(budget, airflow);
      const pathCount = floor.paths.length;
      // Яаралтай байдлын үед галын давхрын бөөмс улаан (§8.6; жишээ дүрслэл — утааны тархалт биш)
      const tint =
        emergencyFloorRole(floor.floorId, emergency, config) === 'fire' ? fireColor : normalColor;
      const meanLength =
        pathCount === 0 ? 1 : floor.paths.reduce((sum, p) => sum + p.length, 0) / pathCount;
      progress.current[f] =
        ((progress.current[f] ?? 0) + (dt * PARTICLE_MAX_SPEED * airflow) / meanLength) % 1;
      for (let i = 0; i < budget; i += 1) {
        const index = f * budget + i;
        if (i >= count || pathCount === 0) {
          scratch.scale.set(0, 0, 0);
        } else {
          const path = floor.paths[i % pathCount]!;
          pointOnPath(path.points, path.length, particlePhase(i) + progress.current[f]!, point);
          scratch.position.set(point.x, point.y, point.z);
          scratch.scale.set(1, 1, 1);
        }
        scratch.updateMatrix();
        mesh.setMatrixAt(index, scratch.matrix);
        mesh.setColorAt(index, tint);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    // `frameloop="demand"`: анимацитай үед дараагийн frame-ийг хүснэ
    state.invalidate();
  });

  return (
    <instancedMesh
      key={`airflow-${total}`}
      ref={meshRef}
      args={[undefined, undefined, total]}
      visible={!reducedMotion}
      // Сонгогдохгүй — мэдрэгч/давхрын click-ийг саадгүй (raycast-гүй)
      raycast={() => null}
      frustumCulled={false}
    >
      <sphereGeometry args={[PARTICLE_RADIUS, 6, 4]} />
      <meshBasicMaterial transparent opacity={0.7} depthWrite={false} />
    </instancedMesh>
  );
}
