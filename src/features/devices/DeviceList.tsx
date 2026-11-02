// Сонгосон давхрын агааржуулалтын төхөөрөмж (FR-B6, FR-C7, FR-C8, CLAUDE.md §5.7, §6.7, §6.8, §8.2, D78).
// Мөр бүрт: төлөв, горимын тэмдэг (АВТ/ГАР), гар удирдлагын dropdown, «Автомат руу буцаах» (зөвхөн гар үед), мөрийн
// доор задрах «Яагаад?» шалгагч. Командыг зөвхөн `AerisRuntime.dispatch`-аар; runtime байхгүй бол удирдлага огт
// зурагдахгүй (§8.7 — ажиллахгүй товч байхгүй).
import { useMemo } from 'react';

import { EmptyState, Panel, Skeleton } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectFloorDevices } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import { DeviceRow } from './DeviceRow';

import './DeviceList.css';

export function DeviceList() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);
  const runtime = useRuntime();

  // Тохиргооны дарааллаар: SF → EF → OAD
  const devices = useMemo(
    () => (snapshot && selectedFloorId ? selectFloorDevices(snapshot, selectedFloorId) : []),
    [snapshot, selectedFloorId],
  );

  const title = mn.common.regions.devices;
  if (snapshot === null) {
    return (
      <Panel title={title} busy>
        <Skeleton />
      </Panel>
    );
  }
  if (selectedFloorId === null) {
    return (
      <Panel title={title}>
        <EmptyState message={mn.common.noFloorSelected} />
      </Panel>
    );
  }
  if (devices.length === 0) {
    return (
      <Panel title={title}>
        <EmptyState message={mn.common.noData} />
      </Panel>
    );
  }

  return (
    <Panel title={title}>
      <ul className="device-list">
        {devices.map((device) => (
          <DeviceRow
            key={device.id}
            device={device}
            decision={snapshot.decisions[device.id] ?? null}
            runtime={runtime}
          />
        ))}
      </ul>
    </Panel>
  );
}
