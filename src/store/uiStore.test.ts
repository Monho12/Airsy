import { beforeEach, describe, expect, it } from 'vitest';

import { floorIdOfArea, initialUiState, useUiStore } from './uiStore';

beforeEach(() => {
  useUiStore.setState(initialUiState);
});

describe('uiStore (§10.3)', () => {
  it('бүс сонгоход давхрыг хамт сонгоно', () => {
    useUiStore.getState().selectArea('F07-A');
    expect(useUiStore.getState()).toMatchObject({
      selectedFloorId: 'F07',
      selectedAreaId: 'F07-A',
    });
  });

  it('өөр давхар сонгоход бүсийн сонголт цэвэрлэгдэнэ', () => {
    useUiStore.getState().selectArea('F07-A');
    useUiStore.getState().selectFloor('F02');
    expect(useUiStore.getState()).toMatchObject({ selectedFloorId: 'F02', selectedAreaId: null });
  });

  it('selectArea(null) нь бүсийн сонголтыг цуцлаад давхрын сонголтыг хадгална', () => {
    useUiStore.getState().selectArea('F07-A');
    useUiStore.getState().selectArea(null);
    expect(useUiStore.getState()).toMatchObject({ selectedFloorId: 'F07', selectedAreaId: null });
  });

  it('ижил давхрыг дахин сонгоход бүсийн сонголт хадгалагдана', () => {
    useUiStore.getState().selectArea('F07-A');
    useUiStore.getState().selectFloor('F07');
    expect(useUiStore.getState().selectedAreaId).toBe('F07-A');
  });

  it('reducedMotion = override ?? системийн тохиргоо', () => {
    const { setSystemReducedMotion, setReducedMotionOverride } = useUiStore.getState();
    setSystemReducedMotion(true);
    expect(useUiStore.getState().reducedMotion).toBe(true);
    setReducedMotionOverride(false);
    expect(useUiStore.getState().reducedMotion).toBe(false);
    setReducedMotionOverride(null);
    expect(useUiStore.getState().reducedMotion).toBe(true);
  });

  it('«Харагдацыг сэргээх» бүрт token нэмэгдэнэ', () => {
    useUiStore.getState().requestCameraReset();
    useUiStore.getState().requestCameraReset();
    expect(useUiStore.getState().cameraResetToken).toBe(2);
  });

  it('floorIdOfArea нь §5.2-ын ID дүрмийг дагана', () => {
    expect(floorIdOfArea('F12-B')).toBe('F12');
    expect(() => floorIdOfArea('F12')).toThrow();
  });
});
