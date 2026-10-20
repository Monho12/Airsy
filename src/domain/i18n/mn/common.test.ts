import { describe, expect, it } from 'vitest';

import { mn } from './index';

describe('mn.common', () => {
  it('СИМУЛЯЦИ тэмдэг ба апп-ын нэрийг агуулна', () => {
    expect(mn.common.appName).toBe('AERIS');
    expect(mn.common.simulationBadge).toBe('СИМУЛЯЦИ');
  });

  it('бүс бүрийн гарчиг хоосон биш Монгол бичвэр', () => {
    for (const label of Object.values(mn.common.regions)) {
      expect(label).toMatch(/[А-Яа-яӨөҮүЁё]/);
    }
  });

  it('Монгол кириллийн Ө ба Ү үсэг бичвэрт бодитоор ашиглагдана (фонтын subset шалгалтад, D43)', () => {
    const allText = Object.values(mn.common.regions).join(' ');
    expect(allText).toMatch(/[Өө]/);
    expect(allText).toMatch(/[Үү]/);
  });
});

// Domain тест `node` орчинд, UI setup-гүй ажиллах ёстой (D41). Тохиргоо алдагдвал энд мэдэгдэнэ.
describe('domain тестийн орчин', () => {
  it('DOM-ын глобал байхгүй', () => {
    expect(typeof globalThis.window).toBe('undefined');
    expect(typeof globalThis.document).toBe('undefined');
  });

  it('UI setup (jest-dom) ачаалагдаагүй', () => {
    expect('toBeInTheDocument' in expect(null)).toBe(false);
  });
});
