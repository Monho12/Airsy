// CLAUDE.md §8.3-ын «Шалгасан контрастын матриц»-ыг tokens.css-ийн бодит утгаас тооцоолж шалгана.
// Хослол бүр (1) баримтад бичсэн харьцаатай таарна, (2) хэрэглээнийхээ босгыг хангана
// (бичвэр ≥ 4.5:1, утга илэрхийлэх UI элемент ≥ 3:1). ✗ гэж тэмдэглэсэн хослол босгод хүрэхгүй хэвээр байх ёстой.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const tokensCss = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

type Rgb = readonly [number, number, number];

const TEXT = 4.5;
const UI = 3;

/** tokens.css-ээс `--name: #rrggbb` ба accent-subtle-ийн rgba утгыг уншина. */
function readTokens(css: string): Map<string, Rgb> {
  const tokens = new Map<string, Rgb>();
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*#([0-9a-f]{6})\s*;/gi)) {
    const hex = match[2]!;
    tokens.set(
      match[1]!,
      [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb,
    );
  }
  return tokens;
}

function readAccentSubtleAlpha(css: string): number {
  const match = /--color-accent-subtle:\s*rgba\(\s*34,\s*211,\s*238,\s*([0-9.]+)\s*\)/.exec(css);
  if (!match) throw new Error('--color-accent-subtle нь accent-ийн rgba байх ёстой');
  return Number(match[1]);
}

/** WCAG 2.x-ийн харьцангуй гэрэлтэлт (relative luminance) */
function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Хагас тунгалаг өнгийг гадаргуу дээр холино (alpha compositing). Браузер үр дүнг 8-бит сувгаар зурдаг тул
 * суваг бүрийг бүхэл тоо руу дугуйлна — §8.3-ын матрицыг Phase 0-д яг ингэж тооцоолсон.
 */
function blend(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return top.map((value, i) =>
    Math.round(value * alpha + bottom[i]! * (1 - alpha)),
  ) as unknown as Rgb;
}

const tokens = readTokens(tokensCss);
const alpha = readAccentSubtleAlpha(tokensCss);

function color(name: string): Rgb {
  const value = tokens.get(`color-${name}`);
  if (!value) throw new Error(`tokens.css-д --color-${name} алга`);
  return value;
}

const backgrounds: Record<string, () => Rgb> = {
  bg: () => color('bg'),
  'surface-1': () => color('surface-1'),
  'surface-2': () => color('surface-2'),
  'surface-3': () => color('surface-3'),
  'accent-subtle@s1': () => blend(color('accent'), color('surface-1'), alpha),
  'accent-subtle@s2': () => blend(color('accent'), color('surface-2'), alpha),
};
const columns = Object.keys(backgrounds);

/** §8.3-ын матриц: тоо = баримтын харьцаа; null = «—» (тооцоогүй, хэрэглэхгүй); { forbidden } = ✗. */
type Cell = number | null | { forbidden: number };
const matrix: { fg: string; min: number; cells: Cell[] }[] = [
  { fg: 'text-primary', min: TEXT, cells: [17.41, 16.29, 14.98, 13.38, 12.89, 11.69] },
  { fg: 'text-secondary', min: TEXT, cells: [8.77, 8.2, 7.55, 6.74, 6.49, 5.89] },
  { fg: 'text-muted', min: TEXT, cells: [6.19, 5.79, 5.33, 4.76, 4.58, { forbidden: 4.16 }] },
  { fg: 'accent', min: TEXT, cells: [10.61, 9.93, 9.14, 8.16, 7.86, 7.13] },
  { fg: 'status-normal', min: TEXT, cells: [9.98, 9.34, 8.59, 7.67, null, null] },
  { fg: 'status-warning', min: TEXT, cells: [11.49, 10.75, 9.89, 8.83, 8.51, 7.72] },
  { fg: 'status-critical', min: TEXT, cells: [6.93, 6.49, 5.97, 5.33, 5.14, 4.66] },
  { fg: 'status-offline', min: UI, cells: [4.89, 4.58, 4.21, 3.76, 3.62, 3.29] },
  { fg: 'focus-ring', min: UI, cells: [13.23, 12.38, 11.39, 10.17, null, null] },
  { fg: 'accent-strong', min: UI, cells: [13.23, 12.38, 11.39, 10.17, null, null] },
  { fg: 'status-critical-fill', min: UI, cells: [5.1, 4.77, 4.39, 3.92, null, null] },
  { fg: 'emergency', min: UI, cells: [3.97, 3.72, 3.42, 3.05, null, null] },
];

