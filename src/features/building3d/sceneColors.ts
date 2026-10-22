// 3D-ийн өнгө — бүгд tokens.css-ээс (CLAUDE.md §8.3; 3D ба 2D UI хэзээ ч зөрөхгүй, hex хатуу бичихгүй).
import type { HealthStatus } from '@/domain/types';

import { readCssToken } from './readCssToken';

export interface SceneColors {
  background: string;
  slab: string;
  slabEdge: string;
  zone: string;
  /** Лифт/шатны хонгил — хавтангаас арай цайвар, чимэглэлийн (утга илэрхийлэхгүй) өнгө */
  core: string;
  /** Сонголт (accent) — бүх төлөвийн өнгөнөөс ялгаатай (§8.3) */
  selected: string;
  hovered: string;
  facade: string;
  facadeEdge: string;
  /** Төхөөрөмжийн хүрээ (сэнсний бүрхүүл, хаалтын хүрээ) */
  deviceFrame: string;
  /** Ажиллаж буй сэнсний далбаа, гэрэлтсэн түвшний заагч, хаалтын ламель */
  deviceActive: string;
  /** Унтраалттай сэнсний далбаа, гэрэлгүй заагч */
  deviceIdle: string;
  /** Мэдрэгчийн зангилааны төлөвийн өнгө (§8.3); offline/invalid — саарал */
  status: Record<HealthStatus, string>;
}

export function readSceneColors(): SceneColors {
  return {
    background: readCssToken('--color-bg'),
    slab: readCssToken('--color-surface-3'),
    slabEdge: readCssToken('--color-border-strong'),
    zone: readCssToken('--color-surface-2'),
    core: readCssToken('--color-border'),
    selected: readCssToken('--color-accent'),
    hovered: readCssToken('--color-accent-strong'),
    facade: readCssToken('--color-text-secondary'),
    facadeEdge: readCssToken('--color-border'),
    // Төлөвийн өнгө (хэвийн/анхааруулга) ба accent (сонголт)-оос ялгаатай саарал шатлал — төхөөрөмж эрүүл
    // мэндийн төлөв биш, ажиллагааны төлөв харуулна; мэдэгдэхгүй төлөв — `status.offline`.
    deviceFrame: readCssToken('--color-text-muted'),
    deviceActive: readCssToken('--color-text-primary'),
    deviceIdle: readCssToken('--color-border-strong'),
    status: {
      normal: readCssToken('--color-status-normal'),
      warning: readCssToken('--color-status-warning'),
      critical: readCssToken('--color-status-critical'),
      offline: readCssToken('--color-status-offline'),
      invalid: readCssToken('--color-status-offline'),
    },
  };
}
