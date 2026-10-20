import { describe, expect, it } from 'vitest';

import { simulationConfig } from '@/domain/config/simulation';

import {
  DISPLAY_TIME_ZONE,
  floorLabelMn,
  formatMetricValueMn,
  formatNumberMn,
  formatTimeMn,
  mn,
} from './index';

describe('format.ts — тоо (D44)', () => {
  it("`Intl.NumberFormat('mn-MN')`-тэй яг ижил, нарийвчлалтай", () => {
    const expected = (n: number, d: number) =>
      new Intl.NumberFormat('mn-MN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(
        n,
      );
    expect(formatNumberMn(1240, 0)).toBe(expected(1240, 0));
    expect(formatNumberMn(23.14, 1)).toBe(expected(23.14, 1));
    expect(formatNumberMn(26, 1)).toBe(expected(26, 1)); // «26.0» — тогтмол 1 аравт
  });

  it('нэгж: °C ба ppm зайтай, % наалттай, VOC индекс нэгжгүй', () => {
    expect(formatMetricValueMn(22.5, '°C', 1)).toBe(`${formatNumberMn(22.5, 1)} °C`);
    expect(formatMetricValueMn(650, 'ppm', 0)).toBe(`${formatNumberMn(650, 0)} ppm`);
    expect(formatMetricValueMn(45, '%RH', 0)).toBe(`${formatNumberMn(45, 0)}%`);
    expect(formatMetricValueMn(100, 'index', 0)).toBe(formatNumberMn(100, 0));
  });
});

describe('format.ts — хугацаа (D45)', () => {
  it('тогтмол Asia/Ulaanbaatar, 24 цаг: startTime → 09:00:00, +10 мин → 09:10:00', () => {
    expect(DISPLAY_TIME_ZONE).toBe('Asia/Ulaanbaatar');
    const parts = (t: number) => formatTimeMn(t).match(/\d+/g);
    expect(parts(simulationConfig.startTime)).toEqual(['09', '00', '00']);
    expect(parts(simulationConfig.startTime + 10 * 60_000)).toEqual(['09', '10', '00']);
    // 13:00 UB нь 24 цагийн хэлбэрээр (AM/PM биш)
    expect(parts(Date.parse('2026-10-19T05:00:00Z'))).toEqual(['13', '00', '00']);
  });

  it('давхрын шошго «7-р давхар»', () => {
    expect(floorLabelMn(7)).toBe('7-р давхар');
  });
});

describe('i18n бүрэн байдал (§8.9 — enum түүхий хэлбэрээр харагдахгүй)', () => {
  const cyrillic = /[А-Яа-яӨөҮүЁё]/;

  it('үйл явдлын 28 төрөл, дохионы 6 төрөл бүгд Монгол шошготой', () => {
    expect(Object.keys(mn.events.type)).toHaveLength(28);
    expect(Object.keys(mn.alerts.type)).toHaveLength(6);
    for (const label of [
      ...Object.values(mn.events.type),
      ...Object.values(mn.alerts.type),
      ...Object.values(mn.alerts.severity),
      ...Object.values(mn.devices.kind),
      ...Object.values(mn.devices.fanLevel),
      ...Object.values(mn.devices.damperPosition),
      ...Object.values(mn.control.mode),
      ...Object.values(mn.metrics.label),
    ]) {
      expect(label.trim()).not.toBe('');
      expect(label).toMatch(cyrillic);
    }
  });

  it('§8.9-ийн нэр томьёотой таарна', () => {
    expect(mn.devices.fanLevel.BOOST).toBe('Хамгийн их');
    expect(mn.devices.damperPosition.MINIMUM).toBe('Бага зэрэг');
    expect(mn.devices.deviceName('supply_fan', 'F07')).toBe('Агаар оруулах сэнс F07');
    expect(mn.metrics.label.voc).toBe('VOC индекс (симуляци)');
    expect(mn.alerts.thresholdTitle(mn.metrics.shortLabel.co2, 'high', floorLabelMn(2))).toBe(
      'CO₂ өндөр — 2-р давхар',
    );
  });
});
