import { describe, expect, it } from 'vitest';

import {
  conditionsByMetric,
  indoorThresholds,
  metricSpecs,
  type ThresholdDefinition,
} from '@/domain/config/thresholds';
import { mn } from '@/domain/i18n/mn';
import type {
  ConnectionStatus,
  MetricType,
  ReadingClassification,
  ThresholdConditionId,
} from '@/domain/types';

import { classifyReading } from './classifyReading';

const classify = (
  metric: MetricType,
  value: number | null,
  previous: ReadingClassification | null = null,
  connection: ConnectionStatus = 'online',
) => classifyReading(metric, value, connection, previous, indoorThresholds);

const CONDITIONS = Object.keys(indoorThresholds) as ThresholdConditionId[];

/** Тухайн хэмжигдэхүүний хамгийн бага алхам (§5.4-ийн нарийвчлал). */
const stepOf = (metric: MetricType) => (metricSpecs[metric].decimals === 1 ? 0.1 : 1);

/** «Муу» чиглэлд `delta`-аар шилжүүлнэ: high талд +, low талд −. */
const worse = (def: ThresholdDefinition, value: number, delta: number) =>
  def.side === 'high' ? value + delta : value - delta;
const better = (def: ThresholdDefinition, value: number, delta: number) =>
  worse(def, value, -delta);
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Тухайн талын түвшинг гаргана. */
const sideLevel = (result: ReadingClassification, def: ThresholdDefinition) => {
  if (result.levels === null) return null;
  if (def.side === 'high') return result.levels.high;
  return result.levels.kind === 'two-sided' ? result.levels.low : null;
};

describe('classifyReading — орох босго (§5.5, §12.2)', () => {
  for (const id of CONDITIONS) {
    const def = indoorThresholds[id];
    const step = stepOf(def.metric);
    it(`${id}: анхааруулгаас доош → normal; орох дээр → warning; ноцтой орох дээр → critical`, () => {
      expect(sideLevel(classify(def.metric, round(better(def, def.warningEnter, step))), def)).toBe(
        'normal',
      );
      expect(sideLevel(classify(def.metric, def.warningEnter), def)).toBe('warning');
      expect(
        sideLevel(classify(def.metric, round(better(def, def.criticalEnter, step))), def),
      ).toBe('warning');
      expect(sideLevel(classify(def.metric, def.criticalEnter), def)).toBe('critical');
    });
  }
});

describe('classifyReading — hysteresis (§5.6-ийн 4–5)', () => {
  for (const id of CONDITIONS) {
    const def = indoorThresholds[id];
    const step = stepOf(def.metric);
    const warningPrev = classify(def.metric, def.warningEnter);
    const criticalPrev = classify(def.metric, def.criticalEnter);

    it(`${id}: warning нь гарах босгыг давах хүртэл хэвээр, давмагц normal`, () => {
      expect(sideLevel(classify(def.metric, def.warningExit, warningPrev), def)).toBe('warning');
      expect(
        sideLevel(
          classify(def.metric, round(better(def, def.warningExit, step)), warningPrev),
          def,
        ),
      ).toBe('normal');
    });

    it(`${id}: critical нь ноцтой гарах босгыг давах хүртэл хэвээр; дараа нь warning; хол сайжирвал шууд normal`, () => {
      expect(sideLevel(classify(def.metric, def.criticalExit, criticalPrev), def)).toBe('critical');
      expect(
        sideLevel(
          classify(def.metric, round(better(def, def.criticalExit, step)), criticalPrev),
          def,
        ),
      ).toBe('warning');
      expect(
        sideLevel(
          classify(def.metric, round(better(def, def.warningExit, step)), criticalPrev),
          def,
        ),
      ).toBe('normal');
    });

    it(`${id}: муудах нь өмнөх түвшнээс үл хамааран шууд`, () => {
      expect(sideLevel(classify(def.metric, def.criticalEnter, warningPrev), def)).toBe('critical');
    });
  }

  it('§5.6-ийн жишээ (CO₂, зориуд бэхэлсэн утга): өмнө critical, 1450 → critical; 1350 → warning', () => {
    const previous = classify('co2', 1600);
    expect(classify('co2', 1450, previous).status).toBe('critical');
    expect(classify('co2', 1350, previous).status).toBe('warning');
  });

  it('previous levels null (анх удаа) бол hysteresis normal-оос эхэлнэ: ноцтой гарах ба орох хооронд → warning', () => {
    const def = indoorThresholds.co2;
    const between = (def.criticalExit + def.criticalEnter) / 2;
    expect(classify('co2', between, null).status).toBe('warning');
    expect(classify('co2', between, classify('co2', def.criticalEnter)).status).toBe('critical');
  });

  it('offline/invalid-аас сэргэхэд (levels: null) hysteresis дахин normal-оос эхэлнэ (D49)', () => {
    const def = indoorThresholds.co2;
    const heldValue = (def.warningExit + def.warningEnter) / 2; // warning-ийг зөвхөн hysteresis барина
    const fromInvalid = classify('co2', heldValue, classify('co2', Number.NaN));
    const fromOffline = classify('co2', heldValue, classify('co2', 800, null, 'offline'));
    const fromWarning = classify('co2', heldValue, classify('co2', def.warningEnter));
    expect(fromInvalid.status).toBe('normal');
    expect(fromOffline.status).toBe('normal');
    expect(fromWarning.status).toBe('warning');
  });
});

