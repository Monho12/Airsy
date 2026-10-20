import { useEffect } from 'react';

import { mn } from '@/domain/i18n/mn';
import { useUiStore } from '@/store/uiStore';

import { AppShell } from './AppShell';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function App() {
  const setSystemReducedMotion = useUiStore((state) => state.setSystemReducedMotion);

  useEffect(() => {
    document.title = mn.common.documentTitle;
  }, []);

  // Системийн хөдөлгөөн багасгах тохиргоог uiStore-д дамжуулна (§8.5, §10.3). DOM-ыг зөвхөн app давхарга сонсоно.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setSystemReducedMotion(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [setSystemReducedMotion]);

  return <AppShell />;
}
