// Апп-ын нийтлэг Монгол бичвэр (CLAUDE.md §8.9). Компонентод бичвэр хатуу бичихгүй — эндээс импортолно.

export const common = {
  appName: 'AERIS',
  buildingName: 'AERIS Tower',
  documentTitle: 'AERIS — Ухаалаг барилгын digital twin (симуляци)',
  simulationBadge: 'СИМУЛЯЦИ',
  simulationBadgeDescription:
    'Бүх утга браузер дотор үүсгэсэн симуляци. Жинхэнэ мэдрэгч холбогдоогүй.',
  placeholderNote: 'Дараагийн шатанд нэмэгдэнэ',
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
