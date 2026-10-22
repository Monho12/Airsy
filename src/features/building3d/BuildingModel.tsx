// Тохиргооноос зурсан барилга (CLAUDE.md §8.6, FR-B1, FR-B2, FR-B4): давхрын хавтан, бүсийн хавтгай,
// лифт/шатны хонгил (D59), урд-баруун cutaway-тай хагас тунгалаг нүүр, дээврийн хавтан ба тоног төхөөрөмж.
// Зөвхөн дүрсэлнэ — domain логикгүй (§9.3-ын 5). Мэдрэгчийн зангилаа `SensorNodes.tsx`-д, төхөөрөмж
// `DeviceModels.tsx`-д.
import { Edges } from '@react-three/drei';
import { DoubleSide } from 'three';

import type { FloorId, Vec3 } from '@/domain/types';

import type {
  BuildingLayout,
  FacadePanel,
  FloorLayout,
  RoofEquipmentLayout,
  ZoneLayout,
} from './layout';
import type { SceneColors } from './sceneColors';
import {
  CEILING_SLAB_OPACITY,
  slabOverlayOpacity,
  useFloorInteraction,
  useIsCeilingOfSelected,
  useZoneSelected,
  type FloorVisualState,
} from './selection';

/** Нүүр нь raycast-д оролцохгүй — ард байгаа давхрыг сонгоход саад болохгүй */
const ignoreRaycast = () => null;

/** Сонгосон давхрын таазны бүсийн хавтгай — хавтантай хамт тунгалаг (FR-B6) */
const CEILING_ZONE_OPACITY = 0.06;

/**
 * Хавтангийн тунгалаг давхарга (бүдэгрүүлсэн давхар, сонгосон давхрын тааз). three нь `transparent: false`
 * материалыг `OPAQUE` (alpha = 1) шейдерээр эмхэтгэж, дараа нь `transparent`-ийг сольсон ч програмыг дахин
 * эмхэтгэдэггүй. Тиймээс үндсэн хавтангийн материал үргэлж тунгалаг бус хэвээр (зөвхөн `visible={false}`), харин
 * энэ давхарга анхнаасаа тунгалаг — opacity-г нь л сольж болно. Сонгогдохгүй (raycast-гүй) — давхрын click/hover
 * үндсэн хавтангаар хэвээр. `depthWrite: false` — ард байгаа тунгалаг объект (бүс, нүүр)-ийг далдлахгүй.
 */
