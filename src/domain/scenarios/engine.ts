// Сценарийн engine-ийн цэвэр туслахууд (CLAUDE.md §7.1, §9.5-ын 1-р алхам). Runtime эдгээрээр алхмыг хугацаагаар
// гүйцэтгэж, нийцлийг шалгаж, явцыг тооцно. Оролтын нөлөө `inputs.ts`-д.
import type { BuildingConfig } from '@/domain/config/building';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { ScenarioAction, ScenarioStep, SimulationScenario } from '@/domain/types';

/** Үйлдэлд дурдагдсан давхар/бүс/мэдрэгчийн ID (`'all'`-ийг тооцохгүй) */
function referencedIds(action: ScenarioAction): string[] {
  switch (action.type) {
    case 'setOccupancy':
      return action.areaIds === 'all' ? [] : action.areaIds;
    case 'setHeatGain':
      return action.floorIds;
    case 'pulseSource':
      return action.areaIds;
    case 'disconnectSensor':
      return action.sensorIds;
    case 'reconnectSensor':
      return action.sensorIds === 'all' ? [] : action.sensorIds;
    case 'injectInvalidReading':
      return [action.sensorId];
    case 'startEmergency':
      return [action.fireFloorId];
    case 'setOutdoor':
    case 'restoreBaselineInputs':
      return [];
  }
}

const existsIn = (config: BuildingConfig, id: string) =>
  config.floors[id] !== undefined ||
  config.areas[id] !== undefined ||
  config.sensors[id] !== undefined;

/** `F08`, `F08-A`, `F08-A-co2` → 8; давхаргүй (`OUT-*`) бол `null` */
function floorLevelOf(id: string): number | null {
  const match = /^F(\d{2})/.exec(id);
  return match === null ? null : Number(match[1]);
}

/**
 * Сценарийн алхмууд одоогийн тохиргоонд нийцэх эсэх (§5.1 «Сценарийн нийцэл», D18). Нийцэхгүй бол Монгол шалтгаан;
 * нийцвэл `null`. Байхгүй давхарт чимээгүй хандахгүй.
 */
export function scenarioIncompatibility(
  scenario: SimulationScenario,
  config: BuildingConfig,
): string | null {
  const missing = scenario.steps
    .flatMap((step) => referencedIds(step.action))
    .filter((id) => !existsIn(config, id));
  if (missing.length === 0) return null;
  const levels = missing.map(floorLevelOf).filter((level) => level !== null);
  const required = levels.length > 0 ? Math.max(...levels) : config.building.floorIds.length + 1;
  return mn.scenarios.incompatible(floorLabelMn(required), config.building.floorIds.length);
}

/** `executed` алхам гүйцэтгэгдсэний дараа `elapsedMs`-д хугацаа нь болсон алхмууд (дарааллаар) */
export function dueSteps(
  scenario: SimulationScenario,
  executed: number,
  elapsedMs: number,
): ScenarioStep[] {
  const due: ScenarioStep[] = [];
  for (let i = executed; i < scenario.steps.length; i += 1) {
    const step = scenario.steps[i]!;
    if (step.atMs > elapsedMs) break;
    due.push(step);
  }
  return due;
}

/** Сүүлийн алхмын хугацаа (алхамгүй бол 0) */
const lastStepAt = (scenario: SimulationScenario) =>
  scenario.steps.reduce((max, step) => Math.max(max, step.atMs), 0);

/**
 * Явц 0–1: хугацаагаар дуусах сценарид `elapsed / afterMs`; «бүгд хэвийн» болох хүртэл үргэлжлэх сценарид сүүлийн
 * алхам хүртэлх хугацааг 0.9 хүртэл, дараа нь дуусах хүртэл 0.9-д барина.
 */
export function scenarioProgress(scenario: SimulationScenario, elapsedMs: number): number {
  if ('afterMs' in scenario.completion) {
    const total = scenario.completion.afterMs;
    return total <= 0 ? 1 : Math.min(1, Math.max(0, elapsedMs / total));
  }
  const last = lastStepAt(scenario);
  if (last <= 0) return 0.9;
  return Math.min(0.9, (0.9 * Math.max(0, elapsedMs)) / last);
}
