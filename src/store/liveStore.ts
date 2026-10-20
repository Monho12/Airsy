// Шууд төлөвийн store (CLAUDE.md §9.2, §11.2). Сүүлийн `LiveSnapshot`-ийн хуулбар.
// ⚠️ Энд ЗӨВХӨН store adapter (`adapter.ts`-ийн `applySnapshot`) бичнэ (§9.3-ын 6-р дүрэм).
// Эхний snapshot ирэхээс өмнө `null` — UI «ачаалж байна» төлөвийг харуулна (§8.7).
import { create } from 'zustand';

import type { LiveSnapshot } from '@/domain/types';

export interface LiveState {
  snapshot: LiveSnapshot | null;
}

export const initialLiveState: LiveState = { snapshot: null };

export const useLiveStore = create<LiveState>()(() => initialLiveState);
