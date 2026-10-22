// building3d-ийн нийтийн гэрээ (CLAUDE.md §8.6, D57). 3D санг импортлохгүй — index.ts-ээр үндсэн bundle-д орно.
import type { BuildingConfig } from '@/domain/config/building';

/** 3D-ийг орлуулах шалтгаан; `app/` үүгээр `features/floor-list` руу шилжиж тайлбар харуулна. */
export type Building3DFallbackReason = 'webgl-unavailable' | 'context-lost' | 'render-error';

export interface Building3DProps {
  /** 3D зурагдах боломжгүй болоход дуудна. `building3d` өөрөө орлуулах UI зурахгүй (§8.6). */
  onFallback: (reason: Building3DFallbackReason) => void;
  /** Барилгын тохиргоо (анхдагч `buildingConfig`; 6/12/20 давхрыг шалгахад, FR-B1, D57) */
  config?: BuildingConfig;
}
