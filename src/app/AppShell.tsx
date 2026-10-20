// Phase 1-ийн app shell: дээд төлөвийн мөр ба гол layout-ийн орлуулагч хэсгүүд (CLAUDE.md §8.2, §13 Phase 1).
// Хэсгүүд зөвхөн шошготой, интерактив биш — хуурамч товч, удирдлага байхгүй (§8.7).
import { mn } from '@/domain/i18n/mn';

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
        <p className="sim-badge">
          <span className="sim-badge__dot" aria-hidden="true" />
          {common.simulationBadge}
          <span className="visually-hidden"> — {common.simulationBadgeDescription}</span>
        </p>
      </header>

      <main className="shell-main">
        {REGION_ORDER.map((region) => (
          <PlaceholderRegion key={region} region={region} />
        ))}
      </main>
    </div>
  );
}
