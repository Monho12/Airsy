// Апп-ын нийтлэг Монгол бичвэр (CLAUDE.md §8.9). Компонентод бичвэр хатуу бичихгүй — эндээс импортолно.
import type { ConnectionStatus } from '@/domain/types';

export const common = {
  appName: 'AERIS',
  buildingName: 'AERIS Tower',
  documentTitle: 'AERIS — Ухаалаг барилгын digital twin (симуляци)',
  simulationBadge: 'СИМУЛЯЦИ',
  simulationBadgeDescription:
    'Бүх утга браузер дотор үүсгэсэн симуляци. Жинхэнэ мэдрэгч холбогдоогүй.',
  placeholderNote: 'Дараагийн шатанд нэмэгдэнэ',
  loading: 'Ачаалж байна…',
  noData: 'Өгөгдөлгүй',
  lastValue: 'Сүүлийн утга',
  stale: 'Хуучирсан',
  dataIssue: 'Өгөгдлийн асуудал',
  buildingStatus: 'Барилгын төлөв',
  activeAlertCount: (count: number) => `${count} идэвхтэй дохио`,
  floorAlertCount: (count: number) => `${count} дохио`,
  noFloorSelected: 'Жагсаалтаас давхар сонгоно уу.',
  floorListHint: '↑/↓ — давхар солих, Home/End — эхний/сүүлийн давхар',
  /** Бүсийн гарчгийн мөр (FR-M1): «Хэмжсэн: 09:10:00 · Холбогдсон» */
  measuredAt: 'Хэмжсэн',
  connection: {
    online: 'Холбогдсон',
    stale: 'Хуучирсан',
    offline: 'Холболтгүй',
  } satisfies Record<ConnectionStatus, string>,
  sensorsOffline: (count: number) => `${count} мэдрэгч холболтгүй`,
  sensorsStale: (count: number) => `${count} мэдрэгч хуучирсан`,
  regions: {
    building3d: 'Барилгын 3D загвар',
    floorList: 'Давхрын жагсаалт',
    floorDetails: 'Сонгосон давхар',
    devices: 'Төхөөрөмж',
    alerts: 'Идэвхтэй дохио',
    trends: 'Хандлага',
    events: 'Үйл явдлын түүх',
    scenarios: 'Сценари',
  },
} as const;
