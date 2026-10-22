// Камерын удирдлага (CLAUDE.md FR-B3, §8.5, §10.3): хязгаартай эргүүлэх/ойртуулах (зөөхгүй), анхдагч харагдац,
// «Харагдацыг сэргээх» (`cameraResetToken`), сонгосон давхарт зөөлөн төвлөрөх. Хөдөлгөөн багасгах үед шууд үсэрнэ.
// Хэрэглэгч чирж эхлэхэд үргэлжилж буй хөдөлгөөн зогсоно — тасралтгүй/чимэглэлийн хөдөлгөөн байхгүй.
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from 'react';

import { useUiStore } from '@/store/uiStore';

import {
  cameraLimits,
  defaultCameraPose,
  floorFocusTarget,
  focusPose,
  settleDistance,
  stepCamera,
  type CameraPose,
} from './cameraMath';
import type { BuildingLayout } from './layout';

type Controls = ComponentRef<typeof OrbitControls>;

/**
 * `frameloop="demand"` үед зогссоны дараах анхны frame-ийн delta нь сүүлд зурснаас хойших бүх хугацаа —
 * хөдөлгөөний эхний frame-д түүний оронд ердийн нэг frame (60 fps) ашиглаж, эхэнд үсрэлтээс сэргийлнэ.
 */
const FIRST_FRAME_DELTA = 1 / 60;
/** Дараагийн frame-үүдэд бодит delta (fps бага ч бодит хугацаандаа дуусна); таб түр зогссон үеийн хязгаар */
const MAX_FRAME_DELTA = 0.1;

interface CameraMotion {
  pose: CameraPose;
  settle: number;
  started: boolean;
}

export function CameraRig({ layout }: { layout: BuildingLayout }) {
  const controlsRef = useRef<Controls>(null);
  const goalRef = useRef<CameraMotion | null>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const resetToken = useUiStore((state) => state.cameraResetToken);
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const limits = useMemo(() => cameraLimits(layout), [layout]);

  const readPose = (): CameraPose | null => {
    const controls = controlsRef.current;
    if (controls === null) return null;
    const { position } = camera;
    const { target } = controls;
    return {
      position: { x: position.x, y: position.y, z: position.z },
      target: { x: target.x, y: target.y, z: target.z },
    };
  };

  const applyPose = (pose: CameraPose) => {
    const controls = controlsRef.current;
    if (controls === null) return;
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    controls.target.set(pose.target.x, pose.target.y, pose.target.z);
    controls.update();
    invalidate();
  };

  /** Хөдөлгөөн багасгах үед шууд, бусад үед useFrame-ээр зөөлөн (§8.5) */
  const moveTo = (goal: CameraPose) => {
    const current = readPose();
    if (reducedMotion || current === null) {
      goalRef.current = null;
      applyPose(goal);
    } else {
      goalRef.current = { pose: goal, settle: settleDistance(current, goal), started: false };
      invalidate();
    }
  };

  // Анхдагч харагдац (layout өөрчлөгдөхөд ч — 6/12/20 давхар)
  useLayoutEffect(() => {
    goalRef.current = null;
    applyPose(defaultCameraPose(layout));
    // applyPose нь ref ба тогтвортой камер/invalidate-ийг л ашиглана
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Сонгосон давхарт төвлөрөх; сонголт цуцлагдахад камер хөдлөхгүй
  useEffect(() => {
    if (selectedFloorId === null) return;
    const current = readPose();
    const target = floorFocusTarget(layout, selectedFloorId);
    if (current !== null && target !== null) moveTo(focusPose(current, target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFloorId, layout]);

  // «Харагдацыг сэргээх» (§10.3) — эхний утгыг (0) үл тооно
  const initialResetToken = useRef(resetToken);
  useEffect(() => {
    if (resetToken === initialResetToken.current) return;
    moveTo(defaultCameraPose(layout));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useFrame((_, delta) => {
    const goal = goalRef.current;
    const current = goal === null ? null : readPose();
    if (goal === null || current === null) return;
    const dt = goal.started ? Math.min(delta, MAX_FRAME_DELTA) : FIRST_FRAME_DELTA;
    goal.started = true;
    const { pose, done } = stepCamera(current, goal.pose, dt, goal.settle);
    if (done) goalRef.current = null;
    applyPose(pose);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      // Чирсний дараах инерц нь нэмэлт хөдөлгөөн — хэрэглээгүй (§8.5)
      enableDamping={false}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
      minPolarAngle={limits.minPolarAngle}
      maxPolarAngle={limits.maxPolarAngle}
      onStart={() => {
        goalRef.current = null;
      }}
    />
  );
}
