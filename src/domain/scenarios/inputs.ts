// Сценарийн оролт (CLAUDE.md §5.8, §7.1, §10 `ScenarioAction`). Сценари утгыг шууд биш, ОРОЛТЫГ өөрчилнө:
// хүний ачаалал, нэмэлт дулаан, VOC/PM эх үүсвэр, гадна нөхцөл. Цэвэр функцууд — ижил оролт → ижил гаралт.
// Хугацаа нь симуляцийн цаг; оролт бүр «налуу» (ramp) — эхлэх, дуусах хугацааны хооронд шугамаар шилжинэ.
import type { BuildingConfig } from '@/domain/config/building';
import type { OutdoorEnvironment, ScenarioSources } from '@/domain/simulation/environment';
import type { Area, AreaId, FloorId, ScenarioAction, SimTimeMs } from '@/domain/types';

/** `from` → `to` шугаман шилжилт `[startAt, endAt]` хугацаанд */
export interface Ramp {
  from: number;
  to: number;
  startAt: SimTimeMs;
  endAt: SimTimeMs;
}

export const constantRamp = (value: number, at: SimTimeMs): Ramp => ({
  from: value,
  to: value,
  startAt: at,
  endAt: at,
});

export function rampValue(ramp: Ramp, now: SimTimeMs): number {
  if (now >= ramp.endAt) return ramp.to;
  if (now <= ramp.startAt) return ramp.from;
  return ramp.from + ((ramp.to - ramp.from) * (now - ramp.startAt)) / (ramp.endAt - ramp.startAt);
}

/** Одоогийн утгаас `to` руу `rampMs`-д шилжих шинэ налуу */
const retarget = (ramp: Ramp, to: number, now: SimTimeMs, rampMs = 0): Ramp => ({
  from: rampValue(ramp, now),
  to,
  startAt: now,
  endAt: now + rampMs,
});

/** VOC/PM2.5-ын түр эх үүсвэр (`pulseSource`) */
export interface Pulse {
  areaIds: AreaId[];
  metric: 'voc' | 'pm25';
  rate: number;
  startAt: SimTimeMs;
  endAt: SimTimeMs;
}

type OutdoorField = keyof Omit<OutdoorEnvironment, 'co2'>;
const OUTDOOR_FIELDS: readonly OutdoorField[] = ['temperature', 'humidity', 'pm25'];

export interface ScenarioInputs {
  /** Бүс бүрийн ачааллын хувь (0–1) */
  occupancy: Record<AreaId, Ramp>;
  /** Давхар бүрийн НЭМЭЛТ дулааны ачаалал, °C/с (суурь `heatGain₀` дээр) */
  heatGain: Record<FloorId, Ramp>;
  outdoor: Record<OutdoorField, Ramp>;
  pulses: Pulse[];
}

/** Суурь оролт (§7.4-ийн матриц «Сценарийн оролт ✓ суурь»): суурь ачаалал, нэмэлт дулаангүй, S1-ийн гадна нөхцөл */
export function createBaselineInputs(
  config: BuildingConfig,
  outdoor: OutdoorEnvironment,
  now: SimTimeMs,
): ScenarioInputs {
  const occupancy: Record<AreaId, Ramp> = {};
  for (const area of Object.values(config.areas)) {
    occupancy[area.id] = constantRamp(area.baselineOccupancy, now);
  }
  const heatGain: Record<FloorId, Ramp> = {};
  for (const floorId of config.building.floorIds) heatGain[floorId] = constantRamp(0, now);
  return {
    occupancy,
    heatGain,
    outdoor: {
      temperature: constantRamp(outdoor.temperature, now),
      humidity: constantRamp(outdoor.humidity, now),
      pm25: constantRamp(outdoor.pm25, now),
    },
    pulses: [],
  };
}

/** Оролтод хамаарах үйлдэл (мэдрэгчийн эвдрэл, яаралтай байдлыг runtime өөрөө гүйцэтгэнэ) */
export type InputAction = Extract<
  ScenarioAction,
  { type: 'setOccupancy' | 'setHeatGain' | 'pulseSource' | 'setOutdoor' | 'restoreBaselineInputs' }
>;

export const isInputAction = (action: ScenarioAction): action is InputAction =>
  action.type === 'setOccupancy' ||
  action.type === 'setHeatGain' ||
  action.type === 'pulseSource' ||
  action.type === 'setOutdoor' ||
  action.type === 'restoreBaselineInputs';

