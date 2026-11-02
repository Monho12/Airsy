import { describe, expect, it } from 'vitest';

import { createBuildingConfig, deviceIdOf } from '@/domain/config/building';
import { baselineDeviceStates, controlConfig } from '@/domain/config/control';
import { simulationConfig } from '@/domain/config/simulation';
import { timingThresholds } from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import type { FloorAggregates } from '@/domain/simulation/floorAggregates';
import type {
  ControlState,
  DeviceId,
  DeviceKind,
  FloorMetricAggregate,
  OutdoorConditions,
  ThresholdLevel,
  VentilationDevice,
} from '@/domain/types';

import { createRuleDebounceState, type RuleDebounceState } from './controlState';
import { evaluateControl, type ControlEngineOutput } from './engine';
import { stateRank } from './levels';

const config = createBuildingConfig(12);
const N = timingThresholds.ruleDebounceSteps;
const START = simulationConfig.startTime;
const STEP = simulationConfig.stepMs;

function initialDevices(): Record<DeviceId, VentilationDevice> {
  const out: Record<DeviceId, VentilationDevice> = {};
  for (const d of Object.values(config.devices)) {
    out[d.id] = {
      id: d.id,
      floorId: d.floorId,
      kind: d.kind,
      name: mn.devices.deviceName(d.kind, d.floorId),
      state: baselineDeviceStates[d.kind],
      mode: 'auto',
      manualOverride: null,
      lastChangedAt: START - 60_000,
      lastChangeReason: '',
      lastRuleId: null,
    };
  }
  return out;
}

const oneSided = (max: number, high: ThresholdLevel): FloorMetricAggregate => ({
  max,
  min: max,
  validCount: 2,
  levels: { kind: 'one-sided', high },
});
const twoSided = (
  max: number,
  high: ThresholdLevel,
  low: ThresholdLevel = 'normal',
): FloorMetricAggregate => ({
  max,
  min: max,
  validCount: 2,
  levels: { kind: 'two-sided', high, low },
});

/** Бүх давхар хэвийн суурь нэгтгэл; `override` нь заасан давхрыг солино */
function aggregates(
  override: Partial<Record<string, Partial<Record<string, FloorMetricAggregate | undefined>>>> = {},
): FloorAggregates {
  const out: FloorAggregates = {};
  for (const floorId of config.building.floorIds) {
    out[floorId] = {
      temperature: twoSided(22.5, 'normal'),
      co2: oneSided(650, 'normal'),
      humidity: twoSided(45, 'normal'),
      pm25: oneSided(5, 'normal'),
      voc: oneSided(100, 'normal'),
      ...(override[floorId] as object),
    };
    for (const [k, v] of Object.entries(override[floorId] ?? {})) {
      if (v === undefined) delete (out[floorId] as Record<string, unknown>)[k];
    }
  }
  return out;
}

const OUTDOOR: OutdoorConditions = { temperature: 18, humidity: 55, pm25: 8, co2: 420 };
const CONTROL: ControlState = {
  autoMode: true,
  outdoorAirRestricted: false,
  pmDilutionAllowed: true,
  fallbackFloors: [],
  freeCoolingFloors: [],
  emergency: null,
};

interface Sim {
  devices: Record<DeviceId, VentilationDevice>;
  control: ControlState;
  debounce: RuleDebounceState;
  now: number;
  last?: ControlEngineOutput;
  events: ControlEngineOutput['events'];
}

function sim(control: Partial<ControlState> = {}): Sim {
  return {
    devices: initialDevices(),
    control: { ...CONTROL, ...control },
    debounce: createRuleDebounceState(),
    now: START,
    events: [],
  };
}

function step(
  s: Sim,
  agg: FloorAggregates,
  outdoor: OutdoorConditions = OUTDOOR,
  steps = 1,
): ControlEngineOutput {
  let out!: ControlEngineOutput;
  for (let i = 0; i < steps; i += 1) {
    s.now += STEP;
    out = evaluateControl({
      config,
      devices: s.devices,
      aggregates: agg,
      outdoor,
      control: s.control,
      debounce: s.debounce,
      now: s.now,
    });
    s.devices = out.devices;
    s.control = out.control;
    s.debounce = out.debounce;
    s.events.push(...out.events);
  }
  s.last = out;
  return out;
}

const state = (s: Sim, floorId: string, kind: DeviceKind) => {
  const st = s.devices[deviceIdOf(floorId, kind)]!.state;
  return st.kind === 'outdoor_air_damper' ? st.position : st.level;
};

