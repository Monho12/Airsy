// 3D барилгын хэсэг (CLAUDE.md §8.6, §8.7, D57). Аль харагдацыг зурахыг `app/` сонгоно: WebGL байвал lazy 3D,
// байхгүй эсвэл 3D алдаа гарвал тайлбар + `features/floor-list`-ийн 2D давхрын жагсаалт (layout-д үргэлж байдаг).
// `FloorList` өөрчлөгдөхгүй (Phase 3-ын шийдвэр); утасны 2D/3D таб нь Phase 7-д (D52).
import { useCallback, useState } from 'react';

import { Panel } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import { Building3D, detectWebGL, type Building3DFallbackReason } from '@/features/building3d';
import { useUiStore } from '@/store/uiStore';

type View =
  | { mode: '3d'; attempt: number }
  | { mode: 'fallback'; reason: Building3DFallbackReason; attempt: number };

const initialView = (): View =>
  detectWebGL()
    ? { mode: '3d', attempt: 0 }
    : { mode: 'fallback', reason: 'webgl-unavailable', attempt: 0 };

export function Building3DRegion() {
  const [view, setView] = useState<View>(initialView);
  const requestCameraReset = useUiStore((state) => state.requestCameraReset);
  const title = mn.common.regions.building3d;

  const handleFallback = useCallback((reason: Building3DFallbackReason) => {
    setView((current) => ({ mode: 'fallback', reason, attempt: current.attempt }));
  }, []);

  // «Дахин оролдох» (§8.7): шинэ `key`-ээр 3D-ийг дахин mount хийнэ
  const retry = () => setView((current) => ({ mode: '3d', attempt: current.attempt + 1 }));

  if (view.mode === '3d') {
    return (
      <Panel
        title={title}
        className="building3d-region"
        // «Харагдацыг сэргээх» (FR-B3, §8.2, §10.3) — зөвхөн 3D горимд; орлуулах харагдацад байхгүй (§8.7)
        meta={
          <button type="button" className="shell-button" onClick={requestCameraReset}>
            {mn.common.building3d.resetView}
          </button>
        }
      >
        <Building3D key={view.attempt} onFallback={handleFallback} />
      </Panel>
    );
  }

  return (
    <Panel title={title}>
      <div className="building3d-fallback" role="status">
        <p className="building3d-fallback__message">{mn.common.building3d.fallback[view.reason]}</p>
        {/* WebGL огт байхгүй бол дахин оролдох нь утгагүй — товч зөвхөн ажиллах үеийн алдаанд (§8.7) */}
        {view.reason !== 'webgl-unavailable' && (
          <button type="button" className="shell-button" onClick={retry}>
            {mn.common.building3d.retry}
          </button>
        )}
      </div>
    </Panel>
  );
}
