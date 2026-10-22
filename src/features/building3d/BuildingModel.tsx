// Тохиргооноос зурсан барилга (CLAUDE.md §8.6, FR-B1, FR-B2, FR-B4): давхрын хавтан, бүсийн хавтгай,
// лифт/шатны хонгил (D59), урд-баруун cutaway-тай хагас тунгалаг нүүр, дээврийн хавтан. Зөвхөн дүрсэлнэ —
// domain логикгүй (§9.3-ын 5). Мэдрэгчийн зангилаа тусдаа `SensorNodes.tsx`-д; төхөөрөмж, агааржуулалтын суваг
// (shafts), дээврийн тоног төхөөрөмж дараагийн алхмуудад.
import { Edges } from '@react-three/drei';
import { DoubleSide } from 'three';

import type { FacadePanel, FloorLayout, ZoneLayout, BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';
import { useFloorInteraction, useZoneSelected, type FloorVisualState } from './selection';

/** Нүүр нь raycast-д оролцохгүй — ард байгаа давхрыг сонгоход саад болохгүй */
const ignoreRaycast = () => null;

const SLAB_OPACITY: Record<FloorVisualState, number> = {
  selected: 1,
  hovered: 1,
  idle: 1,
  dimmed: 0.35,
};

function Zone({
  zone,
  colors,
  floorVisual,
}: {
  zone: ZoneLayout;
  colors: SceneColors;
  floorVisual: FloorVisualState;
}) {
  const selected = useZoneSelected(zone.id);
  const highlighted = selected || floorVisual === 'selected';
  return (
    <mesh position={[zone.center.x, zone.center.y, zone.center.z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={zone.size} />
      <meshBasicMaterial
        color={highlighted ? colors.selected : colors.zone}
        transparent
        opacity={selected ? 0.4 : highlighted ? 0.16 : floorVisual === 'dimmed' ? 0.3 : 0.85}
        depthWrite={false}
      />
      {/* Бүс бүрийн хүрээ — хөрш бүсээс тод тусгаарлана */}
      <Edges color={selected ? colors.hovered : highlighted ? colors.selected : colors.slabEdge} />
    </mesh>
  );
}

function FloorSlab({ floor, colors }: { floor: FloorLayout; colors: SceneColors }) {
  const { visual, onClick, onPointerOver, onPointerOut } = useFloorInteraction(floor.id);
  const { center, size } = floor.slab;
  const edgeColor =
    visual === 'selected'
      ? colors.selected
      : visual === 'hovered'
        ? colors.hovered
        : colors.slabEdge;
  const opacity = SLAB_OPACITY[visual];

  return (
    <group
      name={floor.id}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <mesh position={[center.x, center.y, center.z]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={colors.slab}
          roughness={1}
          transparent={opacity < 1}
          opacity={opacity}
        />
        <Edges color={edgeColor} />
      </mesh>
      {floor.zones.map((zone) => (
        <Zone key={zone.id} zone={zone} colors={colors} floorVisual={visual} />
      ))}
    </group>
  );
}

function Facade({ panel, colors }: { panel: FacadePanel; colors: SceneColors }) {
  return (
    <mesh
      position={[panel.center.x, panel.center.y, panel.center.z]}
      rotation-y={panel.rotationY}
      raycast={ignoreRaycast}
    >
      <planeGeometry args={[panel.width, panel.height]} />
      <meshBasicMaterial
        color={colors.facade}
        transparent
        opacity={0.06}
        side={DoubleSide}
        depthWrite={false}
      />
      <Edges color={colors.facadeEdge} raycast={ignoreRaycast} />
    </mesh>
  );
}

export function BuildingModel({ layout, colors }: { layout: BuildingLayout; colors: SceneColors }) {
  const { roofSlab, core } = layout;
  return (
    <group>
      {layout.floors.map((floor) => (
        <FloorSlab key={floor.id} floor={floor} colors={colors} />
      ))}
      {/* Дээврийн хавтан (давхар биш, сонгогдохгүй) */}
      <mesh position={[roofSlab.center.x, roofSlab.center.y, roofSlab.center.z]}>
        <boxGeometry args={roofSlab.size} />
        <meshStandardMaterial color={colors.slab} roughness={1} />
        <Edges color={colors.slabEdge} />
      </mesh>
      {/* Лифт/шатны хонгил (D59) — сонгогдохгүй; event handler-гүй тул давхрын сонголтод саад болохгүй */}
      <mesh name="core" position={[core.center.x, core.center.y, core.center.z]}>
        <boxGeometry args={core.size} />
        <meshStandardMaterial color={colors.core} roughness={1} />
        <Edges color={colors.slabEdge} />
      </mesh>
      {layout.facade.map((panel) => (
        <Facade key={panel.side} panel={panel} colors={colors} />
      ))}
    </group>
  );
}
