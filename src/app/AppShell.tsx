// App shell: дээд төлөвийн мөр ба гол layout (CLAUDE.md §8.2). Phase 2-т dashboard самбарууд жишээ snapshot-оор;
// Phase 3-т 3D барилга (lazy, WebGL-гүй үед орлуулалттай); Phase 6-д сценарийн самбар, яаралтай мөр (§6.9) ба
// хандлагын график. Хэрэгжээгүй хэсэг гарвал зөвхөн шошготой орлуулагч — хуурамч удирдлагагүй (§8.7).
import type { ComponentType } from 'react';

import { mn } from '@/domain/i18n/mn';
import { AlertList } from '@/features/alerts';
import { TrendChart } from '@/features/charts';
import { DeviceList } from '@/features/devices';
import { EventTimeline } from '@/features/events';
import { FloorDetails } from '@/features/floor-details';
import { FloorList } from '@/features/floor-list';
import { EmergencyBar, ScenarioPanel } from '@/features/scenarios';
import { StatusBar } from '@/features/status-bar';

import { Building3DRegion } from './Building3DRegion';

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

/** Хэрэгжсэн самбарууд; байхгүй бол орлуулагч (§8.7) */
const PANELS: Partial<Record<RegionKey, ComponentType>> = {
  building3d: Building3DRegion,
  floorList: FloorList,
  floorDetails: FloorDetails,
  devices: DeviceList,
  alerts: AlertList,
  trends: TrendChart,
  events: EventTimeline,
  scenarios: ScenarioPanel,
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
      {/* Яаралтай байдлын симуляци идэвхтэй үед л зурагдана (§6.9, §8.7) */}
      <EmergencyBar />

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
