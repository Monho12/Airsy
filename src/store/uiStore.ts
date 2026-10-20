// UI төлөвийн гэрээ (CLAUDE.md §10.3). Симуляцид хэзээ ч нөлөөлөхгүй — зөвхөн сонголт ба харагдац.
import { create } from 'zustand';

import type { AreaId, FloorId } from '@/domain/types';

export interface UiState {
  selectedFloorId: FloorId | null; // 3D ба давхрын жагсаалт хоёулаа уншиж/бичнэ (FR-B4)
  selectedAreaId: AreaId | null; // үргэлж selectedFloorId-д хамаарна
  hoveredFloorId: FloorId | null;
  reducedMotionOverride: boolean | null; // null = системийн prefers-reduced-motion-ыг дагана
  reducedMotion: boolean; // эцсийн утга (override ?? системийн тохиргоо)
  cameraResetToken: number; // «Харагдацыг сэргээх» бүрт +1
}

export interface UiActions {
  selectFloor: (floorId: FloorId | null) => void;
  /** Бүсийг сонгоход түүний давхрыг хамт сонгоно; `null` нь давхрын сонголтыг хадгалж бүсийн сонголтыг цуцална. */
  selectArea: (areaId: AreaId | null) => void;
  hoverFloor: (floorId: FloorId | null) => void;
  setReducedMotionOverride: (value: boolean | null) => void;
  /** Системийн prefers-reduced-motion өөрчлөгдөхөд app давхарга дуудна. */
  setSystemReducedMotion: (value: boolean) => void;
  requestCameraReset: () => void;
}

export type UiStore = UiState & UiActions & { systemReducedMotion: boolean };

/** `{floorId}-{үсэг}` дүрмээр (§5.2) бүсийн ID-аас давхрын ID-г гаргана. */
export function floorIdOfArea(areaId: AreaId): FloorId {
  const separator = areaId.lastIndexOf('-');
  if (separator <= 0) throw new Error(`Бүсийн ID буруу: ${areaId}`);
  return areaId.slice(0, separator);
}

export const initialUiState: UiState & { systemReducedMotion: boolean } = {
  selectedFloorId: null,
  selectedAreaId: null,
  hoveredFloorId: null,
  reducedMotionOverride: null,
  reducedMotion: false,
  systemReducedMotion: false,
  cameraResetToken: 0,
};

export const useUiStore = create<UiStore>()((set) => ({
  ...initialUiState,

  selectFloor: (floorId) =>
    set((state) => ({
      selectedFloorId: floorId,
      // Өөр давхар сонгоход бүсийн сонголт цэвэрлэгдэнэ (§10.3)
      selectedAreaId: floorId === state.selectedFloorId ? state.selectedAreaId : null,
    })),

  selectArea: (areaId) =>
    set(
      areaId === null
        ? { selectedAreaId: null }
        : { selectedAreaId: areaId, selectedFloorId: floorIdOfArea(areaId) },
    ),

  hoverFloor: (floorId) => set({ hoveredFloorId: floorId }),

  setReducedMotionOverride: (value) =>
    set((state) => ({
      reducedMotionOverride: value,
      reducedMotion: value ?? state.systemReducedMotion,
    })),

  setSystemReducedMotion: (value) =>
    set((state) => ({
      systemReducedMotion: value,
      reducedMotion: state.reducedMotionOverride ?? value,
    })),

  requestCameraReset: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),
}));
