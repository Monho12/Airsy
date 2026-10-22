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
    status: {
      normal: readCssToken('--color-status-normal'),
      warning: readCssToken('--color-status-warning'),
      critical: readCssToken('--color-status-critical'),
      offline: readCssToken('--color-status-offline'),
      invalid: readCssToken('--color-status-offline'),
    },
  };
}
