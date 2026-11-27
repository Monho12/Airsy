// Backend (Cloudflare Worker, D105)-ийн REST API-тай ярих жижиг adapter.
// Компонент `fetch`-ийг шууд дуудахгүй — зөвхөн энэ файлаар дамжина.
// Хаяг: `VITE_API_URL` (жишээ нь `.env.local`), байхгүй бол локал `wrangler dev`.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8787';

/** GET /api/building-ийн хариу (api-worker/src/index.ts-тэй ижил хэлбэр) */
export interface BuildingInfo {
  id: string;
  name: string;
  floorCount: number;
  floors: { id: string; level: number; name: string; usage: string; areaCount: number }[];
}

/** Барилгын мэдээллийг серверээс авна. HTTP алдаа эсвэл сүлжээний алдаа бол throw хийнэ. */
export async function fetchBuildingInfo(signal?: AbortSignal): Promise<BuildingInfo> {
  const response = await fetch(`${API_URL}/api/building`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as BuildingInfo;
}