/** Нэг үйлдлийг оролтод хэрэгжүүлнэ (шинэ объект буцаана) */
export function applyInputAction(
  inputs: ScenarioInputs,
  action: InputAction,
  config: BuildingConfig,
  baselineOutdoor: OutdoorEnvironment,
  now: SimTimeMs,
): ScenarioInputs {
  switch (action.type) {
    case 'setOccupancy': {
      const ids = action.areaIds === 'all' ? Object.keys(config.areas) : action.areaIds;
      const occupancy = { ...inputs.occupancy };
      for (const id of ids) {
        const ramp = occupancy[id];
        if (ramp !== undefined) occupancy[id] = retarget(ramp, action.fraction, now, action.rampMs);
      }
      return { ...inputs, occupancy };
    }
    case 'setHeatGain': {
      const heatGain = { ...inputs.heatGain };
      for (const id of action.floorIds) {
        const ramp = heatGain[id];
        if (ramp !== undefined) heatGain[id] = retarget(ramp, action.value, now, action.rampMs);
      }
      return { ...inputs, heatGain };
    }
    case 'pulseSource':
      return {
        ...inputs,
        pulses: [
          ...inputs.pulses,
          {
            areaIds: action.areaIds,
            metric: action.metric,
            rate: action.rate,
            startAt: now,
            endAt: now + action.durationMs,
          },
        ],
      };
    case 'setOutdoor': {
      const outdoor = { ...inputs.outdoor };
      for (const field of OUTDOOR_FIELDS) {
        const value = action.values[field];
        if (value !== undefined && value !== null) {
          outdoor[field] = retarget(outdoor[field], value, now, action.rampMs);
        }
      }
      return { ...inputs, outdoor };
    }
    case 'restoreBaselineInputs': {
      // Бүх оролт `rampMs`-д суурь руу; идэвхтэй импульс тэр даруй зогсоно
      const occupancy: Record<AreaId, Ramp> = {};
      for (const [id, ramp] of Object.entries(inputs.occupancy)) {
        occupancy[id] = retarget(ramp, config.areas[id]!.baselineOccupancy, now, action.rampMs);
      }
      const heatGain: Record<FloorId, Ramp> = {};
      for (const [id, ramp] of Object.entries(inputs.heatGain)) {
        heatGain[id] = retarget(ramp, 0, now, action.rampMs);
      }
      const outdoor = { ...inputs.outdoor };
      for (const field of OUTDOOR_FIELDS) {
        outdoor[field] = retarget(outdoor[field], baselineOutdoor[field], now, action.rampMs);
      }
      return { occupancy, heatGain, outdoor, pulses: [] };
    }
  }
}

/** Хугацаа өнгөрсөн импульсийг хасна (санах ой хязгаартай) */
export function pruneInputs(inputs: ScenarioInputs, now: SimTimeMs): ScenarioInputs {
  const pulses = inputs.pulses.filter((pulse) => pulse.endAt > now);
  return pulses.length === inputs.pulses.length ? inputs : { ...inputs, pulses };
}

/** Энэ агшны гадна нөхцөл */
export function outdoorAt(inputs: ScenarioInputs, co2: number, now: SimTimeMs): OutdoorEnvironment {
  return {
    temperature: rampValue(inputs.outdoor.temperature, now),
    humidity: rampValue(inputs.outdoor.humidity, now),
    pm25: rampValue(inputs.outdoor.pm25, now),
    co2,
  };
}

/** Энэ агшны бүсийн хүний тоо */
export const occupantsAt = (inputs: ScenarioInputs, area: Area, now: SimTimeMs) =>
  area.occupancyCapacity * rampValue(inputs.occupancy[area.id]!, now);

/** Энэ агшны бүсийн нэмэлт эх үүсвэр. Импульс `[startAt, endAt)` хугацаанд идэвхтэй. */
export function sourcesAt(inputs: ScenarioInputs, area: Area, now: SimTimeMs): ScenarioSources {
  let vocSource = 0;
  let pmSource = 0;
  for (const pulse of inputs.pulses) {
    if (now < pulse.startAt || now >= pulse.endAt || !pulse.areaIds.includes(area.id)) continue;
    if (pulse.metric === 'voc') vocSource += pulse.rate;
    else pmSource += pulse.rate;
  }
  const heat = inputs.heatGain[area.floorId];
  return { heatGain: heat === undefined ? 0 : rampValue(heat, now), vocSource, pmSource };
}
