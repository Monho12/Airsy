// Runtime-ийн бүртгэл (CLAUDE.md §9.3-ын 2-р дүрэм, D73). `main.tsx` нэг удаа бүртгэнэ; feature-ууд `useRuntime()`-аар
// авч зөвхөн `AerisRuntime` interface-ээр (`dispatch`) харьцана — хэрэгжүүлэлтийг (LocalSimulationRuntime) мэдэхгүй.
import { create } from 'zustand';

import type { AerisRuntime } from '@/domain/runtime/AerisRuntime';

const useRuntimeStore = create<{ runtime: AerisRuntime | null }>()(() => ({ runtime: null }));

/** `null` — бүртгэлийг цуцална (тест). */
export function registerRuntime(runtime: AerisRuntime | null): void {
  useRuntimeStore.setState({ runtime });
}

/** Бүртгэгдсэн runtime; байхгүй бол `null` — удирдлага зурагдахгүй (§8.7: ажиллахгүй удирдлага байхгүй). */
export function useRuntime(): AerisRuntime | null {
  return useRuntimeStore((state) => state.runtime);
}
