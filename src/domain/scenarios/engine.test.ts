// Сценарийн engine-ийн туслахууд ба тодорхойлолтын бүрэн бүтэн байдал (CLAUDE.md §5.1, §7.1, §7.2, D18).
import { describe, expect, it } from 'vitest';

import { buildingConfig, createBuildingConfig } from '@/domain/config/building';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { ScenarioId } from '@/domain/types';

import { scenarioDefinitions, scenarioOrder } from './definitions';
import { dueSteps, scenarioIncompatibility, scenarioProgress } from './engine';

describe('тодорхойлолт (§7.2)', () => {
  it('8 сценари §7.2-ын дарааллаар, ID нь түлхүүртэйгээ таарна', () => {
    expect(scenarioOrder).toEqual([
      'normal-operation',
      'elevated-temperature',
      'high-co2',
      'voc-cleaning',
      'poor-outdoor-air',
      'fire-emergency',
      'sensor-disconnection',
      'recovery',
    ]);
    for (const id of scenarioOrder) expect(scenarioDefinitions[id].id).toBe(id);
  });

  it('зөвхөн Сэргэлт одоогийн төлөвөөс, зөвхөн яаралтай байдал баталгаажуулалттай', () => {
    for (const id of scenarioOrder) {
      const def = scenarioDefinitions[id];
      expect(def.startsFrom).toBe(id === 'recovery' ? 'current' : 'baseline');
      expect(def.requiresConfirmation).toBe(id === 'fire-emergency');
    }
  });

  it('алхмууд хугацааны дарааллаар; анхдагч 12 давхарт бүгд нийцнэ', () => {
    for (const id of scenarioOrder) {
      const def = scenarioDefinitions[id];
      const times = def.steps.map((step) => step.atMs);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(scenarioIncompatibility(def, buildingConfig)).toBeNull();
    }
  });

  it('нэр ба тайлбар Монгол бичвэрийн модулиас (§8.9)', () => {
    for (const id of scenarioOrder) {
      expect(scenarioDefinitions[id].name).toBe(mn.scenarios.name[id]);
      expect(scenarioDefinitions[id].description).toBe(mn.scenarios.description[id]);
    }
  });
});

describe('нийцэл (§5.1, D18)', () => {
  it('6 давхарт 8-р давхар шаардсан сценари Монгол шалтгаантай', () => {
    const six = createBuildingConfig(6);
    const reason = scenarioIncompatibility(scenarioDefinitions['fire-emergency'], six);
    expect(reason).toBe(mn.scenarios.incompatible(floorLabelMn(9), 6));
    expect(scenarioIncompatibility(scenarioDefinitions['high-co2'], six)).toBeNull();
    expect(
      scenarioIncompatibility(scenarioDefinitions['elevated-temperature'], six),
    ).not.toBeNull();
  });

  it("'all' ба гадна мэдрэгч дурын давхрын тоонд нийцнэ", () => {
    const one = createBuildingConfig(1);
    const ok: ScenarioId[] = ['normal-operation', 'recovery'];
    for (const id of ok) expect(scenarioIncompatibility(scenarioDefinitions[id], one)).toBeNull();
  });
});

describe('алхам ба явц', () => {
  const s7 = scenarioDefinitions['sensor-disconnection'];

  it('хугацаа нь болсон алхмуудыг дарааллаар, гүйцэтгэгдсэнийг алгасна', () => {
    expect(dueSteps(s7, 0, 0)).toHaveLength(1);
    expect(dueSteps(s7, 1, 4_999)).toHaveLength(0);
    expect(dueSteps(s7, 1, 20_000).map((step) => step.atMs)).toEqual([5_000, 20_000]);
    expect(dueSteps(s7, 4, 1e9)).toHaveLength(0);
  });

  it('хугацаагаар дуусах сценарийн явц 0–1; «бүгд хэвийн» сценари 0.9-д барина', () => {
    expect(scenarioProgress(s7, 0)).toBe(0);
    expect(scenarioProgress(s7, 30_000)).toBe(0.5);
    expect(scenarioProgress(s7, 1e9)).toBe(1);
    const s4 = scenarioDefinitions['voc-cleaning'];
    expect(scenarioProgress(s4, 10_000)).toBeCloseTo(0.45);
    expect(scenarioProgress(s4, 1e9)).toBe(0.9);
  });
});
