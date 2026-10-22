// 3D ↔ uiStore сонголт (FR-B4, §10.3). WebGL-гүйгээр: 3D-ийн handler ба харагдах төлөвийг hook-оор шалгана.
// Давхрын жагсаалт ижил `selectFloor`-ийг дууддаг тул store-оор дамжин хоёр чиглэлд синк болно.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { initialUiState, useUiStore } from '@/store/uiStore';

import { createBuildingLayout } from './layout';
import {
  CLICK_DRAG_TOLERANCE_PX,
  floorVisualState,
  handleSensorNodeClick,
  useFloorInteraction,
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
