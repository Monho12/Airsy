// §9.5-ын 6b үе шат: удирдлагын төлөвийг толилдог дохионы нөхцөл (CLAUDE.md §4.4, §6.6, D35, D38).
// Debounce-гүй (эх төлөв нь аль хэдийн debounce/hysteresis-ээр баталгаажсан). Idempotent — дохио аль хэдийн хүссэн
// төлөвтэй бол үйл явдал гарахгүй (`evaluateAlerts`). `emergency` дохиог ЗӨВХӨН үүсгэнэ: яаралтай байдал идэвхгүй үед
// нөхцөлийг огт дамжуулахгүй тул 6b түүнийг хэзээ ч шийдэхгүй (§9.5-ын эзэмшлийн хүснэгт).
import type { AlertCondition } from '@/domain/alerts/evaluator';
import type { BuildingConfig } from '@/domain/config/building';
import { floorLabelMn, mn } from '@/domain/i18n/mn';
import type { ControlState } from '@/domain/types';

import { floorLevelOf } from './rules';

export function controlSignalConditions(
  config: BuildingConfig,
  control: ControlState,
): AlertCondition[] {
  const buildingId = config.building.id;
  const fallback = new Set(control.fallbackFloors);
  const conditions: AlertCondition[] = config.building.floorIds.map((floorId) => {
    const label = floorLabelMn(floorLevelOf(floorId));
    return {
      key: `control_degraded:${floorId}`,
      type: 'control_degraded',
      scope: { floorId },
      level: fallback.has(floorId) ? 'warning' : 'normal',
      title: mn.alerts.controlDegradedTitle(label),
      message: mn.alerts.controlDegradedMessage(label),
      value: null,
      peak: null,
    };
  });
  conditions.push({
    key: `outdoor_air_restricted:${buildingId}`,
    type: 'outdoor_air_restricted',
    scope: {},
    level: control.outdoorAirRestricted ? 'warning' : 'normal',
    title: mn.alerts.outdoorAirRestrictedTitle,
    message: mn.alerts.outdoorAirRestrictedMessage,
    value: null,
    peak: null,
  });
  if (control.emergency !== null) {
    const fireFloorId = control.emergency.fireFloorId;
    conditions.push({
      key: `emergency:${buildingId}`,
      type: 'emergency',
      scope: { floorId: fireFloorId },
      level: 'critical',
      title: mn.alerts.emergencyTitle,
      message: mn.alerts.emergencyMessage(floorLabelMn(floorLevelOf(fireFloorId))),
      value: null,
      peak: null,
    });
  }
  return conditions;
}
