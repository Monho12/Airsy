import { describe, expect, it } from 'vitest';

import type { HealthStatus } from '@/domain/types';

import { STATUS_PRIORITY, summarizeHealth, worstLevel, worstStatus } from './status';

describe('төлөвийн эрэмбэ (D51)', () => {
  it('critical > warning > offline > invalid > normal', () => {
    expect(STATUS_PRIORITY).toEqual(['critical', 'warning', 'offline', 'invalid', 'normal']);
  });

  it('хос бүрт эрэмбээр өндөр нь ялна (дарааллаас үл хамааран)', () => {
    STATUS_PRIORITY.forEach((stronger, i) => {
      STATUS_PRIORITY.slice(i).forEach((weaker) => {
        expect(worstStatus([stronger, weaker])).toBe(stronger);
        expect(worstStatus([weaker, stronger])).toBe(stronger);
      });
    });
  });

  it.each<[HealthStatus[], HealthStatus]>([
    [['critical', 'offline'], 'critical'],
    [['offline', 'invalid'], 'offline'],
    [['invalid', 'normal'], 'invalid'],
    [['warning', 'offline', 'invalid'], 'warning'],
    [['normal', 'invalid', 'normal', 'offline'], 'offline'],
  ])('давхцсан тохиолдол %j → %s', (statuses, expected) => {
    expect(worstStatus(statuses)).toBe(expected);
  });

  it('хоосон бол normal', () => {
    expect(worstStatus([])).toBe('normal');
  });
});

describe('summarizeHealth (§5.6 — өгөгдлийн асуудлыг тусад нь)', () => {
  it('холболтгүй мэдрэгч жинхэнэ анхааруулгыг далдлахгүй', () => {
    expect(summarizeHealth(['offline', 'warning', 'normal'])).toEqual({
      worst: 'warning',
      worstValid: 'warning',
      hasDataIssue: true,
    });
  });

  it('зөвхөн өгөгдлийн асуудал байвал worstValid null', () => {
    expect(summarizeHealth(['offline', 'invalid'])).toEqual({
      worst: 'offline',
      worstValid: null,
      hasDataIssue: true,
    });
  });

  it('бүгд хэвийн', () => {
    expect(summarizeHealth(['normal', 'normal'])).toEqual({
      worst: 'normal',
      worstValid: 'normal',
      hasDataIssue: false,
    });
  });
});

describe('worstLevel', () => {
  it('нэг ба хоёр талт', () => {
    expect(worstLevel({ kind: 'one-sided', high: 'warning' })).toBe('warning');
    expect(worstLevel({ kind: 'two-sided', high: 'normal', low: 'critical' })).toBe('critical');
    expect(worstLevel({ kind: 'two-sided', high: 'warning', low: 'normal' })).toBe('warning');
  });
});
