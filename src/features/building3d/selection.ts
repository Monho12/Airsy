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

/**
 * `ghost` — сонгосон давхрын **дээрх** давхар (D88): маш бүдэг сүүдэр, зөвхөн хавтангийн контур чиг баримжаа өгнө;
 * мэдрэгч, төхөөрөмж, урсгал нуугдана; сонгогдохгүй (raycast-гүй) — дээрээс харахад доорх сонгосон давхрыг халхлахгүй.
 */
export type FloorVisualState = 'selected' | 'hovered' | 'idle' | 'dimmed' | 'ghost';

/** Давхрын түвшин ID-аас (§5.2: `F` + 2 оронтой түвшин) */
export const floorLevelOf = (floorId: FloorId): number => Number(floorId.slice(1));

/** Давхар сонгосон давхрын дээр байгаа эсэх (D88) */
export function isAboveSelected(floorId: FloorId, selectedFloorId: FloorId | null): boolean {
  return selectedFloorId !== null && floorLevelOf(floorId) > floorLevelOf(selectedFloorId);
}

export function useIsAboveSelected(floorId: FloorId): boolean {
  return useUiStore((state) => isAboveSelected(floorId, state.selectedFloorId));
}

/** §8.6: сонгосон давхар тодорч, доорх нь бүдэгрэнэ, дээрх нь сүүдэр (D88); сонголтгүй үед бүгд ердийн. */
export function floorVisualState(
  floorId: FloorId,
  selectedFloorId: FloorId | null,
  hoveredFloorId: FloorId | null,
): FloorVisualState {
  if (floorId === selectedFloorId) return 'selected';
  if (isAboveSelected(floorId, selectedFloorId)) return 'ghost';
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
/** Сонгосон давхрын дээрх давхрын хавтан (D88) — бараг үл үзэгдэх, контур л чиг баримжаа өгнө */
export const GHOST_SLAB_OPACITY = 0.04;

/**
 * Хавтангийн тунгалаг давхаргын opacity; `null` бол тунгалаг бус үндсэн хавтан. Тааз нь hover-оос ч давуу —
 * төхөөрөмж рүү заахад тааз дахин бүрхэгдэхгүй (hover-ийн хүрээний өнгө хэвээр). Hover хийсэн бүдэг давхар
 * тунгалаг бус болж тодорно (өмнөх зан төлөв).
 */
export function slabOverlayOpacity(visual: FloorVisualState, ceiling: boolean): number | null {
  // Сонгосон давхрын тааз нь дээрх давхрын хавтан — сүүдэр давуу (D88); дээврийн хавтан л таазаар үлдэнэ
  if (visual === 'ghost') return GHOST_SLAB_OPACITY;
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
