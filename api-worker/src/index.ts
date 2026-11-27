// AERIS API Worker — Cloudflare Worker дээрх энгийн REST API (D105).
// Static frontend өгөгдлөө эндээс `fetch`-ээр авна. Worker зөвхөн JSON буцаана, HTML хэзээ ч биш.
// Барилгын өгөгдлийг frontend-тэй ИЖИЛ тохиргооноос (src/domain/config) авна — хуулбар байхгүй.
import { buildingConfig } from '../../src/domain/config/building';

interface Env {
  /** Зөвшөөрсөн frontend-ийн origin-ууд, таслалаар тусгаарласан (wrangler.jsonc → vars) */
  FRONTEND_ORIGINS: string;
}

/** GET /api/building-ийн хариу. Хэлбэр нь frontend-ийн `features/server-status/api.ts`-тэй ижил. */
function createBuildingSummary() {
  const { building, floors } = buildingConfig;
  return {
    id: building.id,
    name: building.name,
    floorCount: building.floorIds.length,
    floors: building.floorIds.flatMap((floorId) => {
      const floor = floors[floorId];
      if (floor === undefined) return [];
      return [
        {
          id: floor.id,
          level: floor.level,
          name: floor.name,
          usage: floor.usage,
          areaCount: floor.areaIds.length,
        },
      ];
    }),
  };
}

// Тохиргоо өөрчлөгддөггүй тул нэг л удаа тооцно
const BUILDING_SUMMARY = createBuildingSummary();

/** Хүсэлтийн Origin зөвшөөрөгдсөн бол түүнийг буцаана, үгүй бол null */
function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (origin === null) return null;
  const allowed = env.FRONTEND_ORIGINS.split(',').map((item) => item.trim());
  return allowed.includes(origin) ? origin : null;
}

/** CORS толгой: зөвшөөрөгдсөн origin-д л. Бусад тохиолдолд браузер хариуг уншуулахгүй. */
function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin !== null) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);

    // Браузерын урьдчилсан (preflight) хүсэлт
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    const { pathname } = new URL(request.url);
    switch (pathname) {
      case '/api':
        return json({ message: 'AERIS API Worker' }, 200, origin);
      case '/api/health':
        return json({ ok: true }, 200, origin);
      case '/api/building':
        return json(BUILDING_SUMMARY, 200, origin);
      default:
        return json({ error: 'Not found' }, 404, origin);
    }
  },
};