function SlabOverlay({
  center,
  size,
  opacity,
  colors,
}: {
  center: Vec3;
  size: [number, number, number];
  opacity: number;
  colors: SceneColors;
}) {
  return (
    <mesh position={[center.x, center.y, center.z]} raycast={ignoreRaycast}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={colors.slab}
        roughness={1}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}

function Zone({
  zone,
  colors,
  floorVisual,
  ceiling,
}: {
  zone: ZoneLayout;
  colors: SceneColors;
  floorVisual: FloorVisualState;
  ceiling: boolean;
}) {
  const selected = useZoneSelected(zone.id);
  const highlighted = selected || floorVisual === 'selected';
  const opacity = selected
    ? 0.4
    : highlighted
      ? 0.16
      : ceiling
        ? CEILING_ZONE_OPACITY
        : floorVisual === 'dimmed'
          ? 0.3
          : 0.85;
  return (
    <mesh position={[zone.center.x, zone.center.y, zone.center.z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={zone.size} />
      <meshBasicMaterial
        color={highlighted ? colors.selected : colors.zone}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
      {/* Бүс бүрийн хүрээ — хөрш бүсээс тод тусгаарлана */}
      <Edges color={selected ? colors.hovered : highlighted ? colors.selected : colors.slabEdge} />
    </mesh>
  );
}

function FloorSlab({
  floor,
  floorBelowId,
  colors,
}: {
  floor: FloorLayout;
  /** Энэ хавтангийн яг доорх давхар (1-р давхарт `null`) */
  floorBelowId: FloorId | null;
  colors: SceneColors;
}) {
  const { visual, onClick, onPointerOver, onPointerOut } = useFloorInteraction(floor.id);
  const ceiling = useIsCeilingOfSelected(floorBelowId);
  const { center, size } = floor.slab;
  const edgeColor =
    visual === 'selected'
      ? colors.selected
      : visual === 'hovered'
        ? colors.hovered
        : colors.slabEdge;
  const overlayOpacity = slabOverlayOpacity(visual, ceiling);

  return (
    <group
      name={floor.id}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <mesh position={[center.x, center.y, center.z]}>
        <boxGeometry args={size} />
        {/* Үргэлж тунгалаг бус; тунгалаг үед материалыг нууна (raycast ба хүрээ хэвээр) — оронд нь SlabOverlay */}
        <meshStandardMaterial color={colors.slab} roughness={1} visible={overlayOpacity === null} />
        <Edges color={edgeColor} />
      </mesh>
      {overlayOpacity !== null && (
        <SlabOverlay center={center} size={size} opacity={overlayOpacity} colors={colors} />
      )}
      {floor.zones.map((zone) => (
        <Zone key={zone.id} zone={zone} colors={colors} floorVisual={visual} ceiling={ceiling} />
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

/** Цаг агаарын станцын шон ба толгойн радиус, м (дүрслэлийн хэмжээ) */
const MAST_RADIUS = 0.08;
const STATION_HEAD_RADIUS = 0.35;

/**
 * Дээврийн тоног төхөөрөмж (§5.1, §8.6): агааржуулалтын блок ба гадна цаг агаарын станц. Зөвхөн дүрслэл
 * (§5.7) — сонгогдохгүй, handler-гүй тул давхрын сонголтод саад болохгүй.
 */
function RoofEquipment({ roof, colors }: { roof: RoofEquipmentLayout; colors: SceneColors }) {
  const { mast, head } = roof.weatherStation;
  return (
    <group name="roof-equipment">
      {roof.units.map((unit) => (
        <mesh key={unit.id} position={[unit.center.x, unit.center.y, unit.center.z]}>
          <boxGeometry args={unit.size} />
          <meshStandardMaterial color={colors.core} roughness={1} />
          <Edges color={colors.slabEdge} />
        </mesh>
      ))}
      <mesh position={[mast.center.x, mast.center.y, mast.center.z]}>
        <cylinderGeometry args={[MAST_RADIUS, MAST_RADIUS, mast.height, 8]} />
        <meshBasicMaterial color={colors.deviceFrame} />
      </mesh>
      <mesh position={[head.x, head.y, head.z]}>
        <sphereGeometry args={[STATION_HEAD_RADIUS, 16, 12]} />
        <meshBasicMaterial color={colors.deviceFrame} />
      </mesh>
    </group>
  );
}

/** Дээврийн хавтан (давхар биш, сонгогдохгүй); хамгийн дээд давхар сонгогдсон үед түүний тааз */
function RoofSlab({
  slab,
  topFloorId,
  colors,
}: {
  slab: BuildingLayout['roofSlab'];
  topFloorId: FloorId | null;
  colors: SceneColors;
}) {
  const ceiling = useIsCeilingOfSelected(topFloorId);
  return (
    <>
      <mesh position={[slab.center.x, slab.center.y, slab.center.z]}>
        <boxGeometry args={slab.size} />
        <meshStandardMaterial color={colors.slab} roughness={1} visible={!ceiling} />
        <Edges color={colors.slabEdge} />
      </mesh>
      {ceiling && (
        <SlabOverlay
          center={slab.center}
          size={slab.size}
          opacity={CEILING_SLAB_OPACITY}
          colors={colors}
        />
      )}
    </>
  );
}

export function BuildingModel({ layout, colors }: { layout: BuildingLayout; colors: SceneColors }) {
  const { roofSlab, core, floors } = layout;
  return (
    <group>
      {floors.map((floor, index) => (
        <FloorSlab
          key={floor.id}
          floor={floor}
          floorBelowId={floors[index - 1]?.id ?? null}
          colors={colors}
        />
      ))}
      <RoofSlab slab={roofSlab} topFloorId={floors.at(-1)?.id ?? null} colors={colors} />
      <RoofEquipment roof={layout.roofEquipment} colors={colors} />
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
