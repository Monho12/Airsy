// Сонгосон давхрын таазаас дээш хэсгийг тайрах clipping plane (CLAUDE.md §8.6, D88). Зөвхөн handler-гүй, ирмэггүй
// материалд (агааржуулалтын төхөөрөмж) — raycast нь clipping-ийг тооцдоггүй тул сонгогддог объектод хэрэглэхгүй.
// Сонголт өөрчлөгдөхөд шинэ plane үүснэ; тоо нь үргэлж 1 тул материал дахин эмхэтгэгдэхгүй (зөвхөн uniform).
import { useMemo } from 'react';
import { Plane, Vector3 } from 'three';

import { useUiStore } from '@/store/uiStore';

import { selectedCeilingY } from './focusView';
import type { BuildingLayout } from './layout';

/** Сонголтгүй үед тайрахгүй — хангалттай өндөр тогтмол (барилга ≤ 20 × 3.6 м) */
const NO_CLIP = 1e5;

export function useCeilingClipPlanes(layout: BuildingLayout): Plane[] {
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const ceiling = selectedCeilingY(layout, selectedFloorId) ?? NO_CLIP;
  // Хадгалагдах цэг: −y + constant ≥ 0, өөрөөр хэлбэл y ≤ таазны өндөр
  return useMemo(() => [new Plane(new Vector3(0, -1, 0), ceiling)], [ceiling]);
}
