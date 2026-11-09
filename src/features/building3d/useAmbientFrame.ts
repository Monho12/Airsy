// Орчны анимацийн frame хүсэх hook (D104) — `ambientFrame.ts`-ийн нийтлэг scheduler-ийг canvas-ийн `invalidate`-ээр.
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

import { acquireAmbientScheduler, type AmbientScheduler } from './ambientFrame';

/** Буцаах функцийг `useFrame` дотроос «дараагийн frame хэрэгтэй» үед дуудна (frame бүрт биш, ~30 fps-ээр) */
export function useAmbientFrame(): () => void {
  const invalidate = useThree((state) => state.invalidate);
  const schedulerRef = useRef<AmbientScheduler | null>(null);
  useEffect(() => {
    const [scheduler, release] = acquireAmbientScheduler(invalidate);
    schedulerRef.current = scheduler;
    return () => {
      schedulerRef.current = null;
      release();
    };
  }, [invalidate]);
  return () => schedulerRef.current?.request();
}
