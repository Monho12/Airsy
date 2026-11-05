// 3D digital twin-ийн canvas (CLAUDE.md §8.6, §11.3). Зөвхөн Building3DLoader-ээр lazy ачаалагдана (D57).
// Тохиргооноос зурсан барилга, uiStore-оор давхрын сонголт/hover, камерын удирдлага (CameraRig),
// мэдрэгчийн зангилаа (бүсийн сонголт), агааржуулалтын төхөөрөмж (FR-B6) ба анимаци + агаарын урсгал (FR-B8, Phase 5),
// давхрын дотоод бүтэц ба лифт/шатны хуваалт (D86).
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';

import { buildingConfig as defaultBuildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';

import { Airflow } from './Airflow';
import { BuildingModel } from './BuildingModel';
import { CameraRig } from './CameraRig';
import { DeviceModels } from './DeviceModels';
import { CoreDetails, FloorInterior, InteriorLabels } from './Interior';
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
        // Хэрэглэгчийн үйлдэл, камерын шилжилт эсвэл төхөөрөмжийн анимаци байхад л зурна (§11.3).
        // Анимаци `useFrame` дотроос `invalidate()`-ээр frame хүснэ; хөдөлгөөн багасгах үед зогсоно (§8.5).
        frameloop="demand"
        camera={{
          fov: CAMERA_FOV_DEG,
          near: 0.5,
          far: layout.height * 20,
          position: [position.x, position.y, position.z],
        }}
        onCreated={({ gl }) => {
          // Материал тус бүрийн clipping plane (D88: сонгосон давхрын дээрх төхөөрөмжийг тайрах)
          gl.localClippingEnabled = true;
          setCanvas(gl.domElement);
        }}
      >
        <color attach="background" args={[colors.background]} />
        {/* Сэрүүн ерөнхий гэрэл + нэг чиглэлтэй гол гэрэл, сүүдэргүй (§8.6) */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[30, 60, 40]} intensity={1.2} />
        <CameraRig layout={layout} />
        <BuildingModel layout={layout} config={config} colors={colors} />
        {/* Лифт/шатны хуваалт (бүх давхарт) ба сонгосон давхрын өрөө, хана, гарц (D86) */}
        <CoreDetails config={config} layout={layout} colors={colors} />
        <FloorInterior config={config} layout={layout} colors={colors} />
        <InteriorLabels config={config} layout={layout} />
        <SensorNodes config={config} layout={layout} colors={colors} />
        <DeviceModels config={config} layout={layout} colors={colors} />
        <Airflow config={config} layout={layout} colors={colors} />
      </Canvas>
    </div>
  );
}
