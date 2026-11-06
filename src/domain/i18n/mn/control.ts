// Удирдлагын горим, дүрэм ба шийдвэрийн Монгол бичвэр (CLAUDE.md §6, §6.7, §6.8, §8.9).
// Эзэмшигч: Симуляцийн инженер (§14.3; Phase 2-т D48, Phase 5-д дүрэм ба шалтгаан нэмэгдэв).
import type { ConstraintId, ControlDecision, ControlMode, RuleId } from '@/domain/types';

export const control = {
  autoModeLabel: 'Автомат горим',
  autoModeOn: 'Асаалттай',
  autoModeOff: 'Унтраалттай',

  mode: {
    auto: 'Автомат',
    manual: 'Гар удирдлага',
    emergency: 'Яаралтай байдал (симуляци)',
  } satisfies Record<ControlMode, string>,

  /** Дүрмийн нэр («Яагаад?» шалгагчид, §6.3) */
  ruleName: {
    'R-EMERGENCY': 'Яаралтай байдал (симуляци)',
    'R-MANUAL': 'Гар удирдлага',
    'R-SENSOR-FALLBACK': 'Мэдрэгчийн нөөц горим',
    'R-IAQ-CRITICAL': 'Агаарын чанар — ноцтой',
    'R-IAQ-WARNING': 'Агаарын чанар — анхааруулга',
    'R-THERMAL': 'Өндөр температур',
    'R-BASELINE': 'Суурь агааржуулалт',
  } satisfies Record<RuleId, string>,

  /** Дүрмийн товч тайлбар (§6.3) */
  ruleDescription: {
    'R-EMERGENCY':
      'Яаралтай байдлын симуляцийн жишээ стратеги — бусад бүх дүрэм, гар удирдлагыг давна. Батлагдсан гал хамгаалалтын логик биш.',
    'R-MANUAL': 'Оператор төхөөрөмжийг гараар тавьсан — автомат шийдвэр хэрэгжихгүй.',
    'R-SENSOR-FALLBACK':
      'Давхрын удирдлагад оролцох аль нэг бүсэд CO₂-ийн зөв хэмжилт алга — агааржуулалтыг доод тал нь дунд түвшинд барина.',
    'R-IAQ-CRITICAL': 'CO₂, VOC эсвэл PM2.5 ноцтой түвшинд — агааржуулалтыг хамгийн их болгоно.',
    'R-IAQ-WARNING': 'CO₂, VOC эсвэл PM2.5 анхааруулгын түвшинд — агааржуулалтыг нэмнэ.',
    'R-THERMAL': 'Температур өндөр — агаар оруулах урсгалыг нэмнэ.',
    'R-BASELINE': 'Хэвийн үеийн суурь агааржуулалт.',
  } satisfies Record<RuleId, string>,

  constraintName: {
    'C-OUTDOOR-AIR': 'Гадна агаарын хязгаарлалт',
  } satisfies Record<ConstraintId, string>,

  outcome: {
    applied: 'Хэрэгжсэн',
    unchanged: 'Өөрчлөлтгүй',
    held_by_dwell: 'Барих хугацаагаар хүлээж буй',
    manual: 'Гар удирдлага',
    recommendation_only: 'Зөвхөн зөвлөмж',
    emergency: 'Яаралтай байдал',
  } satisfies Record<ControlDecision['outcome'], string>,

  // ---------- Хүсэлтийн шалтгаан (§6.3, §6.5) ----------

  levelWord: { warning: 'анхааруулга', critical: 'ноцтой' } as const,

  /** «2-р давхар: CO₂ 1,180 ppm — анхааруулга (≥ 1,000 ppm).» */
  metricReason(
    floorLabel: string,
    metricText: string,
    levelLabel: string,
    enterText: string,
  ): string {
    return `${floorLabel}: ${metricText} — ${levelLabel} (≥ ${enterText}).`;
  },
  pmDilutionNote: 'Гадна агаар цэвэр тул гадна агаараар шингэлнэ.',
  pmFilterNote: 'Гадна агаар цэвэр биш тул зөвхөн шүүлтүүрээр бууруулна.',
  freeCoolingNote: 'Гадна агаар сэрүүн тул үнэгүй хөргөлтөөр гадна агаарын хаалтыг бүрэн нээнэ.',
  noFreeCoolingNote: 'Үнэгүй хөргөлт боломжгүй тул гадна агаарын хаалтыг нэмж нээхгүй.',
  baselineReason: 'Хэвийн үеийн суурь агааржуулалт.',
  fallbackReason(floorLabel: string): string {
    return `${floorLabel}: нэг ба түүнээс олон бүсэд CO₂-ийн зөв хэмжилт алга — нөөц горим (доод тал нь «Дунд»).`;
  },
  emergencyReason(role: 'fire' | 'neighbor' | 'other', fireFloorLabel: string): string {
    const what = {
      fire: 'галтай давхар — утааг гаргана, агаар өгөхгүй',
      neighbor: 'галтай давхрын хөрш — даралт үүсгэнэ',
      other: 'бусад давхар — утаа тархахаас сэргийлж унтраана',
    }[role];
    return `Яаралтай байдал (симуляци), ${fireFloorLabel}: ${what}. Жишээ стратеги, батлагдсан гал хамгаалалт биш.`;
  },

  // ---------- Шийдвэрийн шалтгаан (§6.8) ----------

  transition(deviceName: string, from: string, to: string): string {
    return `${deviceName}: ${from} → ${to}.`;
  },
  constraintNote(outdoorPmText: string, restrictEnterText: string, positionLabel: string): string {
    return `Гадна PM2.5 ${outdoorPmText} (хязгаар ≥ ${restrictEnterText}) тул гадна агаарын хаалтыг «${positionLabel}» байрлалд барив.`;
  },
  constraintNoteNoValue(positionLabel: string): string {
    return `Гадна агаарыг хязгаарласан тул гадна агаарын хаалтыг «${positionLabel}» байрлалд барив.`;
  },
  minimumNote(levelLabel: string): string {
    return `Мэдрэгчийн нөөц горим тул доод тал нь «${levelLabel}».`;
  },
  unchangedReason(stateLabel: string): string {
    return `Зорилт одоогийн төлөвтэй ижил («${stateLabel}») — өөрчлөх шаардлагагүй.`;
  },
  heldReason(targetLabel: string, currentLabel: string, holdSeconds: number): string {
    return `Зорилт «${targetLabel}», гэхдээ төлөвийг барих хугацаа (${holdSeconds} с) дуусаагүй тул «${currentLabel}» хэвээр.`;
  },
  stepDownNote(targetLabel: string): string {
    return `Алхам алхмаар бууруулж байна (зорилт «${targetLabel}»).`;
  },
  manualReason(stateLabel: string, untilText: string): string {
    return `Гар удирдлагатай («${stateLabel}», ${untilText} хүртэл) — автомат шийдвэр хэрэгжихгүй.`;
  },
  autoWouldChoose(targetLabel: string): string {
    return `Автомат шийдвэр: «${targetLabel}».`;
  },
  recommendationReason(deviceName: string, targetLabel: string): string {
    return `Автомат горим унтраалттай: ${deviceName}-ийг «${targetLabel}» болгох байсан (хэрэгжүүлээгүй).`;
  },

  // ---------- Операторын командын шалтгаан ба татгалзал (§6.7, §9.4.1) ----------

  manualSetReason(stateLabel: string): string {
    return `Оператор гараар «${stateLabel}» болгосон.`;
  },
  unknownDevice: (deviceId: string) => `Төхөөрөмж олдсонгүй: ${deviceId}.`,
  stateKindMismatch: 'Төхөөрөмжийн төрөлд тохирохгүй төлөв.',
  manualBlockedByEmergency: 'Яаралтай байдлын симуляци идэвхтэй үед гар удирдлага боломжгүй.',
} as const;
