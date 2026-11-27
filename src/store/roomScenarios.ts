// Өрөөний сценари эхлүүлэх нийтлэг зам (С7, D93, D99). «Сонгосон давхар» самбар ба 3D мэдрэгчийн шошго хоёулаа
// энэ функцийг дуудна — эхлүүлэх дүрэм нэг газар: өөр сценари эсвэл яаралтай байдал идэвхтэй бол шууд эхлүүлэхгүй,
// `uiStore.pendingRoomScenario`-д тавьж баталгаажуулалтын dialog нээнэ (§7.1, D81).
import type { AerisRuntime, CommandResult } from '@/domain/runtime/AerisRuntime';
import type { AreaId, LiveSnapshot, RoomScenarioId } from '@/domain/types';

import { useUiStore } from './uiStore';

/** Өрөөний сценари шууд эхлүүлнэ (баталгаажуулалтгүй) */
export function startRoomScenario(
  runtime: AerisRuntime,
  scenarioId: RoomScenarioId,
  areaId: AreaId,
): Promise<CommandResult> {
  return runtime.dispatch({ type: 'scenario/startRoom', scenarioId, areaId });
}

/** Баталгаажуулалт шаардлагатай эсэх: өөр сценари эсвэл яаралтай байдал идэвхтэй (D81) */
export function roomScenarioNeedsConfirm(snapshot: LiveSnapshot): boolean {
  return snapshot.simulation.activeScenario !== null || snapshot.control.emergency !== null;
}

/**
 * Товч дарахад: баталгаажуулалт хэрэгтэй бол dialog нээж `null` буцаана, үгүй бол шууд эхлүүлж үр дүнг буцаана.
 */
export async function requestRoomScenario(
  runtime: AerisRuntime,
  snapshot: LiveSnapshot,
  scenarioId: RoomScenarioId,
  areaId: AreaId,
): Promise<CommandResult | null> {
  if (roomScenarioNeedsConfirm(snapshot)) {
    useUiStore.getState().setPendingRoomScenario({ scenarioId, areaId });
    return null;
  }
  return startRoomScenario(runtime, scenarioId, areaId);
}
