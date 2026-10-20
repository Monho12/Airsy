import { describe, expect, it } from 'vitest';

import { controlConfig, damperOutdoorFraction, fanAirflow, fanLevelOrder } from './control';
import { simulationConfig } from './simulation';
import {
  conditionsByMetric,
  indoorThresholds,
  outdoorAirThresholds,
  timingThresholds,
} from './thresholds';

describe('thresholds.ts (§5.5)', () => {
  it('тал бүрт hysteresis-ийн зурвас зөв чиглэлтэй: гарах нь орохоос «сайн» талд, ноцтой нь анхааруулгаас муу', () => {
    for (const def of Object.values(indoorThresholds)) {
      const sign = def.side === 'high' ? 1 : -1;
      expect(sign * (def.warningEnter - def.warningExit)).toBeGreaterThan(0);
      expect(sign * (def.criticalEnter - def.criticalExit)).toBeGreaterThan(0);
      expect(sign * (def.criticalEnter - def.warningEnter)).toBeGreaterThan(0);
    }
  });

  it('нөхцөл бүр conditionsByMetric-д бүртгэлтэй бөгөөд хэмжигдэхүүнтэйгээ таарна', () => {
    for (const [id, def] of Object.entries(indoorThresholds)) {
      const sides = conditionsByMetric[def.metric];
      expect(def.side === 'high' ? sides.high : sides.low).toBe(id);
    }
  });

  it('гадна агаар ба хугацааны босго (§5.5, зориуд бэхэлсэн)', () => {
    expect(outdoorAirThresholds).toEqual({
      outdoorPm25RestrictEnter: 35,
      outdoorPm25RestrictExit: 25,
      outdoorPm25DilutionEnter: 10,
      outdoorPm25DilutionExit: 12,
      freeCoolingMinDelta: 2.0,
      freeCoolingExitDelta: 1.0,
      outdoorCo2Ppm: 420,
    });
    expect(timingThresholds).toEqual({
      sensorStaleAfterMs: 10_000,
      sensorOfflineAfterMs: 20_000,
      ruleDebounceSteps: 3,
      alertDebounceSteps: 3,
    });
  });
});

describe('control.ts (§5.7, §6.6, §6.7)', () => {
  it('түвшин → коэффициент нь дарааллаар өсөх', () => {
    const flows = fanLevelOrder.map((level) => fanAirflow[level]);
    expect(flows).toEqual([0, 0.25, 0.5, 0.8, 1.0]);
    expect(damperOutdoorFraction).toEqual({ CLOSED: 0, MINIMUM: 0.2, PARTIAL: 0.5, OPEN: 1 });
    expect(controlConfig).toEqual({ minStateHoldMs: 30_000, manualOverrideTimeoutMs: 600_000 });
  });
});

describe('simulation.ts (D45)', () => {
  it('эхлэх цаг 2026-10-19T01:00:00Z = Улаанбаатарын 09:00:00, Даваа', () => {
    expect(simulationConfig.startTime).toBe(Date.parse('2026-10-19T01:00:00Z'));
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ulaanbaatar',
      hourCycle: 'h23',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(simulationConfig.startTime));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    expect([part('weekday'), part('hour'), part('minute'), part('second')]).toEqual([
      'Monday',
      '09',
      '00',
      '00',
    ]);
  });
});
