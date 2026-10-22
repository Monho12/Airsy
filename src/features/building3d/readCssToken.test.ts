import { afterEach, describe, expect, it } from 'vitest';

import { readCssToken } from './readCssToken';

afterEach(() => {
  document.documentElement.style.removeProperty('--color-test-token');
});

describe('readCssToken (§8.3, D57)', () => {
  it('CSS хувьсагчийн утгыг тайрч буцаана', () => {
    document.documentElement.style.setProperty('--color-test-token', ' #0D0F13 ');
    expect(readCssToken('--color-test-token')).toBe('#0D0F13');
  });

  it('токен байхгүй бол алдаа шиднэ (дуугүй өнгө зурахгүй)', () => {
    expect(() => readCssToken('--color-test-token')).toThrow('--color-test-token');
  });
});