describe('суурь ба idempotence (§6.6, FR-C4)', () => {
  it('хэвийн үед команд ч, үйл явдал ч үгүй; шийдвэр unchanged, R-BASELINE', () => {
    const s = sim();
    const out = step(s, aggregates(), OUTDOOR, 20);
    expect(s.events).toEqual([]);
    expect(out.devices).toBe(s.devices);
    expect(out.decisions['F07-SF']).toMatchObject({
      outcome: 'unchanged',
      winningRuleId: 'R-BASELINE',
    });
    expect(Object.keys(out.decisions)).toHaveLength(36);
  });
});

describe('CO₂/VOC IAQ (§6.3) ба дүрмийн debounce', () => {
  it(`CO₂ анхааруулга ${N} алхмын дараа SF HIGH, EF MEDIUM, OAD PARTIAL; шалтгаантай яг нэг үйл явдал`, () => {
    const s = sim();
    const agg = aggregates({ F02: { co2: oneSided(1180, 'warning') } });
    step(s, agg, OUTDOOR, N - 1);
    expect(state(s, 'F02', 'supply_fan')).toBe('LOW');
    step(s, agg);
    expect([
      state(s, 'F02', 'supply_fan'),
      state(s, 'F02', 'exhaust_fan'),
      state(s, 'F02', 'outdoor_air_damper'),
    ]).toEqual(['HIGH', 'MEDIUM', 'PARTIAL']);
    const changed = s.events.filter((e) => e.type === 'DEVICE_STATE_CHANGED');
    expect(changed).toHaveLength(3);
    expect(changed[0]).toMatchObject({
      deviceId: 'F02-SF',
      ruleId: 'R-IAQ-WARNING',
      previousState: { kind: 'supply_fan', level: 'LOW' },
      newState: { kind: 'supply_fan', level: 'HIGH' },
      actor: 'system',
    });
    expect(changed[0]!.reason).toContain('1,180');
    expect(changed[0]!.trigger).toBeTruthy();
  });

  it(`warning → critical мөн ${N} алхам, энэ хооронд R-IAQ-WARNING идэвхтэй хэвээр`, () => {
    const s = sim();
    step(s, aggregates({ F02: { co2: oneSided(1200, 'warning') } }), OUTDOOR, N);
    const critical = aggregates({ F02: { co2: oneSided(1600, 'critical') } });
    step(s, critical, OUTDOOR, N - 1);
    expect(state(s, 'F02', 'supply_fan')).toBe('HIGH');
    expect(s.last!.decisions['F02-SF']!.winningRuleId).toBe('R-IAQ-WARNING');
    step(s, critical);
    expect(state(s, 'F02', 'supply_fan')).toBe('BOOST');
    expect(s.last!.decisions['F02-SF']!.winningRuleId).toBe('R-IAQ-CRITICAL');
    expect(s.last!.decisions['F02-SF']!.contributingRuleIds).toEqual([]);
  });

  it('1000 ppm орчимд ±5 ppm хэлбэлзэх утга давтан үйл явдал үүсгэхгүй (hysteresis-ийн дараах түвшин тогтвортой)', () => {
    const s = sim();
    // Ангилал hysteresis-ийн дараах түвшинг өгнө: 995–1005-д warning хэвээр (гарах 950)
    for (let i = 0; i < 200; i += 1) {
      step(s, aggregates({ F02: { co2: oneSided(1000 + (i % 2 === 0 ? 5 : -5), 'warning') } }));
    }
    expect(s.events.filter((e) => e.type === 'DEVICE_STATE_CHANGED')).toHaveLength(3);
  });

  it('бууралт барих хугацааг хүндэтгэж, нэг нэг түвшингээр суурь руу буцна', () => {
    const s = sim();
    step(s, aggregates({ F06: { voc: oneSided(320, 'critical') } }), OUTDOOR, N);
    expect(state(s, 'F06', 'supply_fan')).toBe('BOOST');
    const holdSteps = controlConfig.minStateHoldMs / STEP;
    step(s, aggregates(), OUTDOOR, holdSteps - 1);
    expect(state(s, 'F06', 'supply_fan')).toBe('BOOST');
    expect(s.last!.decisions['F06-SF']!.outcome).toBe('held_by_dwell');
    const sfLevels: string[] = [];
    for (let i = 0; i < holdSteps * 4; i += 1) {
      step(s, aggregates());
      const level = state(s, 'F06', 'supply_fan');
      if (sfLevels.at(-1) !== level) sfLevels.push(level);
    }
    expect(sfLevels).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(state(s, 'F06', 'outdoor_air_damper')).toBe('MINIMUM');
    expect(state(s, 'F06', 'exhaust_fan')).toBe('LOW');
  });
});

