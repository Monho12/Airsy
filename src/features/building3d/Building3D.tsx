// 3D digital twin-ийн canvas (CLAUDE.md §8.6, §11.3). Зөвхөн Building3DLoader-ээр lazy ачаалагдана (D57).
// Тохиргооноос зурсан барилга, uiStore-оор давхрын сонголт/hover, камерын удирдлага (CameraRig),
// мэдрэгчийн зангилаа (бүсийн сонголт). Төхөөрөмжийн загвар дараагийн алхамд нэмэгдэнэ.
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';

import { buildingConfig as defaultBuildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';

import { BuildingModel } from './BuildingModel';
import { CameraRig } from './CameraRig';
import { CAMERA_FOV_DEG, createBuildingLayout } from './layout';
import { readSceneColors } from './sceneColors';
import { SensorNodes } from './SensorNodes';
import type { Building3DProps } from './types';

import './Building3D.css';

/** Pixel ratio-ийн хязгаар (§11.3) */
const DPR_RANGE: [number, number] = [1, 1.75];

export function Building3D({ onFallback, config = defaultBuildingConfig }: Building3DProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [colors] = useState(readSceneColors);
  const layout = useMemo(() => createBuildingLayout(config), [config]);
  const { position } = layout.camera;

  // WebGL context алдагдвал орлуулах харагдац руу шилжинэ (§8.6, §11.3)
  useEffect(() => {
    if (canvas === null) return;
    const handleContextLost = () => onFallback('context-lost');
    canvas.addEventListener('webglcontextlost', handleContextLost);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost);
  }, [canvas, onFallback]);

  return (
    <div className="building3d" role="img" aria-label={mn.common.building3d.canvasLabel}>
      <Canvas
        dpr={DPR_RANGE}
        shadows={false}
        // Хэрэглэгчийн үйлдэл эсвэл камерын шилжилт байхад л зурна (§11.3)
        frameloop="demand"
        camera={{
          fov: CAMERA_FOV_DEG,
          near: 0.5,
          far: layout.height * 20,
          position: [position.x, position.y, position.z],
        }}
        onCreated={({ gl }) => setCanvas(gl.domElement)}
      >
        <color attach="background" args={[colors.background]} />
        {/* Сэрүүн ерөнхий гэрэл + нэг чиглэлтэй гол гэрэл, сүүдэргүй (§8.6) */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[30, 60, 40]} intensity={1.2} />
        <CameraRig layout={layout} />
        <BuildingModel layout={layout} colors={colors} />
        <SensorNodes config={config} layout={layout} colors={colors} />
      </Canvas>
    </div>
  );
}
