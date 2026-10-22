// 3D ↔ uiStore сонголт (CLAUDE.md §10.3, FR-B4). Сонголтын цорын ганц эх сурвалж нь `uiStore` —
// 3D өөрийн сонголтын төлөв хадгалахгүй; давхрын жагсаалттай ижил `selectFloor`/`hoverFloor`-ийг дуудна.
import type { ThreeEvent } from '@react-three/fiber';

import type { AreaId, FloorId } from '@/domain/types';
import { useUiStore } from '@/store/uiStore';

/**
 * Pointer дарсан ба суллах хооронд хэдэн px хөдөлбөл «чирэх» гэж үзэж сонголт хийхгүй.
 * Дараагийн алхмын эргүүлэх удирдлагатай зөрчилдөхгүй байхад (FR-B3).
 */
export const CLICK_DRAG_TOLERANCE_PX = 4;

export type FloorVisualState = 'selected' | 'hovered' | 'idle' | 'dimmed';

/** §8.6: сонгосон давхар тодорч, бусад нь бүдэгрэнэ; сонголтгүй үед бүгд ердийн. */
export function floorVisualState(
  floorId: FloorId,
  selectedFloorId: FloorId | null,
  hoveredFloorId: FloorId | null,
): FloorVisualState {
  if (floorId === selectedFloorId) return 'selected';
  if (floorId === hoveredFloorId) return 'hovered';
  return selectedFloorId === null ? 'idle' : 'dimmed';
}

/** Сонгоогүй давхрын хавтан (§8.6: «сонгоогүй давхрууд бүдэгрэнэ») */
export const DIMMED_SLAB_OPACITY = 0.35;
/**
 * Сонгосон давхрын тааз (дээд давхрын хавтан эсвэл дээвэр): таазанд өлгөгдсөн төхөөрөмж (FR-B6) тод харагдахаар
 * илүү тунгалаг.
 */
export const CEILING_SLAB_OPACITY = 0.1;

/**
 * Хавтангийн тунгалаг давхаргын opacity; `null` бол тунгалаг бус үндсэн хавтан. Тааз нь hover-оос ч давуу —
 * төхөөрөмж рүү заахад тааз дахин бүрхэгдэхгүй (hover-ийн хүрээний өнгө хэвээр). Hover хийсэн бүдэг давхар
 * тунгалаг бус болж тодорно (өмнөх зан төлөв).
 */
export function slabOverlayOpacity(visual: FloorVisualState, ceiling: boolean): number | null {
  if (ceiling) return CEILING_SLAB_OPACITY;
  return visual === 'dimmed' ? DIMMED_SLAB_OPACITY : null;
}

/**
 * Хавтан сонгосон давхрын тааз эсэх (`floorBelowId` — хавтангийн яг доорх давхар; дээврийн хавтанд хамгийн дээд
 * давхар). Таазанд өлгөгдсөн төхөөрөмж (§5.1.2, FR-B6) харагдахаар энэ хавтанг илүү тунгалаг зурна.
 */
export function isCeilingOfSelected(
  floorBelowId: FloorId | null,
  selectedFloorId: FloorId | null,
): boolean {
  return floorBelowId !== null && floorBelowId === selectedFloorId;
}

export function useIsCeilingOfSelected(floorBelowId: FloorId | null): boolean {
  return useUiStore((state) => isCeilingOfSelected(floorBelowId, state.selectedFloorId));
}

type FloorPointerEvent = Pick<ThreeEvent<PointerEvent>, 'stopPropagation'>;
type FloorClickEvent = Pick<ThreeEvent<MouseEvent>, 'stopPropagation' | 'delta'>;

/** Нэг давхрын харагдах төлөв ба pointer-ийн handler-ууд. */
export function useFloorInteraction(floorId: FloorId) {
  const visual = useUiStore((state) =>
    floorVisualState(floorId, state.selectedFloorId, state.hoveredFloorId),
  );
  const selectFloor = useUiStore((state) => state.selectFloor);
  const hoverFloor = useUiStore((state) => state.hoverFloor);

  return {
    visual,
    // Хамгийн ойрын давхар л хариу өгнө (ард байгаа давхарт дамжихгүй)
    onClick: (event: FloorClickEvent) => {
      event.stopPropagation();
      if (event.delta > CLICK_DRAG_TOLERANCE_PX) return;
      selectFloor(floorId);
    },
    onPointerOver: (event: FloorPointerEvent) => {
      event.stopPropagation();
      hoverFloor(floorId);
    },
    onPointerOut: (event: FloorPointerEvent) => {
      event.stopPropagation();
      // Өөр давхар руу шилжсэн бол түүний hover-ийг арилгахгүй
      if (useUiStore.getState().hoveredFloorId === floorId) hoverFloor(null);
    },
  };
}

/** Бүс сонгогдсон эсэх (`selectedAreaId` нь 2D ба 3D-ийн нийтлэг сонголт, §10.3). */
export function useZoneSelected(areaId: AreaId): boolean {
  return useUiStore((state) => state.selectedAreaId === areaId);
}

type SensorNodeClickEvent = Pick<
  ThreeEvent<MouseEvent>,
  'stopPropagation' | 'delta' | 'instanceId'
>;

/**
 * Мэдрэгчийн зангилаа дээр дарах (FR-B5, UC-3, §8.6): `instanceId → areaId` хүснэгтээр бүсийг сонгоно.
 * Event ард байгаа давхрын хавтан руу ХЭЗЭЭ Ч дамжихгүй (чирсэн ч) — бүс ба давхрын сонголт тусдаа.
 * `selectArea` нь uiStore-ийн гэрээгээр давхрыг хамт сонгоно (§10.3).
 */
export function handleSensorNodeClick(
  event: SensorNodeClickEvent,
  areaIdAt: (instanceId: number | undefined) => AreaId | null,
  selectArea: (areaId: AreaId) => void,
): void {
  event.stopPropagation();
  if (event.delta > CLICK_DRAG_TOLERANCE_PX) return;
  const areaId = areaIdAt(event.instanceId);
  if (areaId !== null) selectArea(areaId);
}
