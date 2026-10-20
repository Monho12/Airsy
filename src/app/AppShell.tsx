// App shell: дээд төлөвийн мөр ба гол layout (CLAUDE.md §8.2). Phase 2-т dashboard самбарууд жишээ snapshot-оор;
// хараахан хэрэгжээгүй хэсэг (3D, хандлага, сценари) нь зөвхөн шошготой орлуулагч — хуурамч удирдлагагүй (§8.7).
import type { ComponentType } from 'react';

import { mn } from '@/domain/i18n/mn';
import { AlertList } from '@/features/alerts';
import { DeviceList } from '@/features/devices';
import { EventTimeline } from '@/features/events';
import { FloorDetails } from '@/features/floor-details';
import { FloorList } from '@/features/floor-list';
import { StatusBar } from '@/features/status-bar';

import './AppShell.css';

const { common } = mn;

type RegionKey = keyof typeof common.regions;

/** §8.2-ын эрэмбээр (тодоос → бага руу) */
const REGION_ORDER: readonly RegionKey[] = [
  'building3d',
  'floorList',
  'floorDetails',
  'devices',
  'alerts',
  'trends',
  'events',
  'scenarios',
];

/** Phase 2-т хэрэгжсэн самбарууд; бусад нь орлуулагч хэвээр (3D — Phase 3, хандлага ба сценари — Phase 6) */
const PANELS: Partial<Record<RegionKey, ComponentType>> = {
  floorList: FloorList,
  floorDetails: FloorDetails,
  devices: DeviceList,
  alerts: AlertList,
  events: EventTimeline,
};

function PlaceholderRegion({ region }: { region: RegionKey }) {
  const headingId = `region-${region}-title`;
  return (
    <section className={`shell-region shell-region--${region}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="shell-region__title">
        {common.regions[region]}
      </h2>
      <p className="shell-region__note">{common.placeholderNote}</p>
    </section>
  );
}

export function AppShell() {
  return (
    <div className="shell">
      <header className="shell-header">
        <h1 className="shell-header__brand">
          <span className="shell-header__app">{common.appName}</span>
          <span className="shell-header__separator" aria-hidden="true">
            ·
          </span>
          <span className="shell-header__building">{common.buildingName}</span>
        </h1>
        <StatusBar />
        <p className="sim-badge">
          <span className="sim-badge__dot" aria-hidden="true" />
          {common.simulationBadge}
          <span className="visually-hidden"> — {common.simulationBadgeDescription}</span>
        </p>
      </header>

      <main className="shell-main">
        {REGION_ORDER.map((region) => {
          const Panel = PANELS[region];
          if (Panel === undefined) return <PlaceholderRegion key={region} region={region} />;
          // Wrapper нь зөвхөн grid-ийн байрлалыг өгнө; самбар өөрөө region (section) болно
          return (
            <div key={region} className={`shell-slot shell-region--${region}`}>
              <Panel />
            </div>
          );
        })}
      </main>
    </div>
  );
}
