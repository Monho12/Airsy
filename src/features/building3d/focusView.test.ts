import { describe, expect, it } from 'vitest';

import { buildingConfig } from '@/domain/config/building';

import { selectedCeilingY, splitShaftBoxes } from './focusView';
import { createBuildingLayout } from './layout';

const layout = createBuildingLayout(buildingConfig);
const floorHeight = buildingConfig.building.floorHeight;
const shafts = [layout.core, ...layout.evacuationStairs];

describe('сонгосон давхрын тааз (D88)', () => {
  it('сонголтгүй эсвэл тохиргоонд алга бол null', () => {
    expect(selectedCeilingY(layout, null)).toBeNull();
    expect(selectedCeilingY(layout, 'F99')).toBeNull();
  });

  it('дээрх давхрын шалны өндөр', () => {
    expect(selectedCeilingY(layout, 'F01')).toBeCloseTo(floorHeight);
    expect(selectedCeilingY(layout, 'F07')).toBeCloseTo(7 * floorHeight);
    expect(selectedCeilingY(layout, 'F12')).toBeCloseTo(layout.height);
  });
});

describe('хонгилын хуваалт (D88)', () => {
  it('сонголтгүй үед бүгд тунгалаг бус', () => {
    const { solid, ghost } = splitShaftBoxes(shafts, null);
    expect(solid).toEqual(shafts);
    expect(ghost).toEqual([]);
  });

  it('таазаар хуваана: өндрийн нийлбэр хадгалагдана, доод хэсэг тааз хүртэл', () => {
    const cut = 7 * floorHeight;
    const { solid, ghost } = splitShaftBoxes(shafts, cut);
    expect(solid).toHaveLength(shafts.length);
    expect(ghost).toHaveLength(shafts.length);
    shafts.forEach((box, i) => {
      expect(solid[i]!.size[1] + ghost[i]!.size[1]).toBeCloseTo(box.size[1]);
      expect(solid[i]!.center.y + solid[i]!.size[1] / 2).toBeCloseTo(cut);
      expect(ghost[i]!.center.y - ghost[i]!.size[1] / 2).toBeCloseTo(cut);
      expect(solid[i]!.center.x).toBe(box.center.x);
    });
  });

  it('тааз хайрцгийн гадна бол хуваахгүй', () => {
    expect(splitShaftBoxes(shafts, 1e6).ghost).toEqual([]);
    expect(splitShaftBoxes(shafts, -1).solid).toEqual([]);
  });
});
