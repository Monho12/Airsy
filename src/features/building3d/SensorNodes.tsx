// Мэдрэгчийн зангилаа (CLAUDE.md §5.3, §8.6, FR-B5, UC-3): бүс бүрт нэг instanced бөмбөлөг, төлөвийн өнгөтэй.
// `instanceId → areaId` хүснэгтээр сонгоно (uiStore.selectArea); сонгосон нь accent цагираг, өгөгдлийн асуудалтай нь
// саарал цагираг. Дэлгэрэнгүй `Html` шошго нэг л удаа: сонгосон зангилаанд, сонголтгүй үед hover хийсэн зангилаанд
// (`detailLabelAreaId`). Хөдөлгөөнгүй (§8.5).
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, Object3D, Vector3, type Camera, type InstancedMesh } from 'three';

import { HealthIndicator, MetricValue } from '@/components/ui';
import { METRICS, type BuildingConfig } from '@/domain/config/building';
import { metricSpecs } from '@/domain/config/thresholds';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { AreaId, LiveSnapshot } from '@/domain/types';
import { useLiveStore } from '@/store/liveStore';
import { selectAreaSummary } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import { placeLabel, type Size } from './labelPlacement';
import type { BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';
import {
  areaIdAtInstance,
  createSensorNodes,
  detailLabelAreaId,
  sensorNodeStatuses,
  type SensorNodeLayout,
} from './sensorNodeData';
import { handleSensorNodeClick } from './selection';

/** Зангилааны радиус, м (дүрслэлийн хэмжээ) */
const NODE_RADIUS = 0.8;

// useLayoutEffect / frame бүрт шинэ объект үүсгэхгүй (§11.3)
const scratchObject = new Object3D();
const scratchColor = new Color();
const scratchVector = new Vector3();

function SensorNodeLabel({
  areaId,
  snapshot,
  config,
  onResize,
}: {
  areaId: AreaId;
  snapshot: LiveSnapshot;
  config: BuildingConfig;
  /** Шошгын бодит хэмжээ (px) — canvas дотор багтаах байрлалд */
  onResize: (size: Size) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Шошго Html-ийн тусдаа DOM root-д зурагддаг тул өөрийгөө хэмжиж мэдэгдэнэ (агуулга өөрчлөгдөхөд ч)
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box === null) return;
    const report = () => onResize({ width: box.offsetWidth, height: box.offsetHeight });
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(box);
    return () => observer.disconnect();
  }, [onResize]);

  const summary = selectAreaSummary(snapshot, areaId, config);
  if (summary === undefined) return null;
  const floor = config.floors[summary.area.floorId];
  return (
    <div className="sensor-label" ref={boxRef}>
      <p className="sensor-label__title">
        {floor !== undefined && `${floorLabelMn(floor.level)} · `}
        {summary.area.name}
      </p>
      <HealthIndicator {...summary.health} />
      <div className="sensor-label__metrics">
        {METRICS.map((metric) => (
          <MetricValue
            key={metric}
            label={mn.metrics.shortLabel[metric]}
            reading={summary.readings[metric]}
            decimals={metricSpecs[metric].decimals}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Зангилааны дэлгэрэнгүй шошго (§8.6). Байрлалыг Drei-ийн `calculatePosition`-оор тооцож canvas дотор
 * багтаана (`placeLabel`) — 5 утгыг (§5.3) хасахгүй, canvas-ийн хүрээнд таслагдахгүй.
 */
function NodeLabel({
  node,
  snapshot,
  config,
}: {
  node: SensorNodeLayout;
  snapshot: LiveSnapshot;
  config: BuildingConfig;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const sizeRef = useRef<Size>({ width: 0, height: 0 });

  const handleResize = useCallback(
    (size: Size) => {
      sizeRef.current = size;
      invalidate(); // `frameloop="demand"` — шинэ хэмжээгээр байрлалыг дахин тооцох frame
    },
    [invalidate],
  );

  const calculatePosition = useCallback((object: Object3D, camera: Camera, viewport: Size) => {
    // Drei-ийн анхдагч проекцтой ижил: зангилааны дэлгэцийн цэг
    scratchVector.setFromMatrixPosition(object.matrixWorld).project(camera);
    const anchor = {
      x: ((scratchVector.x + 1) * viewport.width) / 2,
      y: ((1 - scratchVector.y) * viewport.height) / 2,
    };
    const placement = placeLabel(anchor, sizeRef.current, viewport);
    return [placement.x, placement.y];
  }, []);

  return (
    <Html
      position={[node.position.x, node.position.y, node.position.z]}
      calculatePosition={calculatePosition}
      // Шошго canvas-ийн эргүүлэх/дарах үйлдэлд саад болохгүй
      pointerEvents="none"
    >
      <SensorNodeLabel
        areaId={node.areaId}
        snapshot={snapshot}
        config={config}
        onResize={handleResize}
      />
    </Html>
  );
}

export function SensorNodes({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  const nodes = useMemo(() => createSensorNodes(config, layout), [config, layout]);
  const snapshot = useLiveStore((state) => state.snapshot);
  const statuses = useMemo(
    () => sensorNodeStatuses(snapshot, nodes, config),
    [snapshot, nodes, config],
  );
  const selectedAreaId = useUiStore((state) => state.selectedAreaId);
  const selectArea = useUiStore((state) => state.selectArea);
  // Hover нь зөвхөн шошгыг харуулах түр зуурын дүрслэл — сонголт биш, uiStore-д хадгалахгүй
  const [hoveredAreaId, setHoveredAreaId] = useState<AreaId | null>(null);
  const meshRef = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);

  // Байрлал (тохиргоо өөрчлөгдөхөд л)
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    nodes.forEach((node, index) => {
      scratchObject.position.set(node.position.x, node.position.y, node.position.z);
      scratchObject.updateMatrix();
      mesh.setMatrixAt(index, scratchObject.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere(); // raycast зөв instance-ийг олно
    invalidate();
  }, [nodes, invalidate]);

  // Төлөвийн өнгө (snapshot өөрчлөгдөхөд)
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    statuses.forEach(({ status }, index) => {
      mesh.setColorAt(index, scratchColor.set(colors.status[status]));
    });
    if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [statuses, colors, invalidate]);

  const areaIdAt = (instanceId: number | undefined) => areaIdAtInstance(nodes, instanceId);
  // Нэг л дэлгэрэнгүй шошго: сонгосон бүс давуу, сонголтгүй үед hover (давхцахгүй)
  const labelAreaId = detailLabelAreaId(selectedAreaId, hoveredAreaId);
  const labelNode =
    labelAreaId === null ? undefined : nodes.find((node) => node.areaId === labelAreaId);

  return (
    <group name="sensor-nodes">
      <instancedMesh
        // instance-ийн тоо үүсгэх үед тогтдог — тоо өөрчлөгдвөл дахин үүсгэнэ
        key={nodes.length}
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onClick={(event) => handleSensorNodeClick(event, areaIdAt, selectArea)}
        onPointerMove={(event) => {
          event.stopPropagation();
          setHoveredAreaId(areaIdAt(event.instanceId));
        }}
        onPointerOut={() => setHoveredAreaId(null)}
      >
        <sphereGeometry args={[NODE_RADIUS, 16, 12]} />
        {/* Гэрэлгүй материал — төлөвийн өнгө гэрэлтэх мэт тод харагдана (§8.6) */}
        <meshBasicMaterial />
      </instancedMesh>

      {nodes.map((node, index) =>
        statuses[index]?.dataIssue ? (
          <mesh
            key={`issue-${node.areaId}`}
            position={[node.position.x, node.position.y, node.position.z]}
            rotation-x={-Math.PI / 2}
          >
            <torusGeometry args={[NODE_RADIUS * 1.5, 0.08, 8, 32]} />
            <meshBasicMaterial color={colors.status.offline} />
          </mesh>
        ) : null,
      )}

      {nodes.map((node) =>
        node.areaId === selectedAreaId ? (
          <mesh
            key={`selected-${node.areaId}`}
            position={[node.position.x, node.position.y, node.position.z]}
            rotation-x={-Math.PI / 2}
          >
            <torusGeometry args={[NODE_RADIUS * 2.1, 0.14, 8, 40]} />
            <meshBasicMaterial color={colors.selected} />
          </mesh>
        ) : null,
      )}

      {snapshot !== null && labelNode !== undefined && (
        // key: өөр бүс рүү шилжихэд шошгыг шинээр хэмжинэ
        <NodeLabel key={labelNode.areaId} node={labelNode} snapshot={snapshot} config={config} />
      )}
    </group>
  );
}