describe('classifyReading — хоёр талт хэмжигдэхүүн (§5.6, D32)', () => {
  it('температур/чийгшил: тал бүр тусдаа; нэг талын өмнөх түвшин нөгөө талд нөлөөлөхгүй', () => {
    for (const metric of ['temperature', 'humidity'] as const) {
      const { high, low } = conditionsByMetric[metric];
      const highDef = indoorThresholds[high];
      const lowDef = indoorThresholds[low!];
      const highWarning = classify(metric, highDef.warningEnter);
      expect(highWarning.condition).toBe(high);

      const nowLow = classify(metric, lowDef.warningEnter, highWarning);
      expect(nowLow.levels).toEqual({ kind: 'two-sided', high: 'normal', low: 'warning' });
      expect(nowLow.condition).toBe(low);

      const backHigh = classify(metric, highDef.warningEnter, nowLow);
      expect(backHigh.levels).toEqual({ kind: 'two-sided', high: 'warning', low: 'normal' });
    }
  });

  it('бага температурын анхааруулга нь `temperature-low` — өндөр талын (R-THERMAL) нөхцөл биш', () => {
    const result = classify('temperature', indoorThresholds['temperature-low'].warningEnter);
    expect(result.condition).toBe('temperature-low');
    expect(result.levels?.high).toBe('normal');
  });

  it('нэг талт хэмжигдэхүүн one-sided levels-тэй', () => {
    for (const metric of ['co2', 'pm25', 'voc'] as const) {
      expect(classify(metric, metricSpecs[metric].validMin + 1).levels?.kind).toBe('one-sided');
    }
  });
});

describe('classifyReading — хуучирсан утга (D49)', () => {
  it('stale + previous → previous бүхэлдээ (status, levels, condition, explanation)', () => {
    const previous = classify('co2', 1200);
    const result = classifyReading('co2', 300, 'stale', previous, indoorThresholds);
    expect(result).toBe(previous);
    expect(result).toEqual(previous);
  });

  it('stale + өмнөх нь invalid байсан ч бүхэлд нь хадгална (previousLevels-ээр сэргээх боломжгүй байсан тохиолдол)', () => {
    const previous = classify('co2', Number.POSITIVE_INFINITY);
    expect(classifyReading('co2', 900, 'stale', previous, indoorThresholds)).toEqual(previous);
  });

  it('stale + previous === null → offline, levels/condition null', () => {
    const result = classifyReading('co2', 900, 'stale', null, indoorThresholds);
    expect(result).toEqual({
      status: 'offline',
      levels: null,
      condition: null,
      explanation: mn.classification.offline,
    });
  });
});

describe('classifyReading — холболтгүй ба буруу утга (§5.4, §5.6, FR-M5)', () => {
  it('offline холболт → offline, levels null; утга хэзээ ч 0 гэж үзэгдэхгүй', () => {
    for (const value of [800, 0, null]) {
      const result = classify('co2', value, classify('co2', 1600), 'offline');
      expect(result).toEqual({
        status: 'offline',
        levels: null,
        condition: null,
        explanation: mn.classification.offline,
      });
    }
  });

  it('NaN, ±Infinity, null (online) → invalid', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null]) {
      const result = classify('temperature', value);
      expect(result.status).toBe('invalid');
      expect(result.levels).toBeNull();
      expect(result.condition).toBeNull();
      expect(result.explanation).toBe(mn.classification.invalidNonNumeric);
    }
  });

  it('боломжит мужаас гадуур → invalid (CO₂ = 0 орно); мужийн хил дээр → зөв', () => {
    expect(classify('co2', 0).status).toBe('invalid');
    for (const metric of Object.keys(metricSpecs) as MetricType[]) {
      const { validMin, validMax } = metricSpecs[metric];
      const step = stepOf(metric);
      expect(classify(metric, round(validMin - step)).status).toBe('invalid');
      expect(classify(metric, round(validMax + step)).status).toBe('invalid');
      expect(classify(metric, validMin).status).not.toBe('invalid');
      expect(classify(metric, validMax).status).not.toBe('invalid');
    }
  });

  it('гадна мэдрэгч (thresholds = null): зөвхөн зөв эсэх — normal/invalid/offline, levels null', () => {
    expect(classifyReading('pm25', 55, 'online', null, null)).toEqual({
      status: 'normal',
      levels: null,
      condition: null,
      explanation: null,
    });
    expect(classifyReading('pm25', -1, 'online', null, null).status).toBe('invalid');
    expect(classifyReading('pm25', 55, 'offline', null, null).status).toBe('offline');
  });
});

describe('classifyReading — тайлбар (§5.6-ийн 7, D44)', () => {
  const fmt = (n: number, decimals: number) =>
    new Intl.NumberFormat('mn-MN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(n);

  it('утга ба давсан босгыг агуулна (Intl mn-MN формат)', () => {
    expect(classify('co2', 1240).explanation).toBe(
      `CO₂ ${fmt(1240, 0)} ppm байна. Анхааруулах босго (${fmt(indoorThresholds.co2.warningEnter, 0)} ppm)-оос өндөр.`,
    );
  });

  it('температур 1 аравтын оронтой; бага тал «доод … бага»', () => {
    const def = indoorThresholds['temperature-low'];
    const explanation = classify('temperature', def.warningEnter).explanation!;
    expect(explanation).toContain(`${fmt(def.warningEnter, 1)} °C`);
    expect(explanation).toContain('доод');
    expect(explanation).toContain('бага');
  });

  it('hysteresis-ээр барьж буй үед гарах босгыг нэрлэнэ', () => {
    const def = indoorThresholds.co2;
    const held = classify('co2', def.warningExit, classify('co2', def.warningEnter));
    expect(held.status).toBe('warning');
    expect(held.explanation).toContain(fmt(def.warningExit, 0));
  });

  it('normal үед тайлбар null', () => {
    expect(classify('co2', 650).explanation).toBeNull();
  });
});
