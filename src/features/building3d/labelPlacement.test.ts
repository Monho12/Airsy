// Шошгыг canvas дотор багтаах (§8.6). Шошгын агуулга (5 утга) хасагдахгүй — зөвхөн байрлал.
// Тест нь тодорхой пикселийн таамаг биш, шинж чанарыг шалгана: багтах, зангилааг халхлахгүй, дараалал.
import { describe, expect, it } from 'vitest';

import {
  LABEL_GAP_PX,
  LABEL_MARGIN_PX,
  placeLabel,
  type LabelPlacement,
  type Point,
  type Size,
} from './labelPlacement';

const viewport: Size = { width: 960, height: 505 };
const label: Size = { width: 260, height: 200 };

/** Шошго бүхэлдээ canvas дотор (ирмэгийн зайтай) эсэх */
const inside = (p: LabelPlacement, size = label, vp = viewport) =>
  p.x >= LABEL_MARGIN_PX &&
  p.y >= LABEL_MARGIN_PX &&
  p.x + size.width <= vp.width - LABEL_MARGIN_PX &&
  p.y + size.height <= vp.height - LABEL_MARGIN_PX;

/** Зангилааны цэг шошгын тэгш өнцөгт дотор байгаа эсэх (байвал шошго зангилааг халхална) */
const coversAnchor = (p: LabelPlacement, anchor: Point, size = label) =>
  anchor.x >= p.x &&
  anchor.x <= p.x + size.width &&
  anchor.y >= p.y &&
  anchor.y <= p.y + size.height;

describe('placeLabel — хажуу байрлал давуу', () => {
  it('зангилаа зүүн хагаст → зүүн талд (ойрын ирмэг тийш), босоо чиглэлд голлуулсан', () => {
    const anchor = { x: 400, y: 250 };
    const p = placeLabel(anchor, label, viewport);
    expect(p.side).toBe('left');
    expect(p.x + label.width).toBe(anchor.x - LABEL_GAP_PX);
    expect(p.y + label.height / 2).toBe(anchor.y);
    expect(inside(p)).toBe(true);
  });

  it('зангилаа баруун хагаст → баруун талд', () => {
    const anchor = { x: 600, y: 250 };
    const p = placeLabel(anchor, label, viewport);
    expect(p.side).toBe('right');
    expect(p.x).toBe(anchor.x + LABEL_GAP_PX);
    expect(inside(p)).toBe(true);
  });

  it('ойрын ирмэг тийш зай хүрэлцэхгүй → эсрэг хажуу', () => {
    expect(placeLabel({ x: 120, y: 250 }, label, viewport).side).toBe('right');
    expect(placeLabel({ x: 840, y: 250 }, label, viewport).side).toBe('left');
  });

  it('хажуугийн байрлалд дээд/доод ирмэгт ойр зангилаа → босоо чиглэлд шахаж багтаана', () => {
    for (const y of [5, 500]) expect(inside(placeLabel({ x: 400, y }, label, viewport))).toBe(true);
  });
});

describe('placeLabel — хажуу багтахгүй үеийн нөөц', () => {
  // Нарийн canvas: аль ч хажуу талд 260 px шошго багтахгүй
  const narrow: Size = { width: 400, height: 505 };

  it('хажуу талд зай хүрэхгүй → дээр', () => {
    const p = placeLabel({ x: 200, y: 400 }, label, narrow);
    expect(p.side).toBe('above');
    expect(p.y + label.height).toBe(400 - LABEL_GAP_PX);
    expect(inside(p, label, narrow)).toBe(true);
  });

  it('дээр ч зай хүрэхгүй → доор', () => {
    const p = placeLabel({ x: 200, y: 60 }, label, narrow);
    expect(p.side).toBe('below');
    expect(p.y).toBe(60 + LABEL_GAP_PX);
    expect(inside(p, label, narrow)).toBe(true);
  });

  it('аль ч байрлалд бүрэн багтахгүй (canvas шошгоноос жижиг) → зай ихтэй тал, ирмэгт шахна', () => {
    const tiny: Size = { width: 400, height: 220 };
    const p = placeLabel({ x: 200, y: 180 }, label, tiny);
    expect(p.side).toBe('above');
    expect(p.y).toBe(LABEL_MARGIN_PX);
    expect(p.x).toBeGreaterThanOrEqual(LABEL_MARGIN_PX);
  });
});

describe('placeLabel — хил ба тусгай тохиолдол', () => {
  it('зангилаа canvas-аас гадна → шахахгүй (өмнөх зан төлөв: голлуулж дээр)', () => {
    const anchor = { x: -100, y: 300 };
    expect(placeLabel(anchor, label, viewport)).toEqual({
      x: anchor.x - label.width / 2,
      y: anchor.y - LABEL_GAP_PX - label.height,
      side: 'above',
    });
  });

  it('хэмжээ хараахан мэдэгдээгүй (0 × 0) → canvas дотор, зангилаанаас зайтай', () => {
    const p = placeLabel({ x: 300, y: 300 }, { width: 0, height: 0 }, viewport);
    expect(p.side).toBe('left');
    expect(p.x).toBe(300 - LABEL_GAP_PX);
  });

  it.each([
    [480, 250],
    [400, 60],
    [20, 30],
    [940, 490],
    [480, 500],
    [10, 250],
    [950, 250],
  ])(
    'canvas доторх дурын зангилаа (%i, %i) → шошго бүхэлдээ багтаж, зангилааг халхлахгүй',
    (x, y) => {
      const anchor = { x, y };
      const p = placeLabel(anchor, label, viewport);
      expect(inside(p)).toBe(true);
      expect(coversAnchor(p, anchor)).toBe(false);
    },
  );
});
