// Мэдрэгчийн зангилаа (CLAUDE.md §5.3, §8.6, FR-B5): бүс бүрийн 5 мэдрэгч → бүсийн тэмдгийн байрлалд НЭГ зангилаа.
// Байрлал нь `Area.markerPosition`-оос (давхрын шалнаас, §5.1.1), төлөв нь snapshot-оос — өгөгдлийг давхардуулахгүй.
import {
  buildingConfig as defaultBuildingConfig,
  type BuildingConfig,
} from '@/domain/config/building';
import type { AreaId, FloorId, HealthStatus, LiveSnapshot, Vec3 } from '@/domain/types';
import { selectAreaSummary } from '@/store/selectors';

import type { BuildingLayout } from './layout';

export interface SensorNodeLayout {
  areaId: AreaId;
  floorId: FloorId;
  /** Барилгын координат: x/z = markerPosition, y = давхрын шалны өндөр + markerPosition.y */
  position: Vec3;
}

/**
 * Зангилаа бүр нэг instance; массивын индекс = `instanceId` (§8.6-ийн `instanceId → areaId` хүснэгт).
 * Дараалал нь layout-ийн давхар → бүсийн дараалал (тогтвортой).
 */
export function createSensorNodes(
  config: BuildingConfig,
  layout: BuildingLayout,
): SensorNodeLayout[] {
  return layout.floors.flatMap((floor) =>
    floor.zones.map((zone): SensorNodeLayout => {
      const area = config.areas[zone.id];
      if (area === undefined) throw new Error(`Бүс тохиргоонд алга: ${zone.id}`);
      const { x, y, z } = area.markerPosition;
      return { areaId: area.id, floorId: floor.id, position: { x, y: floor.elevation + y, z } };
    }),
  );
}

/** Raycast-ийн `instanceId`-ээс бүсийн ID; хүснэгтэд байхгүй бол `null` (хэзээ ч таамаглахгүй). */
export function areaIdAtInstance(
  nodes: readonly SensorNodeLayout[],
  instanceId: number | undefined,
): AreaId | null {
  if (instanceId === undefined || !Number.isInteger(instanceId)) return null;
  return nodes[instanceId]?.areaId ?? null;
}

/**
 * Дэлгэрэнгүй шошго аль бүсэд (§8.6): бүс сонгогдсон бол зөвхөн сонгосон бүсэд, үгүй бол hover хийсэн бүсэд
 * (хөгжүүлэгчийн 2026-10-22-ны шийдвэр — хоёр шошго давхцахгүй). Сонголтын төлөвийг өөрчлөхгүй, зөвхөн уншина.
 */
export function detailLabelAreaId(
  selectedAreaId: AreaId | null,
  hoveredAreaId: AreaId | null,
): AreaId | null {
  return selectedAreaId ?? hoveredAreaId;
}

export interface SensorNodeStatus {
  /** Зангилааны өнгө: хамгийн муу *зөв* төлөв; зөв утга огт байхгүй бол хамгийн муу (offline/invalid → саарал) */
  status: HealthStatus;
  /** Зөв утгатай ч өгөгдлийн асуудалтай — саарал «хөндий» цагираг (§5.6: асуудал жинхэнэ төлөвийг далдлахгүй) */
  dataIssue: boolean;
}

/** 2D `HealthIndicator`-ийн дүрмийг 3D-д (§5.6, §8.6); бүсийн утга snapshot-д огт байхгүй бол `offline`. */
export function sensorNodeStatuses(
  snapshot: LiveSnapshot | null,
  nodes: readonly SensorNodeLayout[],
  config: BuildingConfig = defaultBuildingConfig,
): SensorNodeStatus[] {
  return nodes.map(({ areaId }) => {
    const summary = snapshot === null ? undefined : selectAreaSummary(snapshot, areaId, config);
    const readingCount = summary === undefined ? 0 : Object.keys(summary.readings).length;
    if (summary === undefined || readingCount === 0) return { status: 'offline', dataIssue: false };
    const { worst, worstValid, hasDataIssue } = summary.health;
    return { status: worstValid ?? worst, dataIssue: hasDataIssue && worstValid !== null };
  });
}
