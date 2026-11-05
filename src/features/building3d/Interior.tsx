// Давхрын дотоод бүтэц ба лифт/шатны хонгилын хуваалт (CLAUDE.md §8.6, D86, D87). Зөвхөн дүрслэл: сонгогдохгүй
// (raycast-гүй), шинэ өгөгдөлгүй. Хонгилын хуваалт бүх давхарт (1 draw call); өрөө, хана, хаалга, гарц ба шошго
// зөвхөн сонгосон давхарт (2 draw call; шошго нь DOM) — 12 давхарт бүгд зурвал урсгалын шугамтай будлиана.
import { Html } from '@react-three/drei';
import {
  ArrowUpDown,
  Archive,
  Bath,
  Briefcase,
  CookingPot,
  DoorOpen,
  Footprints,
  Laptop,
  Monitor,
  Server,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three';

import type { BuildingConfig } from '@/domain/config/building';
import { mn } from '@/domain/i18n/mn';
import { useUiStore } from '@/store/uiStore';

import {
  coreFaceLines,
  interiorLabels,
  selectedInteriorGeometry,
  type InteriorLabel,
  type InteriorLabelKind,
  type InteriorLineKind,
} from './interiorData';
import { selectedCeilingY } from './focusView';
import type { BuildingLayout } from './layout';
import type { SceneColors } from './sceneColors';

const ignoreRaycast = () => null;
/** Хананы дүүргэлт — шилэн нүүртэй ижил маш тунгалаг (§8.6; мэдрэгч, урсгалыг халхлахгүй) */
const WALL_OPACITY = 0.06;

function useDisposable<T extends { dispose(): void }>(value: T): T {
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

/** Хонгилын урд нүүрэн дээрх лифт, шатны хуваалт — бүх давхарт */
export function CoreDetails({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  // Сонгосон давхрын таазаас дээш шугам зурахгүй (D88) — хонгилын дээд хэсэг сүүдэр
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const maxY = selectedCeilingY(layout, selectedFloorId);
  const geometry = useDisposable(
    useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(coreFaceLines(config, layout, maxY), 3));
      return g;
    }, [config, layout, maxY]),
  );
  return (
    <lineSegments geometry={geometry} raycast={ignoreRaycast}>
      <lineBasicMaterial color={colors.deviceFrame} />
    </lineSegments>
  );
}

/** Сонгосон давхрын өрөө, хана, коридор, хаалга, яаралтай гарц; давхар сонгоогүй үед юу ч зурахгүй */
export function FloorInterior({
  config,
  layout,
  colors,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
  colors: SceneColors;
}) {
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const data = useMemo(
    () => selectedInteriorGeometry(config, layout, selectedFloorId),
    [config, layout, selectedFloorId],
  );

  const walls = useDisposable(
    useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(data?.wallTriangles ?? new Float32Array(), 3));
      return g;
    }, [data]),
  );

  // Шугамын гурван бүлгийг нэг geometry-д өнгөөр (vertex color) нэгтгэнэ — 1 draw call
  const lines = useDisposable(
    useMemo(() => {
      const g = new BufferGeometry();
      if (data === null) return g;
      const kindColors: Record<InteriorLineKind, Color> = {
        wall: new Color(colors.deviceFrame),
        door: new Color(colors.deviceActive),
        exit: new Color(colors.exit),
      };
      const kinds = Object.keys(kindColors) as InteriorLineKind[];
      const total = kinds.reduce((sum, kind) => sum + data.lines[kind].length, 0);
      const position = new Float32Array(total);
      const color = new Float32Array(total);
      let offset = 0;
      for (const kind of kinds) {
        const part = data.lines[kind];
        position.set(part, offset);
        const c = kindColors[kind];
        for (let i = 0; i < part.length; i += 3) color.set([c.r, c.g, c.b], offset + i);
        offset += part.length;
      }
      g.setAttribute('position', new BufferAttribute(position, 3));
      g.setAttribute('color', new BufferAttribute(color, 3));
      return g;
    }, [data, colors]),
  );

  if (data === null) return null;
  return (
    <group name="floor-interior">
      <mesh geometry={walls} raycast={ignoreRaycast}>
        <meshBasicMaterial
          color={colors.facade}
          transparent
          opacity={WALL_OPACITY}
          side={DoubleSide}
          // Тунгалаг хоёр талт материалыг three анхдагчаар 2 дамжлагаар зурдаг — маш тунгалаг хананд 1 хангалттай
          forceSinglePass
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={lines} raycast={ignoreRaycast}>
        <lineBasicMaterial vertexColors transparent opacity={0.8} />
      </lineSegments>
    </group>
  );
}

const text = mn.common.building3d.interior;

const LABEL_ICONS: Record<InteriorLabelKind, LucideIcon> = {
  meeting: Users,
  director: Briefcase,
  workroom: Laptop,
  storage: Archive,
  server: Server,
  restroom: Bath,
  kitchen: CookingPot,
  lift: ArrowUpDown,
  stair: Footprints,
  exit: DoorOpen,
  office: Monitor,
};

function labelText(label: InteriorLabel, config: BuildingConfig): string {
  switch (label.kind) {
    case 'meeting':
      return text.meeting(label.number);
    case 'office':
      return (label.areaId !== null && config.areas[label.areaId]?.name) || '';
    case 'exit':
      return text.exit;
    default:
      return text[label.kind];
  }
}

/**
 * Сонгосон давхрын таних тэмдэг (D87): өрөө, лифт, шат, нээлттэй оффис ба неон ногоон «EXIT». Мэдрэгчийн дэлгэрэнгүй
 * шошго нээгдсэн үед (бүс сонгогдсон, D62) давхцахгүйн тулд нуугдана. Чимэглэлийн (aria-hidden) — мэдээллийг 2D
 * самбар өгнө; гарцын тэмдэг дэлгэц уншигчид Монголоор (`aria-label`).
 */
export function InteriorLabels({
  config,
  layout,
}: {
  config: BuildingConfig;
  layout: BuildingLayout;
}) {
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const selectedAreaId = useUiStore((state) => state.selectedAreaId);
  const labels = useMemo(
    () => interiorLabels(config, layout, selectedFloorId),
    [config, layout, selectedFloorId],
  );
  if (selectedAreaId !== null) return null;
  return (
    <>
      {labels.map((label) => {
        const Icon = LABEL_ICONS[label.kind];
        const exit = label.kind === 'exit';
        return (
          <Html
            key={label.key}
            position={[label.position.x, label.position.y, label.position.z]}
            center
            pointerEvents="none"
            // Мэдрэгчийн шошгоос доор (Drei-ийн анхдагч zIndex 16777271…0)
            zIndexRange={[100, 0]}
          >
            <span
              className={exit ? 'interior-label interior-label--exit' : 'interior-label'}
              aria-label={exit ? text.exitLabel : undefined}
              aria-hidden={exit ? undefined : true}
            >
              <Icon size={12} aria-hidden="true" />
              {labelText(label, config)}
            </span>
          </Html>
        );
      })}
    </>
  );
}
