// building3d-ийн цорын ганц нийтийн цэг (CLAUDE.md §9.3-ын 4-р дүрэм, D57).
// ⚠️ Энд 3D санг (three, R3F, Drei) статикаар импортлохгүй — тэдгээр нь зөвхөн lazy chunk-д (§11.3).
export { Building3DLoader as Building3D } from './Building3DLoader';
export { detectWebGL } from './detectWebGL';
export type { Building3DFallbackReason, Building3DProps } from './types';
