// Төхөөрөмжийн Монгол нэр ба төлөв (CLAUDE.md §5.7, §8.9-ийн нэр томьёо). Эзэмшигч: Frontend (§14.3).
import type {
  ControlMode,
  DamperPosition,
  DeviceKind,
  DeviceState,
  FanLevel,
  FloorId,
} from '@/domain/types';

const kind = {
  supply_fan: 'Агаар оруулах сэнс',
  exhaust_fan: 'Агаар гаргах сэнс',
  outdoor_air_damper: 'Гадна агаарын хаалт',
} satisfies Record<DeviceKind, string>;

export const devices = {
  kind,

  fanLevel: {
    OFF: 'Унтраалттай',
    LOW: 'Бага',
    MEDIUM: 'Дунд',
    HIGH: 'Их',
    BOOST: 'Хамгийн их',
  } satisfies Record<FanLevel, string>,

  damperPosition: {
    CLOSED: 'Хаалттай',
    MINIMUM: 'Бага зэрэг',
    PARTIAL: 'Хагас',
    OPEN: 'Бүрэн нээлттэй',
  } satisfies Record<DamperPosition, string>,

  /** «Агаар оруулах сэнс F07» (§10) */
  deviceName(deviceKind: DeviceKind, floorId: FloorId): string {
    return `${kind[deviceKind]} ${floorId}`;
  },

  /** Төхөөрөмжийн одоогийн төлөвийн шошго (сэнсний түвшин эсвэл хаалтын байрлал) */
  stateLabel(state: DeviceState): string {
    return state.kind === 'outdoor_air_damper'
      ? devices.damperPosition[state.position]
      : devices.fanLevel[state.level];
  },

  // ---------- Phase 5 — гар удирдлага ба «Яагаад?» шалгагч (§6.7, §6.8, FR-C7, FR-C8, D78) ----------
  modeBadge: { auto: 'АВТ', manual: 'ГАР', emergency: 'ЯАРАЛТАЙ' } satisfies Record<
    ControlMode,
    string
  >,
  manualSelectLabel(deviceName: string): string {
    return `${deviceName} — гараар тохируулах`;
  },
  returnToAuto: 'Автомат руу буцаах',
  why: 'Яагаад?',
  whyLabel(deviceName: string): string {
    return `${deviceName} — сүүлийн шийдвэрийн тайлбар`;
  },
  manualUntil(timeText: string): string {
    return `Гар удирдлага ${timeText} хүртэл`;
  },
  emergencyLockNote: 'Яаралтай байдлын симуляцийн үед гар удирдлага идэвхгүй.',
  inspector: {
    noDecision: 'Шийдвэр хараахан гараагүй — дараагийн алхмаар үнэлэгдэнэ.',
    outcome: 'Үр дүн',
    reason: 'Шалтгаан',
    winningRule: 'Шийдсэн дүрэм',
    contributing: 'Ижил утга хүссэн',
    requests: 'Дүрмүүдийн хүсэлт',
    constraints: 'Хязгаарлалт',
    minimum: 'Доод хязгаар',
    evaluatedAt: 'Үнэлсэн',
    roleMinimum: 'доод хязгаар',
    roleOverride: 'яаралтай',
  },

  /** Удирдлагын engine байхгүй (Phase 2) үеийн эхний төлөвийн шалтгаан */
  initialStateReason: 'Эхлэх төлөв (суурь агааржуулалт).',
} as const;
