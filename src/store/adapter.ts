// Snapshot → store adapter (CLAUDE.md §9.2, §11.2, D53). `liveStore`-д бичих цорын ганц газар (§9.3-ын 6-р дүрэм).
// Phase 2-т mock snapshot-оор, Phase 4-өөс runtime-ийн `subscribe`-аар дуудагдана — гэрээ ижил.
import type { AerisRuntime } from '@/domain/runtime/AerisRuntime';
import type { LiveSnapshot } from '@/domain/types';

import { useLiveStore } from './liveStore';

/** Publish бүрт нэг удаа: шинэ snapshot-ийг store-д бүхэлд нь тавина (structural sharing-ийг snapshot үүсгэгч хангана). */
export function applySnapshot(snapshot: LiveSnapshot): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Дэмжигдээгүй snapshot schemaVersion: ${String(snapshot.schemaVersion)}`);
  }
  useLiveStore.setState({ snapshot });
}

/**
 * Runtime-ийг store-д холбоно (§9.2, D73): одоогийн snapshot-ийг тэр даруй, дараа нь publish бүрийг `applySnapshot`-оор.
 * Захиалгыг цуцлах функц буцаана.
 */
export function connectRuntime(
  runtime: Pick<AerisRuntime, 'getSnapshot' | 'subscribe'>,
): () => void {
  applySnapshot(runtime.getSnapshot());
  return runtime.subscribe(applySnapshot);
}
