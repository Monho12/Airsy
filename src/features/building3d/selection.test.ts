// 3D ↔ uiStore сонголт (FR-B4, §10.3). WebGL-гүйгээр: 3D-ийн handler ба харагдах төлөвийг hook-оор шалгана.
// Давхрын жагсаалт ижил `selectFloor`-ийг дууддаг тул store-оор дамжин хоёр чиглэлд синк болно.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { createBuildingLayout } from './layout';
import {
  CEILING_SLAB_OPACITY,
  CLICK_DRAG_TOLERANCE_PX,
  DIMMED_SLAB_OPACITY,
  floorVisualState,
  handleSensorNodeClick,
  isCeilingOfSelected,
  slabOverlayOpacity,
  useFloorInteraction,
  useIsCeilingOfSelected,
  useZoneSelected,
} from './selection';
import { areaIdAtInstance, createSensorNodes } from './sensorNodeData';

const [F01, F02] = buildingConfig.building.floorIds as [string, string];
const [F01_A, F01_B] = buildingConfig.floors[F01]!.areaIds as [string, string];

const pointer = () => ({ stopPropagation: vi.fn() });
const click = (delta = 0) => ({ stopPropagation: vi.fn(), delta });

beforeEach(() => {
  useUiStore.setState(initialUiState);
});

describe('floorVisualState (§8.6)', () => {
  it.each([
    [null, null, 'idle'],
    [F01, null, 'selected'],
    [F02, null, 'dimmed'],
    [null, F01, 'hovered'],
    [F02, F01, 'hovered'],
    [F01, F01, 'selected'],
  ] as const)('сонгосон=%s, hover=%s → %s', (selected, hovered, expected) => {
    expect(floorVisualState(F01, selected, hovered)).toBe(expected);
  });
});

describe('slabOverlayOpacity — хавтангийн тунгалаг байдал (§8.6, FR-B6)', () => {
  it.each([
    ['idle', false, null],
    ['selected', false, null],
    ['hovered', false, null], // hover хийсэн бүдэг давхар тунгалаг бус болж тодорно
    ['dimmed', false, DIMMED_SLAB_OPACITY],
    ['dimmed', true, CEILING_SLAB_OPACITY],
    ['hovered', true, CEILING_SLAB_OPACITY], // тааз hover-оос давуу — төхөөрөмж далдлагдахгүй
  ] as const)('%s, тааз=%s → %s', (visual, ceiling, expected) => {
    expect(slabOverlayOpacity(visual, ceiling)).toBe(expected);
  });

  it('тааз бүдэг давхраас илүү тунгалаг; хоёулаа 0–1 хооронд', () => {
    expect(CEILING_SLAB_OPACITY).toBeLessThan(DIMMED_SLAB_OPACITY);
    expect(CEILING_SLAB_OPACITY).toBeGreaterThan(0);
    expect(DIMMED_SLAB_OPACITY).toBeLessThan(1);
  });

  it('сонголтгүй үед ямар ч хавтан тунгалаг биш; сонголттой үед зөвхөн сонгосон давхар тунгалаг бус', () => {
    const ids = buildingConfig.building.floorIds;
    const overlays = (selected: string | null) =>
      ids.map((id, i) =>
        slabOverlayOpacity(
          floorVisualState(id, selected, null),
          isCeilingOfSelected(ids[i - 1] ?? null, selected),
        ),
      );
    expect(overlays(null).every((o) => o === null)).toBe(true);
    const withF07 = overlays('F07');
    expect(withF07.filter((o) => o === null)).toHaveLength(1);
    expect(withF07[ids.indexOf('F07')]).toBeNull();
    expect(withF07[ids.indexOf('F08')]).toBe(CEILING_SLAB_OPACITY);
    expect(withF07.filter((o) => o === DIMMED_SLAB_OPACITY)).toHaveLength(ids.length - 2);
  });
});

