// Өрөөний сценарийн загвар (С7, D93) — тогтмол 8 сценари шиг ӨГӨГДӨЛ, гэхдээ зорилтот бүсээр үүсгэнэ: нэг загвар дурын
// давхрын тохирох өрөөнд ажиллана. Зөөлөн шинэчлэлээр (§7.4 C) эхэлдэг тул давтагдана.
// ⚠️ Эх үүсвэрийн тоон утга нь прототипийн ТААРУУЛГЫН УТГА — суурь агааржуулалтад (SF LOW, OAD MINIMUM) дохио 1×-д
// ~1–2 минутад гарахаар сонгосон (§5.8: CO₂/VOC τ ≈ 60 с, PM2.5 ≈ 80 с, температур ≈ 72 с, чийг ≈ 360 с).
// Гал/утааны сценари өрөөнөөс ЭХЛЭХГҮЙ (§6.9, D7) — зөвхөн баталгаажуулалттай S6.
import type { BuildingConfig } from '@/domain/config/building';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { Area, InteriorRoomKind, RoomScenarioId, SimulationScenario } from '@/domain/types';

const text = mn.scenarios.room;

/** Өрөөний төрөл бүрд боломжтой загвар (дараалал = UI-ийн дараалал). Мэдрэгч салгах нь бүх өрөөнд. */
const TEMPLATES_BY_KIND: Readonly<Record<InteriorRoomKind, readonly RoomScenarioId[]>> = {
  meeting: ['room-meeting', 'room-sensor-disconnect'],
  director: ['room-sensor-disconnect'],
  workroom: ['room-sensor-disconnect'],
  storage: ['room-sensor-disconnect'],
  server: ['room-server-overheat', 'room-sensor-disconnect'],
  restroom: ['room-restroom-humidity', 'room-sensor-disconnect'],
  kitchen: ['room-kitchen-cooking', 'room-sensor-disconnect'],
};

/** Энэ бүсэд эхлүүлж болох загварууд; өрөө биш (нээлттэй оффис) бол хоосон */
export function roomScenarioIdsFor(area: Area): readonly RoomScenarioId[] {
  return area.roomKind === null ? [] : TEMPLATES_BY_KIND[area.roomKind];
}

/** Тоон утга (таарууллага; тестээр дохио гарахыг шалгана) */
export const ROOM_SCENARIO_TUNING = {
  /** Хурлын өрөөний ачаалал 100% → CO₂ тэнцвэр ≈ 420 + (700 − 420) / 0.3 ≈ 1,350 ppm (анхааруулга) */
  meetingDurationMs: 180_000,
  /** Сервер өрөөний нэмэлт дулаан, °C/с → 150 с-д ≈ +7.5 °C (ноцтой ≥ 29) */
  serverHeat: 0.12,
  serverDurationMs: 150_000,
  /** Гал тогоо: PM2.5 µg/m³/с, VOC/с, чийг %/с, дулаан °C/с — 120 с */
  kitchen: { pm25: 0.35, voc: 2, humidity: 0.15, temperature: 0.04, durationMs: 120_000 },
  /** Ариун цэврийн өрөө: чийг %/с, VOC/с — 120 с */
  restroom: { humidity: 0.15, voc: 2, durationMs: 120_000 },
  /** Мэдрэгч салсан хугацаа */
  disconnectMs: 60_000,
} as const;

/**
 * Загвараас тухайн бүсийн сценари үүсгэнэ. Бүс тохиргоонд алга эсвэл загвар тохирохгүй бол `null` (runtime Монгол
 * шалтгаантай татгалзана).
 */
