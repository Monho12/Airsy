// Утасны (< 768 px) табтай бүтэц (CLAUDE.md §8.2, D52, Phase 7b): Барилга · Дохио · Үйл явдал · Сценари.
// Бүх табын агуулга mount хийгдсэн хэвээр, идэвхгүй нь `hidden` — таб солиход самбарын дотоод төлөв (шүүлт, графикийн
// хэмжигдэхүүн г.м.) алдагдахгүй. Гарын удирдлага WAI-ARIA tabs загвараар: ←/→, Home/End, идэвхтэй таб л Tab-аар хүрнэ.
import { useId, useRef, useState, type ComponentType, type KeyboardEvent } from 'react';

import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';

import { Building3DRegion } from './Building3DRegion';

const { common } = mn;

type RegionKey = keyof typeof common.regions;
export type PhoneTab = 'building' | 'alerts' | 'events' | 'scenarios';

const TABS: readonly { key: PhoneTab; regions: readonly RegionKey[] }[] = [
  // Барилга: 3D (анхдагчаар ачаалахгүй) → 2D давхрын жагсаалт → сонгосон давхар → төхөөрөмж → хандлага
  { key: 'building', regions: ['building3d', 'floorList', 'floorDetails', 'devices', 'trends'] },
  { key: 'alerts', regions: ['alerts'] },
  { key: 'events', regions: ['events'] },
  { key: 'scenarios', regions: ['scenarios'] },
];

/** Утсан дээр 3D-ийг хойшлуулж ачаална (§8.2) */
function PhoneBuilding3D() {
  return <Building3DRegion deferred />;
}

export function PhoneLayout({ panels }: { panels: Partial<Record<RegionKey, ComponentType>> }) {
  const [active, setActive] = useState<PhoneTab>('building');
  const baseId = useId();
  const tabRefs = useRef<Partial<Record<PhoneTab, HTMLButtonElement | null>>>({});
  const openAlerts = useLiveStore((state) => state.snapshot?.alerts.active.length ?? 0);

  const focusTab = (key: PhoneTab) => {
    setActive(key);
    tabRefs.current[key]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (target === null) return;
    event.preventDefault();
    focusTab(TABS[target]!.key);
  };

  return (
    <>
      <div className="phone-tabs" role="tablist" aria-label={common.phoneTabs.label}>
        {TABS.map((tab, index) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              ref={(node) => {
                tabRefs.current[tab.key] = node;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              className="phone-tabs__tab"
              onClick={() => setActive(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {common.phoneTabs[tab.key]}
              {tab.key === 'alerts' && openAlerts > 0 && (
                <>
                  <span className="phone-tabs__count" aria-hidden="true">
                    {openAlerts}
                  </span>
                  <span className="visually-hidden">
                    , {common.phoneTabs.alertsCount(openAlerts)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {TABS.map((tab) => (
        <div
          key={tab.key}
          id={`${baseId}-panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          className="phone-tabs__panel"
          hidden={tab.key !== active}
        >
          {tab.regions.map((region) => {
            const Panel = region === 'building3d' ? PhoneBuilding3D : panels[region];
            if (Panel === undefined) return null;
            return (
              <div key={region} className={`shell-slot shell-region--${region}`}>
                <Panel />
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
