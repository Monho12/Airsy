// Сценари эхлэхэд түүний гол давхрыг сонгоно (D100; шүүмжийн P0): 3D, «Сонгосон давхар», график тэр давхар руу
// шилжиж, сценарийн нөлөө шууд харагдана (§7.3-ын үзүүлэх скрипт). Зөвхөн *шинэ* эхлэлд (id + startedAt) нэг удаа —
// дараа нь оператор өөр давхар сонговол түүнийг давж бичихгүй. Барилгын хэмжээний сценарид (S1, S8) сонголт өөрчлөгдөхгүй.
import { useEffect } from 'react';

import { useLiveStore } from '@/store/liveStore';
import { scenarioFocusFloorId } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

export function useFollowScenarioFloor(): void {
  useEffect(() => {
    const keyOf = () => {
      const running = useLiveStore.getState().snapshot?.simulation.activeScenario ?? null;
      return running === null ? null : `${running.id}@${running.startedAt}`;
    };
    let previous = keyOf();
    return useLiveStore.subscribe((state) => {
      const running = state.snapshot?.simulation.activeScenario ?? null;
      const key = running === null ? null : `${running.id}@${running.startedAt}`;
      if (key === previous) return;
      previous = key;
      if (running === null) return;
      const floorId = scenarioFocusFloorId(running.id, running.targetAreaId);
      if (floorId !== null && useUiStore.getState().selectedFloorId !== floorId) {
        useUiStore.getState().selectFloor(floorId);
      }
    });
  }, []);
}
