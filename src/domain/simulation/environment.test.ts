// §5.8-ын загвар ба D68-ийн тэнцвэрийн тохируулга: тэнцвэр, тогтвортой байдал, хариу хугацаа (Q4), бүртгэсэн
// хязгаарлалт (D68-ийн 5, 6). Хүлээгдэх утгыг тохиргооноос тооцно (§5.5) — тоог зориуд бэхэлсэн газарт тэмдэглэв.
import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';
import { baselineDeviceStates } from '@/domain/config/control';
import { simulationModel } from '@/domain/config/simulation';
import type { Area, DeviceKind, DeviceState, MetricType } from '@/domain/types';

import {
  baselineOccupants,
  baselineOutdoor,
  calibrateArea,
  stepAreaEnvironment,
  ventilationRates,
  type AreaEnvironment,
  type VentilationRates,
} from './environment';

const areas = Object.values(buildingConfig.areas);
const area = (id: string) => buildingConfig.areas[id]!;
const baselineRates = ventilationRates(baselineDeviceStates);

const devices = (
  supply: DeviceState & { kind: 'supply_fan' },
  exhaust: DeviceState & { kind: 'exhaust_fan' },
  damper: DeviceState & { kind: 'outdoor_air_damper' },
): Record<DeviceKind, DeviceState> => ({
  supply_fan: supply,
  exhaust_fan: exhaust,
  outdoor_air_damper: damper,
});
const OFF_STATES = devices(
  { kind: 'supply_fan', level: 'OFF' },
  { kind: 'exhaust_fan', level: 'OFF' },
  { kind: 'outdoor_air_damper', position: 'CLOSED' },
);
const MAX_STATES = devices(
  { kind: 'supply_fan', level: 'BOOST' },
  { kind: 'exhaust_fan', level: 'BOOST' },
  { kind: 'outdoor_air_damper', position: 'OPEN' },
);

/** `steps` алхам ажиллуулна */
function run(
  a: Area,
  start: AreaEnvironment,
  steps: number,
  rates: VentilationRates = baselineRates,
  occupants: number = baselineOccupants(a),
): AreaEnvironment[] {
  const calibration = calibrateArea(a);
  const states: AreaEnvironment[] = [];
  let state = start;
  for (let i = 0; i < steps; i += 1) {
    state = stepAreaEnvironment({
      state,
      calibration,
      rates,
      occupants,
      volumeM3: a.volumeM3,
      outdoor: baselineOutdoor,
      dtSec: 1,
    });
    states.push(state);
  }
  return states;
}

/** Суурь утгаас `delta` зөрүүтэй эхлүүлж, зөрүү 1/e болох алхмын тоо (хугацааны тогтмол, с) */
function stepsToOneOverE(a: Area, metric: MetricType, delta: number): number {
  const start = { ...a.baseline, [metric]: a.baseline[metric] + delta };
  const states = run(a, start, 2000);
  const index = states.findIndex(
    (s) => Math.abs(s[metric] - a.baseline[metric]) <= Math.abs(delta) / Math.E,
  );
  return index + 1;
}

describe('ventilationRates (§5.8, §5.7)', () => {
  it('суурь (SF LOW, EF LOW, OAD MINIMUM): oaR = 0.05·k_oa, exR = 0.25·k_ex, fR = 0.2·k_flt (D68)', () => {
    expect(baselineRates.outdoorAir).toBeCloseTo(0.05 * simulationModel.kOutdoorAir, 12);
    expect(baselineRates.exhaust).toBeCloseTo(0.25 * simulationModel.kExhaust, 12);
    expect(baselineRates.filtration).toBeCloseTo(0.2 * simulationModel.kFiltration, 12);
  });

  it('бүгд унтарсан үед бүх хурд 0', () => {
    expect(ventilationRates(OFF_STATES)).toEqual({ outdoorAir: 0, exhaust: 0, filtration: 0 });
  });
});

describe('calibrateArea — тэнцвэр = Area.baseline (D68, Q1)', () => {
  it.each(areas.map((a) => [a.id, a] as const))(
    '%s: суурь нөхцөлд 1 цаг (3600 алхам) суурь утгаасаа хөдлөхгүй',
    (_id, a) => {
      const last = run(a, { ...a.baseline }, 3600).at(-1)!;
      for (const metric of Object.keys(a.baseline) as MetricType[]) {
        expect(last[metric]).toBeCloseTo(a.baseline[metric], 9);
      }
    },
  );

  it('CO₂-ийн ялгаруулалт бүсээр ялгаатай (ганц g_co2 биш — D68): оффис 191.67, Их танхим 84, лобби 288', () => {
    // Зориуд бэхэлсэн утга (D68-д бүртгэсэн тооцоо)
    expect(calibrateArea(area('F07-A')).co2PerOccupant).toBeCloseTo(191.6667, 3);
    expect(calibrateArea(area('F02-A')).co2PerOccupant).toBeCloseTo(84, 6);
    expect(calibrateArea(area('F01-A')).co2PerOccupant).toBeCloseTo(288, 6);
  });

  it('тэмдэг: pmSource₀ > 0, heatGain₀ > 0, moistureSource₀ < 0 (математик тохируулгын гишүүн — D68-ийн 3)', () => {
    for (const a of areas) {
      const c = calibrateArea(a);
      expect(c.pmSource).toBeGreaterThan(0);
      expect(c.heatGain).toBeGreaterThan(0);
      expect(c.moistureSource).toBeLessThan(0);
      expect(c.setpoint).toBe(a.baseline.temperature);
      expect(c.vocBaseline).toBe(a.baseline.voc);
    }
  });
});