describe('isCeilingOfSelected — сонгосон давхрын тааз (FR-B6)', () => {
  it.each([
    [F01, F01, true], // F02-ийн хавтан (доор нь F01) — F01 сонгогдсон
    [F01, F02, false], // F02 сонгогдсон — түүний тааз нь F03-ийн хавтан
    [F01, null, false], // сонголтгүй — бүх хавтан хэвээр
    [null, F01, false], // 1-р давхрын хавтан хэзээ ч тааз биш
    [null, null, false],
  ] as const)('доорх давхар=%s, сонгосон=%s → %s', (below, selected, expected) => {
    expect(isCeilingOfSelected(below, selected)).toBe(expected);
  });

  it('uiStore-ийн сонголтыг дагана — яг нэг тааз (дээд давхарт дээврийн хавтан)', () => {
    const ids = buildingConfig.building.floorIds;
    const top = ids.at(-1)!;
    // Хавтан бүрийн доорх давхар (давхрын хавтангууд, дараа нь дээвэр)
    const belows = [...ids.map((_, i) => ids[i - 1] ?? null), top];
    for (const selected of [ids[0]!, ids[5]!, top]) {
      act(() => useUiStore.getState().selectFloor(selected));
      const ceilings = belows.filter((below) => {
        const { result } = renderHook(() => useIsCeilingOfSelected(below));
        return result.current;
      });
      expect(ceilings).toEqual([selected]);
    }
  });
});

