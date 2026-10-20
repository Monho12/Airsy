// Сонгосон давхрын агааржуулалтын төхөөрөмж — зөвхөн харах (FR-B6, CLAUDE.md §5.7, §8.2).
// Гар удирдлага ба «Яагаад?» Phase 5-д (§13); энд хуурамч товч байхгүй (§8.7).
import { useMemo } from 'react';

import { EmptyState, Panel, Skeleton } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { selectFloorDevices } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';

import './DeviceList.css';

export function DeviceList() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const selectedFloorId = useUiStore((state) => state.selectedFloorId);

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
      <dl className="device-list">
        {devices.map((device) => (
          <div key={device.id} className="device-list__row" data-device-kind={device.kind}>
            <dt className="device-list__kind">{mn.devices.kind[device.kind]}</dt>
            <dd className="device-list__state">{mn.devices.stateLabel(device.state)}</dd>
            <dd className="device-list__mode">{mn.control.mode[device.mode]}</dd>
          </div>
        ))}
      </dl>
      <p className="device-list__note">{mn.devices.readOnlyNote}</p>
    </Panel>
  );
}