describe('PM2.5 (§6.5-ын 4 тохиолдол)', () => {
  const pmWarn = { pm25: oneSided(20, 'warning') };

  it('1 — гадна цэвэр: SF HIGH, OAD PARTIAL; EF-д хүсэлт гаргахгүй', () => {
    const s = sim();
    const out = step(s, aggregates({ F05: pmWarn }), OUTDOOR, N);
    expect(state(s, 'F05', 'supply_fan')).toBe('HIGH');
    expect(state(s, 'F05', 'outdoor_air_damper')).toBe('PARTIAL');
    expect(out.decisions['F05-EF']!.candidates.some((r) => r.ruleId === 'R-IAQ-WARNING')).toBe(
      false,
    );
    expect(state(s, 'F05', 'exhaust_fan')).toBe('LOW');
  });

  it('2 — гадна цэвэр биш (≥ 12): SF HIGH, OAD MINIMUM', () => {
    const s = sim();
    step(s, aggregates({ F05: pmWarn }), { ...OUTDOOR, pm25: 20 }, N);
    expect(state(s, 'F05', 'supply_fan')).toBe('HIGH');
    expect(state(s, 'F05', 'outdoor_air_damper')).toBe('MINIMUM');
  });

  it('3 — гадна өгөгдөлгүй: шингэлэхгүй (MINIMUM), C-OUTDOOR-AIR өмнөх төлөвөө хадгална', () => {
    const s = sim({ outdoorAirRestricted: true });
    const out = step(s, aggregates({ F05: pmWarn }), { ...OUTDOOR, pm25: null }, N);
    expect(out.control.pmDilutionAllowed).toBe(false);
    expect(out.control.outdoorAirRestricted).toBe(true);
    expect(state(s, 'F05', 'outdoor_air_damper')).toBe('MINIMUM');
  });

  it('4 — PM2.5 ба CO₂ зөрчил: CO₂-ийн PARTIAL нь PM2.5-ын MINIMUM-ийг давна; шийдвэрт хоёр хүсэлт', () => {
    const s = sim();
    const out = step(
      s,
      aggregates({ F02: { pm25: oneSided(20, 'warning'), co2: oneSided(1100, 'warning') } }),
      { ...OUTDOOR, pm25: 20 },
      N,
    );
    expect([
      state(s, 'F02', 'supply_fan'),
      state(s, 'F02', 'exhaust_fan'),
      state(s, 'F02', 'outdoor_air_damper'),
    ]).toEqual(['HIGH', 'MEDIUM', 'PARTIAL']);
    const oadTargets = out.decisions['F02-OAD']!.candidates.filter(
      (r) => r.ruleId === 'R-IAQ-WARNING',
    ).map((r) => (r.target.kind === 'outdoor_air_damper' ? r.target.position : ''));
    expect(oadTargets.sort()).toEqual(['MINIMUM', 'PARTIAL']);
  });
});

