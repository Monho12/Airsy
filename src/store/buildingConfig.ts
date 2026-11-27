// Backend-ээс (`GET /api/config`, D106) ирсэн барилгын тохиргоог хадгална. Frontend өөрөө барилгын өгөгдөлгүй.
// `main.tsx` апп зурахаас ӨМНӨ нэг удаа тавина; дараа нь өөрчлөгдөхгүй тул React-ийн төлөв биш, энгийн хувьсагч.
import type { BuildingConfig } from '@/domain/config/building';

let current: BuildingConfig | null = null;

/** Серверээс ирсэн тохиргоог тавина (main.tsx ба тестийн setup) */
export function setBuildingConfig(config: BuildingConfig): void {
  current = config;
}

/** Ачаалагдсан тохиргоо. Ачаалагдаагүй үед дуудах нь програмын алдаа тул throw хийнэ. */
export function getBuildingConfig(): BuildingConfig {
  if (current === null) {
    throw new Error('Барилгын тохиргоо серверээс ачаалагдаагүй байна (GET /api/config)');
  }
  return current;
}