/** Дүүргэлт дээрх бичвэр (§8.3 матрицын доорх мөр). */
const onFill: { fg: string; bg: string; expected: Cell }[] = [
  { fg: 'on-fill', bg: 'status-warning', expected: 11.49 },
  { fg: 'on-fill', bg: 'accent', expected: 10.61 },
  { fg: 'on-fill', bg: 'status-normal', expected: 9.98 },
  { fg: 'on-fill', bg: 'status-critical', expected: 6.93 },
  { fg: 'on-fill', bg: 'status-critical-fill', expected: 5.1 },
  { fg: 'on-fill', bg: 'status-offline', expected: 4.89 },
  { fg: 'on-emergency', bg: 'emergency', expected: 4.83 },
  { fg: 'white', bg: 'status-critical-fill', expected: { forbidden: 3.76 } },
  // §8.3-ын токены хүснэгт: яаралтай мөрөн дээр text-primary ба text-secondary хэрэглэхгүй
  { fg: 'text-primary', bg: 'emergency', expected: { forbidden: 4.38 } },
  { fg: 'text-secondary', bg: 'emergency', expected: { forbidden: 2.21 } },
];

const WHITE: Rgb = [255, 255, 255];
/** Баримт 2 оронтой тоогоор (дугуйлж) бичигдсэн тул тооцоолсон утга баримтын утгаас ±0.005 дотор байх ёстой. */
const TOLERANCE = 0.0051;

describe('§8.3 контрастын матриц', () => {
  for (const row of matrix) {
    row.cells.forEach((cell, index) => {
      const column = columns[index]!;
      if (cell === null) return;
      const documented = typeof cell === 'number' ? cell : cell.forbidden;
      it(`${row.fg} / ${column}: ${typeof cell === 'number' ? documented : `✗ ${documented}`}`, () => {
        const ratio = contrast(color(row.fg), backgrounds[column]!());
        expect(Math.abs(ratio - documented)).toBeLessThan(TOLERANCE);
        if (typeof cell === 'number') expect(ratio).toBeGreaterThanOrEqual(row.min);
        else expect(ratio).toBeLessThan(row.min);
      });
    });
  }
});

describe('§8.3 дүүргэлт дээрх бичвэр', () => {
  for (const pair of onFill) {
    const documented =
      typeof pair.expected === 'number'
        ? pair.expected
        : (pair.expected as { forbidden: number }).forbidden;
    it(`${pair.fg} / ${pair.bg}: ${documented}`, () => {
      const fg = pair.fg === 'white' ? WHITE : color(pair.fg);
      const ratio = contrast(fg, color(pair.bg));
      expect(Math.abs(ratio - documented)).toBeLessThan(TOLERANCE);
      if (typeof pair.expected === 'number') expect(ratio).toBeGreaterThanOrEqual(TEXT);
      else expect(ratio).toBeLessThan(TEXT);
    });
  }
});

describe('§8.3 зөвхөн чимэглэлийн хүрээ', () => {
  it('border ба border-strong нь 3:1-д хүрэхгүй (утга илэрхийлэхэд хэрэглэхгүй)', () => {
    for (const name of ['border', 'border-strong']) {
      for (const column of ['bg', 'surface-1', 'surface-2', 'surface-3']) {
        expect(contrast(color(name), backgrounds[column]!())).toBeLessThan(UI);
      }
    }
  });
});
