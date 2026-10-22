// Мэдрэгчийн шошгыг canvas дотор багтаах байрлал (CLAUDE.md §8.6). R3F-ийн canvas `overflow: hidden` тул шошго
// хүрээнээс гарвал таслагдана — агуулгыг (5 утга, §5.3) хасахгүйгээр байрлалыг нь л тохируулна. Цэвэр функц.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Зангилаа ба шошгын хоорондох зай, px (сонголтын цагирагийг халхлахгүй) */
export const LABEL_GAP_PX = 18;
/** Canvas-ийн ирмэгээс үлдээх зай, px */
export const LABEL_MARGIN_PX = 8;

export type LabelSide = 'left' | 'right' | 'above' | 'below';

export interface LabelPlacement {
  /** Шошгын зүүн дээд булан, canvas-ийн px */
  x: number;
  y: number;
  side: LabelSide;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Дараалал: зангилааны хажууд, canvas-ийн ойрын ирмэг тийш (барилгын төвөөс холдуулж) → эсрэг хажуу → дээр →
 * доор. Хажуу байрлалд босоо чиглэлд зангилаатай голлуулж, canvas дотор шахна. Аль нь ч бүрэн багтахгүй бол
 * зай ихтэй дээр/доор талд тавьж ирмэгт шахна. Зангилаа өөрөө canvas-аас гадна бол шахахгүй — шошго
 * зангилаатай хамт гарна (харагдахгүй цэгийг ирмэг дээр заасан мэт харагдуулахгүй).
 */
export function placeLabel(anchor: Point, label: Size, viewport: Size): LabelPlacement {
  const centeredX = anchor.x - label.width / 2;
  const aboveY = anchor.y - LABEL_GAP_PX - label.height;

  const anchorVisible =
    anchor.x >= 0 && anchor.x <= viewport.width && anchor.y >= 0 && anchor.y <= viewport.height;
  if (!anchorVisible) return { x: centeredX, y: aboveY, side: 'above' };

  const minX = LABEL_MARGIN_PX;
  const minY = LABEL_MARGIN_PX;
  const maxX = viewport.width - label.width - LABEL_MARGIN_PX;
  const maxY = viewport.height - label.height - LABEL_MARGIN_PX;
  const fitsHeight = maxY >= minY;
  const fitsWidth = maxX >= minX;

  const sideY = clamp(anchor.y - label.height / 2, minY, maxY);
  const leftX = anchor.x - LABEL_GAP_PX - label.width;
  const rightX = anchor.x + LABEL_GAP_PX;
  const belowY = anchor.y + LABEL_GAP_PX;
  const columnX = clamp(centeredX, minX, maxX);

  const option = (x: number, y: number, side: LabelSide, fits: boolean) => ({
    placement: { x, y, side },
    fits,
  });
  const left = option(leftX, sideY, 'left', fitsHeight && leftX >= minX);
  const right = option(rightX, sideY, 'right', fitsHeight && rightX <= maxX);
  const above = option(columnX, aboveY, 'above', fitsWidth && aboveY >= minY);
  const below = option(columnX, belowY, 'below', fitsWidth && belowY <= maxY);

  const nearestEdgeIsLeft = anchor.x <= viewport.width / 2;
  const candidates = nearestEdgeIsLeft ? [left, right, above, below] : [right, left, above, below];
  const fitting = candidates.find((candidate) => candidate.fits);
  if (fitting !== undefined) return fitting.placement;

  // Аль ч байрлалд бүрэн багтахгүй (canvas шошгоноос жижиг) — зай ихтэй тал, ирмэгт шахна
  const side = anchor.y > viewport.height / 2 ? 'above' : 'below';
  return { x: columnX, y: clamp(side === 'above' ? aboveY : belowY, minY, maxY), side };
}
