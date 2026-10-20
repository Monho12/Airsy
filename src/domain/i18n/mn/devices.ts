// Төхөөрөмжийн Монгол нэр ба төлөв (CLAUDE.md §5.7, §8.9-ийн нэр томьёо). Эзэмшигч: Frontend (§14.3).
import type { DamperPosition, DeviceKind, FanLevel, FloorId } from '@/domain/types';

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

  /** Удирдлагын engine байхгүй (Phase 2) үеийн эхний төлөвийн шалтгаан */
  initialStateReason: 'Эхлэх төлөв (суурь агааржуулалт).',
} as const;
