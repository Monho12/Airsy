// Тестийн барилгын fixture (D106). Барилгын өгөгдөл зөвхөн backend-д (`api-worker/src/buildingData.ts`) байдаг
// тул тест түүний үүсгэгчийг шууд ашиглана — апп-ын код үүнийг импортлохгүй (lint-ийн хил, §9.3).
export {
  BUILDING_ID,
  DEFAULT_FLOOR_COUNT,
  DIRECTOR_FLOOR_LEVEL,
  MAX_FLOOR_COUNT,
  MIN_FLOOR_COUNT,
  buildingConfig,
  createBuildingConfig,
} from '../../../api-worker/src/buildingData';
