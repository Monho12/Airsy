// Backend (Cloudflare Worker, D105)-ийн REST API-тай ярих жижиг adapter.
// Компонент `fetch`-ийг шууд дуудахгүй — зөвхөн энэ файлаар дамжина.
// Хаяг: анхдагчаар Cloudflare-д deploy хийсэн Worker. Локал `wrangler dev`-ээр турших бол `.env.local`-д
// `VITE_API_URL=http://127.0.0.1:8787` гэж бичнэ.
import type { BuildingConfig } from '@/domain/config/building';

/** Deploy хийсэн API Worker (D105) */
export const DEFAULT_API_URL = 'https://aeris-api.oorgilmojo.workers.dev';
export const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

/** GET /api/building-ийн хариу (api-worker/src/index.ts-тэй ижил хэлбэр) */
export interface BuildingInfo {
  id: string;
  name: string;
  floorCount: number;
  floors: { id: string; level: number; name: string; usage: string; areaCount: number }[];
}

/** Барилгын мэдээллийг серверээс авна. HTTP алдаа эсвэл сүлжээний алдаа бол throw хийнэ. */
export async function fetchBuildingInfo(signal?: AbortSignal): Promise<BuildingInfo> {
  return (await getJson('/api/building', signal)) as BuildingInfo;
}

/**
 * Барилгын БҮТЭН тохиргоог серверээс авна (D106) — frontend өөрөө барилгын өгөгдөлгүй.
 * Хэлбэр нь буруу бол throw хийнэ (буруу өгөгдлөөр симуляци эхлүүлэхгүй).
 */
export async function fetchBuildingConfig(signal?: AbortSignal): Promise<BuildingConfig> {
  const body = await getJson('/api/config', signal);
  if (!isBuildingConfig(body)) throw new Error('Серверээс ирсэн барилгын тохиргоо буруу хэлбэртэй');
  return body;
}

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** Хамгийн бага шалгалт: гол хэсгүүд байгаа эсэх (бүрэн schema шалгалт — §15.3-ын ирээдүй) */
function isBuildingConfig(value: unknown): value is BuildingConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<Record<keyof BuildingConfig, unknown>>;
  const building = config.building as { floorIds?: unknown } | undefined;
  return (
    typeof building === 'object' &&
    Array.isArray(building.floorIds) &&
    building.floorIds.length > 0 &&
    ['floors', 'areas', 'sensors', 'devices'].every(
      (key) => typeof config[key as keyof BuildingConfig] === 'object',
    )
  );
}