export function createRoomScenario(
  id: RoomScenarioId,
  areaId: string,
  config: BuildingConfig,
): SimulationScenario | null {
  const area = config.areas[areaId];
  if (area === undefined || !roomScenarioIdsFor(area).includes(id)) return null;
  const floor = config.floors[area.floorId];
  const floorLabel = floor === undefined ? area.floorId : floorLabelMn(floor.level);
  const name = text.fullName(text.name[id], area.name, floorLabel);
  const base = {
    id,
    targetAreaId: area.id,
    name,
    description: text.description[id],
    startsFrom: 'baseline' as const,
    requiresConfirmation: false,
  };
  const t = ROOM_SCENARIO_TUNING;
  // Эх үүсвэр зогсож, дохио шийдэгдэж, төхөөрөмж суурьт орох хүртэл (§7.1); `minMs` хүртэл шалгахгүй
  const until = (minMs: number) => ({ when: 'allNormal' as const, minMs });
  const ids = [area.id];

  switch (id) {
    case 'room-meeting':
      return {
        ...base,
        completion: until(t.meetingDurationMs),
        steps: [
          {
            atMs: 0,
            label: text.step.meetingStarts(area.name),
            action: { type: 'setOccupancy', areaIds: ids, fraction: 1, rampMs: 5_000 },
          },
          {
            atMs: t.meetingDurationMs,
            label: text.step.meetingEnds(area.name),
            action: {
              type: 'setOccupancy',
              areaIds: ids,
              fraction: area.baselineOccupancy,
              rampMs: 10_000,
            },
          },
        ],
        // Хүнтэй өрөө давхрын нэгтгэлд орно → давхрын түлхүүр (D89)
        expected: {
          alerts: [`threshold:co2:${area.floorId}`],
          events: [
            'SCENARIO_STARTED',
            'ALERT_RAISED',
            'DEVICE_STATE_CHANGED',
            'SCENARIO_COMPLETED',
          ],
        },
      };
    case 'room-server-overheat':
      return {
        ...base,
        completion: until(t.serverDurationMs),
        steps: [
          {
            atMs: 0,
            label: text.step.coolingStopped(area.name),
            action: {
              type: 'pulseSource',
              areaIds: ids,
              metric: 'temperature',
              rate: t.serverHeat,
              durationMs: t.serverDurationMs,
            },
          },
        ],
        // Техникийн өрөө → бүсийн түлхүүр; давхрын сэнс өөрчлөгдөхгүй (D89)
        expected: {
          alerts: [`threshold:temperature-high:${area.id}`],
          events: ['SCENARIO_STARTED', 'ALERT_RAISED', 'ALERT_ESCALATED', 'SCENARIO_COMPLETED'],
        },
      };
    case 'room-kitchen-cooking': {
      const k = t.kitchen;
      const pulse = (metric: 'pm25' | 'voc' | 'humidity' | 'temperature', rate: number) => ({
        atMs: 0,
        label: text.step.cooking(area.name),
        action: {
          type: 'pulseSource' as const,
          areaIds: ids,
          metric,
          rate,
          durationMs: k.durationMs,
        },
      });
      return {
        ...base,
        completion: until(k.durationMs),
        steps: [
          pulse('pm25', k.pm25),
          pulse('voc', k.voc),
          pulse('humidity', k.humidity),
          pulse('temperature', k.temperature),
        ],
        expected: {
          alerts: [
            `threshold:pm25:${area.id}`,
            `threshold:voc:${area.id}`,
            `threshold:humidity-high:${area.id}`,
          ],
          events: ['SCENARIO_STARTED', 'ALERT_RAISED', 'SCENARIO_COMPLETED'],
        },
      };
    }
    case 'room-restroom-humidity': {
      const r = t.restroom;
      const label = text.step.humidity(area.name);
      return {
        ...base,
        completion: until(r.durationMs),
        steps: [
          {
            atMs: 0,
            label,
            action: {
              type: 'pulseSource',
              areaIds: ids,
              metric: 'humidity',
              rate: r.humidity,
              durationMs: r.durationMs,
            },
          },
          {
            atMs: 0,
            label,
            action: {
              type: 'pulseSource',
              areaIds: ids,
              metric: 'voc',
              rate: r.voc,
              durationMs: r.durationMs,
            },
          },
        ],
        expected: {
          alerts: [`threshold:humidity-high:${area.id}`, `threshold:voc:${area.id}`],
          events: ['SCENARIO_STARTED', 'ALERT_RAISED', 'SCENARIO_COMPLETED'],
        },
      };
    }
    case 'room-sensor-disconnect': {
      const sensorId = `${area.id}-co2`;
      return {
        ...base,
        completion: until(t.disconnectMs),
        steps: [
          {
            atMs: 0,
            label: text.step.disconnect(area.name),
            action: { type: 'disconnectSensor', sensorIds: [sensorId] },
          },
          {
            atMs: t.disconnectMs,
            label: text.step.reconnect(area.name),
            action: { type: 'reconnectSensor', sensorIds: [sensorId] },
          },
        ],
        // Удирдлагад оролцох өрөө → нөөц горим (харалган цэг, D89); техникийн өрөө → зөвхөн холболтгүй дохио
        expected:
          area.controlRole === 'ventilation'
            ? {
                alerts: [`sensor_offline:${sensorId}`, `control_degraded:${area.floorId}`],
                events: [
                  'SCENARIO_STARTED',
                  'SENSOR_DISCONNECTED',
                  'CONTROL_FALLBACK_ACTIVE',
                  'SENSOR_RECONNECTED',
                  'CONTROL_FALLBACK_CLEARED',
                  'SCENARIO_COMPLETED',
                ],
              }
            : {
                alerts: [`sensor_offline:${sensorId}`],
                events: [
                  'SCENARIO_STARTED',
                  'SENSOR_DISCONNECTED',
                  'SENSOR_RECONNECTED',
                  'SCENARIO_COMPLETED',
                ],
              },
      };
    }
  }
}
