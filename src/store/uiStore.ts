// UI төлөвийн гэрээ (CLAUDE.md §10.3). Симуляцид хэзээ ч нөлөөлөхгүй — зөвхөн сонголт ба харагдац.
import { create } from 'zustand';

import type {
  Alert,
  AreaId,
  FloorId,
  MetricType,
  RoomScenarioId,
  Severity,
  SystemEvent,
} from '@/domain/types';

/**
 * Дохионы шүүлт (FR-A2, Phase 6d, D83). `status: 'open'` = идэвхтэй + хүлээн авсан (анхдагч — ажиллаж буй дохио);
 * `floor: 'building'` = давхаргүй (барилгын түвшний ба гадна мэдрэгчийн) дохио.
 */
export interface AlertFilter {
  severity: 'all' | Alert['severity'];
  floor: 'all' | 'building' | FloorId;
  metric: 'all' | MetricType;
  status: 'open' | 'active' | 'acknowledged' | 'resolved';
}

/** Үйл явдлын түүхийн шүүлт (FR-A3, Phase 6d, D83) */
export interface EventFilter {
  category: 'all' | SystemEvent['category'];
  severity: 'all' | Severity;
  floor: 'all' | FloorId;
}

export const defaultAlertFilter: AlertFilter = {
  severity: 'all',
  floor: 'all',
  metric: 'all',
  status: 'open',
};

export const defaultEventFilter: EventFilter = { category: 'all', severity: 'all', floor: 'all' };

/** Баталгаажуулалт хүлээж буй өрөөний сценари (D81, D99) — 3D шошго ба самбар хоёулаа нэг dialog-оор */
export interface PendingRoomScenario {
  scenarioId: RoomScenarioId;
  areaId: AreaId;
}

export interface UiState {
  selectedFloorId: FloorId | null; // 3D ба давхрын жагсаалт хоёулаа уншиж/бичнэ (FR-B4)
  selectedAreaId: AreaId | null; // үргэлж selectedFloorId-д хамаарна
  hoveredFloorId: FloorId | null;
  reducedMotionOverride: boolean | null; // null = системийн prefers-reduced-motion-ыг дагана
  reducedMotion: boolean; // эцсийн утга (override ?? системийн тохиргоо)
  cameraResetToken: number; // «Харагдацыг сэргээх» бүрт +1
  alertFilter: AlertFilter; // §10.2: шүүлт нь UI төлөв (D83)
  eventFilter: EventFilter;
  pendingRoomScenario: PendingRoomScenario | null;
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
  /** Шүүлтийн зөвхөн өгсөн талбаруудыг өөрчилнө (D83) */
  setAlertFilter: (patch: Partial<AlertFilter>) => void;
  setEventFilter: (patch: Partial<EventFilter>) => void;
  /** Өрөөний сценарийн баталгаажуулалтыг нээх (`null` — хаах) */
  setPendingRoomScenario: (pending: PendingRoomScenario | null) => void;
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
  alertFilter: defaultAlertFilter,
  eventFilter: defaultEventFilter,
  pendingRoomScenario: null,
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

  setAlertFilter: (patch) => set((state) => ({ alertFilter: { ...state.alertFilter, ...patch } })),
  setEventFilter: (patch) => set((state) => ({ eventFilter: { ...state.eventFilter, ...patch } })),
  setPendingRoomScenario: (pending) => set({ pendingRoomScenario: pending }),
}));
