// Сценарийн Монгол бичвэр (CLAUDE.md §7, §8.9). Эзэмшигч: Симуляцийн инженер (§14.3).
import type { ScenarioId } from '@/domain/types';

export const scenarios = {
  name: {
    'normal-operation': 'Барилгын хэвийн ажиллагаа',
    'elevated-temperature': 'Өндөр температур — 12-р давхар',
    'high-co2': 'Өндөр CO₂ — 2-р давхар',
    'voc-cleaning': 'Цэвэрлэгээний дараах VOC — 6-р давхар',
    'poor-outdoor-air': 'Гадна агаарын чанар муу',
    'fire-emergency': 'Гал/утааны яаралтай байдал (симуляци) — 8-р давхар',
    'sensor-disconnection': 'Мэдрэгч салсан — 4-р давхар',
    recovery: 'Хэвийн байдалд сэргэх',
  } satisfies Record<ScenarioId, string>,

  description: {
    'normal-operation': 'Эрүүл барилга ба суурь шууд өгөгдөл. Шинэчлэлийн жишиг төлөв.',
    'elevated-temperature':
      'Нарны дулаанаар 12-р давхрын температур өснө; гадна агаар сэрүүн тул үнэгүй хөргөлт ажиллана.',
    'high-co2': 'Хурал эхэлж 2-р давхарт хүн олширно; агааржуулалт нэмэгдэж CO₂-ийг бууруулна.',
    'voc-cleaning':
      'Оройн цэвэрлэгээний бодисоос 6-р давхрын VOC огцом өснө; агааржуулалт түүнийг арилгана.',
    'poor-outdoor-air':
      'Гадна PM2.5 өснө (зохиомол түймрийн утаа); гадна агаар оруулах хязгаарлагдана.',
    'fire-emergency':
      'Симуляцийн галын дохиоллоор яаралтай горим эхэлнэ — сургалтын жишээ стратеги.',
    'sensor-disconnection':
      '4-р давхрын CO₂ мэдрэгчүүд салж, чийгшлийн мэдрэгч буруу утга илгээнэ; удирдлага нөөц горимд орно.',
    recovery:
      'Сценарийн бүх оролт суурь руу буцаж, мэдрэгчүүд дахин холбогдоно. Одоогийн төлөвөөс эхэлнэ.',
  } satisfies Record<ScenarioId, string>,

  /** Алхмын шошго (`ScenarioStep.label`) */
  step: {
    sunHeat: '12-р давхрын нарны дулаан өснө',
    afternoonSun: 'Үдээс хойших нар — дулааны ачаалал цааш өснө',
    meetingStarts: 'Их танхимд хурал эхэлнэ (ачаалал 100%)',
    roomsFill: 'Хурлын өрөөнүүд дүүрнэ (ачаалал 95%)',
    evening: 'Оройн нөхцөл — бүх бүсийн ачаалал 10%',
    cleaningNorth: 'Цэвэрлэгээний баг — 6-р давхар, хойд бүс',
    cleaningSouth: 'Цэвэрлэгээний баг — 6-р давхар, урд бүс',
    outdoorSmoke: 'Гадна PM2.5 өснө (зохиомол түймрийн утаа)',
    conferenceLoad: '2-р давхрын ачаалал өснө',
    fireAlarm: '8-р давхарт симуляцийн галын дохиолол',
    smokeFire: '8-р давхарт утаа ба дулаан (утааны орлуулагч PM2.5)',
    smokeNeighbors: 'Хөрш давхруудад бага зэрэг утаа',
    f04Load: '4-р давхрын ачаалал 75%',
    disconnectA: '4-р давхар, хойд бүсийн CO₂ мэдрэгч салсан',
    disconnectB: '4-р давхар, урд бүсийн CO₂ мэдрэгч салсан',
    invalidHumidity: '4-р давхар, хойд бүсийн чийгшлийн мэдрэгч 140% илгээнэ',
    restoreInputs: 'Бүх оролт 30 секундэд суурь руу буцна',
    reconnectAll: 'Бүх мэдрэгч дахин холбогдоно',
  },

  // ---------- Үйл явдлын бичвэр ----------
  started(name: string): string {
    return `Сценари эхэлсэн: ${name}.`;
  },
  stepEvent(label: string): string {
    return `Сценарийн алхам: ${label}.`;
  },
  completed(name: string): string {
    return `Сценари дууссан: ${name}.`;
  },
  stopped(name: string): string {
    return `Сценари зогссон: ${name}.`;
  },
  emergencyStarted(fireFloorLabel: string): string {
    return `Яаралтай байдал эхэлсэн (симуляци): ${fireFloorLabel} — симуляцийн галын дохиолол.`;
  },
  emergencyEnded: 'Яаралтай байдлын симуляцийг дуусгав — автомат удирдлага сэргэнэ.',
  emergencyEndedByScenario: 'Яаралтай байдлын симуляцийг дуусгав — өөр сценари эхлүүлсэн.',
  simulationReset(activeName: string | null, emergencyActive: boolean): string {
    const parts = [
      activeName === null ? null : `идэвхтэй сценари: ${activeName}`,
      emergencyActive ? 'яаралтай байдал дуусгагдсан' : null,
    ].filter((part) => part !== null);
    return parts.length === 0
      ? 'Симуляцийг эхнээс нь эхлүүлэв.'
      : `Симуляцийг эхнээс нь эхлүүлэв (${parts.join(', ')}).`;
  },
  /** Зөөлөн шинэчлэлийн шалтгаан (§7.4 C) */
  resetReason: 'Сценари шинэчлэгдсэн',
  manualClearedByReset(deviceName: string): string {
    return `${deviceName}: гар удирдлагыг цуцлав — сценари шинэчлэгдсэн.`;
  },
  manualClearedByEmergencyEnd(deviceName: string): string {
    return `${deviceName}: гар удирдлагыг цуцлав — яаралтай байдал дууссан.`;
  },
  autoModeByReset: 'Автомат горимыг асаав — сценари шинэчлэгдсэн.',
  alertResolvedByReset(alertTitle: string): string {
    return `Дохио шийдэгдсэн (сценари шинэчлэгдсэн): ${alertTitle}.`;
  },
  alertResolvedByEmergencyEnd(alertTitle: string): string {
    return `Дохио шийдэгдсэн (яаралтай байдал дууссан): ${alertTitle}.`;
  },
  constraintClearedByReset: 'Гадна агаарын хязгаарлалт арилав — сценари шинэчлэгдсэн.',
  fallbackClearedByReset(floorLabel: string): string {
    return `${floorLabel}: нөөц горим дуусав — сценари шинэчлэгдсэн.`;
  },
  alertAcknowledged(alertTitle: string): string {
    return `Дохиог хүлээн авсан: ${alertTitle}.`;
  },

  // ---------- Сценарийн самбар ба яаралтай мөр (UI, §7.1, §8.7–8.9, Phase 6b) ----------
  panel: {
    title: 'Сценари',
    listLabel: 'Үзүүлэх сценариуд',
    start: 'Эхлүүлэх',
    startLabel: (name: string) => `Эхлүүлэх: ${name}`,
    stop: 'Зогсоох',
    stopLabel: (name: string) => `Сценарийг зогсоох: ${name}`,
    reset: 'Симуляцийг эхнээс нь',
    active: 'Идэвхтэй',
    noActive: 'Идэвхтэй сценари алга.',
    progressLabel: (name: string) => `Сценарийн явц: ${name}`,
    progressValue: (percent: number) => `${percent}%`,
    startsFromCurrent: 'Одоогийн төлөвөөс эхэлнэ',
    recoveryBlocked: 'Яаралтай симуляцийг эхлээд дуусгана уу.',
    emergencyBadge: 'Яаралтай байдал',
  },
  confirm: {
    cancel: 'Болих',
    confirmStart: 'Эхлүүлэх',
    startTitle: (name: string) => `Сценари эхлүүлэх: ${name}`,
    switchBody: (activeName: string) =>
      `«${activeName}» сценари одоо идэвхтэй байна. Түүнийг зогсоож, шинэ сценарийг эхлүүлэх үү?`,
    emergencySwitchBody:
      'Яаралтай байдлын симуляци идэвхтэй байна. Шинэ сценари эхлүүлбэл яаралтай симуляци дуусгагдана.',
    softResetNote:
      'Сценари эхлэхээс өмнө барилга суурь төлөвт буцна (гар удирдлага цуцлагдаж, идэвхтэй дохио шийдэгдэнэ).',
    resetTitle: 'Симуляцийг эхнээс нь эхлүүлэх үү?',
    resetBody:
      'Бүх утга, төхөөрөмж, дохио суурь төлөвт буцаж, үйл явдлын ба хандлагын түүх цэвэрлэгдэнэ. Энэ үйлдлийг буцаах боломжгүй.',
    confirmReset: 'Эхнээс нь',
  },
  /** Яаралтай байдлын анхааруулга — заавал энэ үгээр (§6.9, §8.9) */
  emergencyDisclaimer:
    'Энэ бол сургалтын симуляци. Батлагдсан гал, утааны хамгаалалтын систем биш. Жинхэнэ гал мэдээллийн дохиолол, нүүлгэн шилжүүлэх журам, аврах албыг орлохгүй.',
  emergencyBar: {
    title: 'Яаралтай байдал (симуляци)',
    fireFloor: (floorLabel: string) =>
      `Галын давхар: ${floorLabel}. Гар удирдлага идэвхгүй — бүх төхөөрөмж яаралтай стратегиар ажиллаж байна.`,
    end: 'Яаралтай симуляцийг дуусгах',
    // §8.6: яаралтай байдлын агаарын урсгал нь зөвхөн төхөөрөмжийн төлөвийн жишээ дүрслэл
    visualNote:
      '3D дээр галын давхар улаан, даралттай хөрш давхрууд шар хүрээтэй. Агаарын урсгал нь зөвхөн төхөөрөмжийн төлөвийн жишээ дүрслэл — утааны жинхэнэ тархалт эсвэл даралтын загвар биш.',
  },

  // ---------- Командын татгалзал ----------
  unknownScenario: (id: string) => `Сценари олдсонгүй: ${id}.`,
  incompatible(requiredFloorLabel: string, floorCount: number): string {
    return `Энэ сценари ${requiredFloorLabel} шаардана; одоогийн барилга ${floorCount} давхартай.`;
  },
  recoveryBlockedByEmergency:
    'Яаралтай байдлын симуляци идэвхтэй байна — эхлээд «Яаралтай симуляцийг дуусгах»-ыг дарна уу.',
  noActiveEmergency: 'Яаралтай байдлын симуляци идэвхгүй байна.',
  unknownAlert: (id: string) => `Дохио олдсонгүй: ${id}.`,
  alertNotActive: 'Энэ дохио идэвхтэй биш (аль хэдийн хүлээн авсан эсвэл шийдэгдсэн).',
  emergencyAlertCannotAck:
    'Яаралтай байдлын дохиог идэвхтэй үед хүлээн авах боломжгүй — яаралтай симуляцийг дуусгана уу.',
} as const;
