import { describe, expect, it } from 'vitest';

import { outdoorAirThresholds, timingThresholds } from '@/domain/config/thresholds';
import type { ThresholdLevel } from '@/domain/types';

import {
  debounceLevel,
  evaluateStageZero,
  nextFreeCooling,
  nextOutdoorAirRestricted,
  nextPmDilutionAllowed,
  type RuleDebounceState,
} from './controlState';

const N = timingThresholds.ruleDebounceSteps;
const T = outdoorAirThresholds;

function run(levels: ThresholdLevel[]) {
  let counter = { confirmed: 'normal' as ThresholdLevel, warningSteps: 0, criticalSteps: 0 };
  return levels.map((level) => {
    counter = debounceLevel(counter, level);
    return counter.confirmed;
  });
}

describe('дүрмийн debounce (§6.6)', () => {
  it(`өсөлт ${N} алхмын дараа баталгаажна; warning → critical ч мөн ${N} алхам`, () => {
    expect(run(['warning', 'warning', 'warning'])).toEqual(['normal', 'normal', 'warning']);
    expect(run(['warning', 'warning', 'warning', 'critical', 'critical', 'critical'])).toEqual([
      'normal',
      'normal',
      'warning',
      'warning',
      'warning',
      'critical',
    ]);
  });

  it('бууралт тэр даруй', () => {
    expect(run(['critical', 'critical', 'critical', 'warning', 'normal'])).toEqual([
      'normal',
      'normal',
      'critical',
      'warning',
      'normal',
    ]);
  });

  it('тасалдсан өсөлт тоолуурыг дахин эхлүүлнэ', () => {
    expect(run(['warning', 'warning', 'normal', 'warning', 'warning'])).toEqual([
      'normal',
      'normal',
      'normal',
      'normal',
      'normal',
    ]);
  });
});

describe('гадна агаарын hysteresis (§6.3, §6.5)', () => {
  it('C-OUTDOOR-AIR: ≥ 35 хязгаарлана, < 25 зөвшөөрнө, хооронд ба өгөгдөлгүй үед өмнөх', () => {
    expect(nextOutdoorAirRestricted(false, T.outdoorPm25RestrictEnter)).toBe(true);
    expect(nextOutdoorAirRestricted(true, 30)).toBe(true);
    expect(nextOutdoorAirRestricted(false, 30)).toBe(false);
    expect(nextOutdoorAirRestricted(true, T.outdoorPm25RestrictExit - 0.1)).toBe(false);
    expect(nextOutdoorAirRestricted(true, null)).toBe(true);
    expect(nextOutdoorAirRestricted(false, null)).toBe(false);
  });

  it('pmDilutionAllowed 10/12 µg/m³ hysteresis — олон мөчлөгт хэлбэлзэхгүй', () => {
    let allowed = true;
    const changes: boolean[] = [];
    for (let i = 0; i < 40; i += 1) {
      const value = 10.5 + Math.sin(i) * 1.2; // 9.3…11.7 — гарах босго 12-т хүрэхгүй
      const next = nextPmDilutionAllowed(allowed, value);
      if (next !== allowed) changes.push(next);
      allowed = next;
    }
    expect(changes.length).toBeLessThanOrEqual(1);
    expect(nextPmDilutionAllowed(true, null)).toBe(false);
    expect(nextPmDilutionAllowed(true, T.outdoorPm25DilutionExit)).toBe(false);
    expect(nextPmDilutionAllowed(false, T.outdoorPm25DilutionEnter - 0.1)).toBe(true);
  });

  it('үнэгүй хөргөлт: ≥ 2 °C сэрүүн бол эхэлж, < 1 °C болоход дуусна; 1–2 °C-д төлөвөө хадгална', () => {
    expect(nextFreeCooling(false, 24, 26, false)).toBe(true);
    expect(nextFreeCooling(true, 24.5, 26, false)).toBe(true); // зөрүү 1.5
    expect(nextFreeCooling(false, 24.5, 26, false)).toBe(false);
    expect(nextFreeCooling(true, 25.5, 26, false)).toBe(false); // зөрүү 0.5
    expect(nextFreeCooling(true, 20, 26, true)).toBe(false); // хязгаарласан
    expect(nextFreeCooling(true, null, 26, false)).toBe(false); // гадна өгөгдөлгүй
  });

  it('гадна/дотоод зөрүүг 0.5–2.5 °C-д хэлбэлзүүлэхэд үнэгүй хөргөлт хэлбэлзэхгүй', () => {
    let active = false;
    let toggles = 0;
    for (let i = 0; i < 60; i += 1) {
      const delta = 1.5 + Math.sin(i * 0.7) * 1.0; // 0.5…2.5
      const next = nextFreeCooling(active, 26 - delta, 26, false);
      if (next !== active) toggles += 1;
      active = next;
    }
    // Утга 2-оос дээш, 1-ээс доош гарахад л солигдоно — нэг мөчлөгт дээд тал нь 2 удаа
    expect(toggles).toBeLessThanOrEqual((60 / 9) * 2 + 2);
    expect(toggles).toBeGreaterThan(0);
  });
});

describe('0-р үе шат: нөөц горим (§6.6 co2-missing)', () => {
  const co2 = {
    max: 700,
    min: 690,
    validCount: 2,
    levels: { kind: 'one-sided' as const, high: 'normal' as const },
  };
  const outdoor = { temperature: 18, humidity: 55, pm25: 8, co2: 420 };
  const previous = { outdoorAirRestricted: false, pmDilutionAllowed: true, freeCoolingFloors: [] };

  it(`CO₂ ${N} алхам алга бол идэвхжиж, буцаж ирмэгц тэр даруй цуцлагдана`, () => {
    let debounce: RuleDebounceState = {};
    const fallback: boolean[] = [];
    const steps: (typeof co2 | undefined)[] = [undefined, undefined, undefined, undefined, co2];
    for (const value of steps) {
      const result = evaluateStageZero({
        floorIds: ['F04'],
        aggregates: { F04: value === undefined ? {} : { co2: value } },
        outdoor,
        previous,
        debounce,
      });
      debounce = result.debounce;
      fallback.push(result.fallbackFloors.includes('F04'));
    }
    expect(fallback).toEqual([false, false, true, true, false]);
  });
});