describe('3D → uiStore', () => {
  it('давхар дээр дарахад нийтлэг сонголт шинэчлэгдэж, ард байгаа давхарт дамжихгүй', () => {
    const { result } = renderHook(() => useFloorInteraction(F02));
    const event = click();
    act(() => result.current.onClick(event));
    expect(useUiStore.getState().selectedFloorId).toBe(F02);
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it('чирэх (хөдөлгөөн > хүлцэл) сонголт хийхгүй', () => {
    const { result } = renderHook(() => useFloorInteraction(F02));
    act(() => result.current.onClick(click(CLICK_DRAG_TOLERANCE_PX + 1)));
    expect(useUiStore.getState().selectedFloorId).toBeNull();
    act(() => result.current.onClick(click(CLICK_DRAG_TOLERANCE_PX)));
    expect(useUiStore.getState().selectedFloorId).toBe(F02);
  });

  it('hover нь hoveredFloorId-ийг тавьж, гарахад арилгана', () => {
    const { result } = renderHook(() => useFloorInteraction(F01));
    act(() => result.current.onPointerOver(pointer()));
    expect(useUiStore.getState().hoveredFloorId).toBe(F01);
    expect(result.current.visual).toBe('hovered');
    act(() => result.current.onPointerOut(pointer()));
    expect(useUiStore.getState().hoveredFloorId).toBeNull();
  });

  it('өөр давхар руу шилжсэн hover-ийг өмнөх давхрын pointer-out арилгахгүй', () => {
    const first = renderHook(() => useFloorInteraction(F01));
    const second = renderHook(() => useFloorInteraction(F02));
    act(() => first.result.current.onPointerOver(pointer()));
    act(() => second.result.current.onPointerOver(pointer()));
    act(() => first.result.current.onPointerOut(pointer()));
    expect(useUiStore.getState().hoveredFloorId).toBe(F02);
  });

  it('давхар дээр дарах нь өөр давхрын бүсийн сонголтыг цэвэрлэнэ (uiStore-ийн гэрээ, §10.3)', () => {
    act(() => useUiStore.getState().selectArea(F01_A));
    const { result } = renderHook(() => useFloorInteraction(F02));
    act(() => result.current.onClick(click()));
    expect(useUiStore.getState()).toMatchObject({ selectedFloorId: F02, selectedAreaId: null });
  });
});

describe('uiStore → 3D (давхрын жагсаалт ба бусад UI-ийн сонголт)', () => {
  it('гаднаас selectFloor (давхрын жагсаалтын үйлдэл) → 3D давхар тодорч, бусад нь бүдэгрэнэ', () => {
    const selected = renderHook(() => useFloorInteraction(F01));
    const other = renderHook(() => useFloorInteraction(F02));
    expect(selected.result.current.visual).toBe('idle');

    act(() => useUiStore.getState().selectFloor(F01));
    expect(selected.result.current.visual).toBe('selected');
    expect(other.result.current.visual).toBe('dimmed');

    act(() => useUiStore.getState().selectFloor(null));
    expect(selected.result.current.visual).toBe('idle');
    expect(other.result.current.visual).toBe('idle');
  });

  it('selectArea → тэр бүс ба түүний давхар 3D-д тодорно, нөгөө бүс тодрохгүй', () => {
    const zoneA = renderHook(() => useZoneSelected(F01_A));
    const zoneB = renderHook(() => useZoneSelected(F01_B));
    const floor = renderHook(() => useFloorInteraction(F01));

    act(() => useUiStore.getState().selectArea(F01_A));
    expect(zoneA.result.current).toBe(true);
    expect(zoneB.result.current).toBe(false);
    expect(floor.result.current.visual).toBe('selected');

    act(() => useUiStore.getState().selectFloor(F02));
    expect(zoneA.result.current).toBe(false);
  });
});

describe('мэдрэгчийн зангилаа → бүсийн сонголт (FR-B5, UC-3, §8.6)', () => {
  const nodes = createSensorNodes(buildingConfig, createBuildingLayout(buildingConfig));
  const areaIdAt = (instanceId: number | undefined) => areaIdAtInstance(nodes, instanceId);
  const indexOf = (areaId: string) => nodes.findIndex((node) => node.areaId === areaId);
  const selectArea = (areaId: string) => useUiStore.getState().selectArea(areaId);

  /**
   * R3F-ийн дамжуулалтыг дуурайна: ойрын объектоос хол руу, `stopPropagation` хүртэл.
   * Зангилааны ард өөр давхрын хавтан (F01) байгаа гэж үзнэ — дамжвал бүсийн сонголт цэвэрлэгдэнэ.
   */
  function dispatchClick(instanceId: number | undefined, delta = 0) {
    let stopped = false;
    const event = { delta, instanceId, stopPropagation: () => (stopped = true) };
    const floorBehind = renderHook(() => useFloorInteraction(F01)).result.current;
    handleSensorNodeClick(event, areaIdAt, selectArea);
    if (!stopped) act(() => floorBehind.onClick({ ...event, stopPropagation: vi.fn() }));
    return { stopped };
  }

  it('зангилаа → яг тэр бүс ба түүний давхар сонгогдоно; ард байгаа давхарт дамжихгүй', () => {
    const { stopped } = dispatchClick(indexOf('F02-B'));
    expect(stopped).toBe(true);
    expect(useUiStore.getState()).toMatchObject({ selectedAreaId: 'F02-B', selectedFloorId: F02 });
  });

  it('instance бүр зөв бүс рүү (24)', () => {
    for (const [index, node] of nodes.entries()) {
      dispatchClick(index);
      expect(useUiStore.getState().selectedAreaId).toBe(node.areaId);
      expect(useUiStore.getState().selectedFloorId).toBe(node.floorId);
    }
  });

  it('чирэх үед сонгохгүй, гэхдээ ард байгаа давхарт ч дамжихгүй', () => {
    const { stopped } = dispatchClick(indexOf('F02-B'), CLICK_DRAG_TOLERANCE_PX + 1);
    expect(stopped).toBe(true);
    expect(useUiStore.getState()).toMatchObject({ selectedAreaId: null, selectedFloorId: null });
  });

  it('танигдаагүй instanceId → юу ч сонгохгүй', () => {
    dispatchClick(undefined);
    dispatchClick(nodes.length);
    expect(useUiStore.getState()).toMatchObject({ selectedAreaId: null, selectedFloorId: null });
  });

  it('бүсийн сонголт давхрын сонголтоос тусдаа: давхар дээр дарахад тэр давхрын бүс хэвээр', () => {
    dispatchClick(indexOf('F02-A'));
    const floor = renderHook(() => useFloorInteraction(F02)).result.current;
    act(() => floor.onClick(click()));
    expect(useUiStore.getState()).toMatchObject({ selectedAreaId: 'F02-A', selectedFloorId: F02 });
  });
});