describe('C-OUTDOOR-AIR (§6.3) ба дулаан (§6.5)', () => {
  it('гадна PM2.5 ≥ 35: OAD MINIMUM-д баригдаж, шалтгаанд хязгаарлалт; constraint үйл явдал', () => {
    const s = sim();
    const out = step(
      s,
      aggregates({ F02: { co2: oneSided(1180, 'warning') } }),
      { ...OUTDOOR, pm25: 52 },
      N,
    );
    expect(state(s, 'F02', 'outdoor_air_damper')).toBe('MINIMUM');
    expect(state(s, 'F02', 'supply_fan')).toBe('HIGH');
    const decision = out.decisions['F02-OAD']!;
    expect(decision.requestedState).toEqual({ kind: 'outdoor_air_damper', position: 'PARTIAL' });
    expect(decision.constraintsApplied.map((c) => c.id)).toEqual(['C-OUTDOOR-AIR']);
    expect(decision.reason).toContain('52');
    expect(s.events.filter((e) => e.type === 'CONTROL_CONSTRAINT_ACTIVE')).toHaveLength(1);
  });

  it('өндөр температур: үнэгүй хөргөлттэй бол OAD OPEN; бага температур R-THERMAL-ийг ажиллуулахгүй', () => {
    const s = sim();
    step(
      s,
      aggregates({ F12: { temperature: twoSided(26.5, 'warning') } }),
      { ...OUTDOOR, temperature: 16 },
      N,
    );
    expect(state(s, 'F12', 'supply_fan')).toBe('HIGH');
    expect(state(s, 'F12', 'outdoor_air_damper')).toBe('OPEN');
    const cold = sim();
    step(
      cold,
      aggregates({ F03: { temperature: twoSided(18.5, 'normal', 'warning') } }),
      OUTDOOR,
      N + 5,
    );
    expect(cold.events).toEqual([]);
  });

  it('гадна халуун (үнэгүй хөргөлтгүй): SF HIGH, OAD MINIMUM', () => {
    const s = sim();
    step(
      s,
      aggregates({ F12: { temperature: twoSided(26.5, 'warning') } }),
      { ...OUTDOOR, temperature: 30 },
      N,
    );
    expect(state(s, 'F12', 'outdoor_air_damper')).toBe('MINIMUM');
  });

  const oadFlips = (deltaAt: (i: number) => number, steps: number) => {
    const s = sim();
    const changes: string[] = [];
    for (let i = 0; i < steps; i += 1) {
      step(s, aggregates({ F12: { temperature: twoSided(27, 'warning') } }), {
        ...OUTDOOR,
        temperature: 27 - deltaAt(i),
      });
      const p = state(s, 'F12', 'outdoor_air_damper');
      if (changes.at(-1) !== p) changes.push(p);
    }
    return changes.length - 1;
  };

  it('гадна/дотоод зөрүү 2 °C орчим олон мөчлөг хэлбэлзэхэд OAD хэлбэлзэхгүй (1–2 °C-ийн зурвас)', () => {
    // 1.2…2.5 °C — 2 °C-ийг олон удаа давна, гарах босго 1 °C-д хүрэхгүй
    expect(oadFlips((i) => 1.85 + Math.sin(i / 5) * 0.65, 600)).toBeLessThanOrEqual(1);
  });

  it('0.5 ↔ 2.5 °C алхам бүрт үсэрвэл ч OAD-ийн бууралт барих хугацаагаар хязгаарлагдана', () => {
    const steps = 600;
    const holdSteps = controlConfig.minStateHoldMs / STEP;
    // Хоёр босгыг алхам бүрт давна — бууралт дээд тал нь барих хугацаа тутам нэг (§6.6)
    expect(oadFlips((i) => (i % 2 === 0 ? 2.5 : 0.5), steps)).toBeLessThanOrEqual(
      (2 * steps) / holdSteps + 1,
    );
  });
});

describe('R-SENSOR-FALLBACK (§6.3)', () => {
  it(`бүх CO₂ алга бол ${N} алхмын дараа SF MEDIUM, нөөц горимын үйл явдал; эргэн ирмэгц цуцлагдана`, () => {
    const s = sim();
    const missing = aggregates({ F04: { co2: undefined } });
    step(s, missing, OUTDOOR, N);
    expect(s.control.fallbackFloors).toEqual(['F04']);
    expect([
      state(s, 'F04', 'supply_fan'),
      state(s, 'F04', 'exhaust_fan'),
      state(s, 'F04', 'outdoor_air_damper'),
    ]).toEqual(['MEDIUM', 'LOW', 'MINIMUM']);
    const types = s.events.map((e) => e.type);
    expect(types).toEqual(['CONTROL_FALLBACK_ACTIVE', 'DEVICE_STATE_CHANGED']);
    expect(s.events[1]).toMatchObject({ deviceId: 'F04-SF', ruleId: 'R-SENSOR-FALLBACK' });
    step(s, aggregates());
    expect(s.control.fallbackFloors).toEqual([]);
    expect(s.events.at(-1)!.type).toBe('CONTROL_FALLBACK_CLEARED');
  });

  it('бүх CO₂ алга + VOC ноцтой → SF BOOST хэвээр (доод хязгаар бууруулахгүй)', () => {
    const s = sim();
    step(s, aggregates({ F04: { co2: undefined, voc: oneSided(320, 'critical') } }), OUTDOOR, N);
    expect(state(s, 'F04', 'supply_fan')).toBe('BOOST');
  });
});