describe('тогтвортой байдал (Euler, dt = 1 с)', () => {
  it('хамгийн их агааржуулалтад ч dt·λ < 1 — хэлбэлзэлгүй, монотон буурна', () => {
    const rates = ventilationRates(MAX_STATES);
    const lambdaCo2 = rates.outdoorAir + rates.exhaust;
    expect(lambdaCo2).toBeLessThan(1);
    expect(lambdaCo2).toBeCloseTo(0.1111, 4);

    const a = area('F07-A');
    const states = run(a, { ...a.baseline, co2: 1500 }, 300, rates);
    let previous = 1500;
    for (const state of states) {
      expect(state.co2).toBeLessThanOrEqual(previous);
      expect(state.co2).toBeGreaterThanOrEqual(baselineOutdoor.co2); // тэнцвэрийг хэтрэхгүй (overshoot-гүй)
      previous = state.co2;
    }
  });

  it('суурь нөхцөлд эвдэрсэн төлөвөөс суурь руу буцна (бүх хэмжигдэхүүн)', () => {
    const a = area('F12-A');
    const perturbed = { temperature: 27, co2: 1200, humidity: 55, pm25: 20, voc: 250 };
    const last = run(a, perturbed, 5000).at(-1)!;
    for (const metric of Object.keys(a.baseline) as MetricType[]) {
      expect(last[metric]).toBeCloseTo(a.baseline[metric], 3);
    }
  });
});

describe('хариу хугацаа — суурь үед (Q4: тестээр баталгаажуулна)', () => {
  const a = area('F07-A');

  it('CO₂ ба VOC ≈ 60 с, PM2.5 ≈ 80 с, температур ≈ 72 с — §5.8-ын 30–90 с-ийн зорилтод', () => {
    const tau = {
      co2: stepsToOneOverE(a, 'co2', 300),
      voc: stepsToOneOverE(a, 'voc', 100),
      pm25: stepsToOneOverE(a, 'pm25', 10),
      temperature: stepsToOneOverE(a, 'temperature', 3),
    };
    expect(tau.co2).toBeGreaterThanOrEqual(59);
    expect(tau.co2).toBeLessThanOrEqual(61);
    expect(tau.voc).toBe(tau.co2);
    expect(tau.pm25).toBeGreaterThanOrEqual(79);
    expect(tau.pm25).toBeLessThanOrEqual(81);
    expect(tau.temperature).toBeGreaterThanOrEqual(71);
    expect(tau.temperature).toBeLessThanOrEqual(73);
    for (const value of Object.values(tau)) {
      expect(value).toBeGreaterThanOrEqual(30);
      expect(value).toBeLessThanOrEqual(90);
    }
  });

  it('RH ≈ 360 с — 30–90 с-ийн зорилтоос удаан (D68-д бүртгэсэн; чийгшил зөвхөн дохио, §6.5)', () => {
    const tau = stepsToOneOverE(a, 'humidity', 5);
    expect(tau).toBeGreaterThanOrEqual(359);
    expect(tau).toBeLessThanOrEqual(361);
  });

  it('агааржуулалт нэмэгдэхэд (R-IAQ-WARNING-ийн SF HIGH, EF MEDIUM, OAD PARTIAL) CO₂-ийн хариу ≈ 20 с', () => {
    const rates = ventilationRates(
      devices(
        { kind: 'supply_fan', level: 'HIGH' },
        { kind: 'exhaust_fan', level: 'MEDIUM' },
        { kind: 'outdoor_air_damper', position: 'PARTIAL' },
      ),
    );
    expect(1 / (rates.outdoorAir + rates.exhaust)).toBeCloseTo(20, 6);
  });
});

describe('бүртгэсэн хязгаарлалт (зориуд бэхэлсэн — шийдвэр гартал өөрчлөгдөхгүй)', () => {
  it('D68-ийн 5 (F02/S3, Phase 6): тэнцвэрт ачаалал 100% үед F02-A ≈ 980 ppm (< 1000)', () => {
    const a = area('F02-A');
    const occupants = a.occupancyCapacity * 1.0;
    const last = run(a, { ...a.baseline }, 3000, baselineRates, occupants).at(-1)!;
    expect(last.co2).toBeCloseTo(980, 0);
    expect(last.co2).toBeLessThan(1000);
  });

  it('D68-ийн 6 (Phase 5-аас өмнө шийднэ): SF OFF үед PM2.5 шугаман өсч, RH буурна; EF нөлөөлөхгүй', () => {
    const a = area('F07-A');
    const c = calibrateArea(a);
    const off = run(a, { ...a.baseline }, 600, ventilationRates(OFF_STATES)).at(-1)!;
    expect(off.pm25 - a.baseline.pm25).toBeCloseTo(600 * c.pmSource, 6); // ≈ +30.8 µg/m³
    expect(off.humidity - a.baseline.humidity).toBeCloseTo(600 * c.moistureSource, 6); // ≈ −16.7
    // EF BOOST ч гэсэн SF OFF / OAD CLOSED бол ижил
    const efOnly = run(
      a,
      { ...a.baseline },
      600,
      ventilationRates(
        devices(
          { kind: 'supply_fan', level: 'OFF' },
          { kind: 'exhaust_fan', level: 'BOOST' },
          { kind: 'outdoor_air_damper', position: 'CLOSED' },
        ),
      ),
    ).at(-1)!;
    expect(efOnly.pm25).toBeCloseTo(off.pm25, 9);
    expect(efOnly.humidity).toBeCloseTo(off.humidity, 9);
  });
});
