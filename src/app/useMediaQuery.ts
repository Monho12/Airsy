// CSS media query-г React-д дамжуулах жижиг hook (§8.2-ын дэлгэцийн хэмжээ). DOM-ыг зөвхөн app давхарга сонсоно (§9.3).
// `matchMedia` байхгүй орчинд (jsdom гэх мэт) `false` буцаана — desktop layout.
import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () =>
    typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