describe('автомат/гар горим (§6.7, FR-C6, FR-C7)', () => {
  it('автомат горим унтраалттай: recommendation_only, төлөв өөрчлөгдөхгүй, үйл явдалгүй', () => {
    const s = sim({ autoMode: false });
    const out = step(s, aggregates({ F02: { co2: oneSided(1200, 'warning') } }), OUTDOOR, N + 2);
    expect(state(s, 'F02', 'supply_fan')).toBe('LOW');
    expect(out.decisions['F02-SF']).toMatchObject({ outcome: 'recommendation_only' });
    expect(out.decisions['F02-SF']!.reason).toContain(mn.devices.fanLevel.HIGH);
    expect(s.events).toEqual([]);
  });

  it('гар удирдлагатай төхөөрөмжийг engine алгасна (outcome manual); хугацаа дуусахад EXPIRED', () => {
    const s = sim();
    const id = 'F02-SF';
    s.devices = {
      ...s.devices,
      [id]: {
        ...s.devices[id]!,
        state: { kind: 'supply_fan', level: 'OFF' },
        mode: 'manual',
        manualOverride: {
          state: { kind: 'supply_fan', level: 'OFF' },
          setAt: START,
          expiresAt: START + 5 * STEP,
        },
      },
    };
    const out = step(s, aggregates({ F02: { co2: oneSided(1200, 'warning') } }), OUTDOOR, N);
    expect(state(s, 'F02', 'supply_fan')).toBe('OFF');
    expect(out.decisions[id]!.outcome).toBe('manual');
    expect(out.decisions[id]!.winningRuleId).toBe('R-MANUAL');
    expect(out.decisions[id]!.reason).toContain(
      mn.control.autoWouldChoose(mn.devices.fanLevel.HIGH),
    );
    step(s, aggregates({ F02: { co2: oneSided(1200, 'warning') } }), OUTDOOR, 3);
    expect(s.events.some((e) => e.type === 'MANUAL_OVERRIDE_EXPIRED' && e.deviceId === id)).toBe(
      true,
    );
    expect(s.devices[id]!.mode).toBe('auto');
    expect(state(s, 'F02', 'supply_fan')).toBe('HIGH');
  });
});

describe('R-EMERGENCY (§6.9, D15)', () => {
  it('бүх давхарт нэг алхамд; гар удирдлага, автомат унтраалттай, хязгаарлалт, барих хугацааг давна', () => {
    const s = sim({
      autoMode: false,
      outdoorAirRestricted: true,
      emergency: { fireFloorId: 'F08', startedAt: START },
    });
    s.devices = {
      ...s.devices,
      'F07-SF': {
        ...s.devices['F07-SF']!,
        state: { kind: 'supply_fan', level: 'BOOST' },
        mode: 'manual',
        lastChangedAt: START,
        manualOverride: {
          state: { kind: 'supply_fan', level: 'BOOST' },
          setAt: START,
          expiresAt: START + 600_000,
        },
      },
    };
    const out = step(s, aggregates(), { ...OUTDOOR, pm25: 60 });
    expect([
      state(s, 'F08', 'supply_fan'),
      state(s, 'F08', 'exhaust_fan'),
      state(s, 'F08', 'outdoor_air_damper'),
    ]).toEqual(['OFF', 'BOOST', 'CLOSED']);
    for (const f of ['F07', 'F09']) {
      expect([
        state(s, f, 'supply_fan'),
        state(s, f, 'exhaust_fan'),
        state(s, f, 'outdoor_air_damper'),
      ]).toEqual(['HIGH', 'OFF', 'OPEN']);
    }
    expect([
      state(s, 'F01', 'supply_fan'),
      state(s, 'F01', 'exhaust_fan'),
      state(s, 'F01', 'outdoor_air_damper'),
    ]).toEqual(['OFF', 'OFF', 'CLOSED']);
    expect(out.decisions['F07-SF']!.outcome).toBe('emergency');
    expect(s.devices['F07-SF']!.mode).toBe('emergency');
    expect(s.devices['F07-SF']!.manualOverride).not.toBeNull(); // түр зогссон, цуцлагдаагүй
    const changed = s.events.filter((e) => e.type === 'DEVICE_STATE_CHANGED');
    expect(changed.every((e) => e.ruleId === 'R-EMERGENCY')).toBe(true);
    // F07/F09 OAD MINIMUM → OPEN нь хязгаарлалтаас үл хамааран
    expect(stateRank(s.devices['F09-OAD']!.state)).toBe(3);
  });
});
