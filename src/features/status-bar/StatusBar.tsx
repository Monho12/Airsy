// Төлөвийн мөр: барилгын ерөнхий төлөв, идэвхтэй дохионы тоо, автомат горимын тэмдэг (UC-1, CLAUDE.md §8.2),
// симуляцийн удирдлага (Phase 4, D74), автомат горимын товч (Phase 5, FR-C6, D78).
import { useMemo } from 'react';

import { HealthIndicator } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectStatusBar } from '@/store/selectors';

import { AutoModeToggle } from './AutoModeToggle';
import { SimulationControls } from './SimulationControls';

import './StatusBar.css';

export function StatusBar() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const data = useMemo(() => (snapshot ? selectStatusBar(snapshot) : null), [snapshot]);

  if (data === null) {
    return (
      <p className="status-bar status-bar--loading" role="status">
        {mn.common.loading}
      </p>
    );
  }

  const summary = (
    <dl className="status-bar">
      {/* Барилгын төлөв — header-ийн хамгийн чухал мэдээлэл (D101) */}
      <div className="status-bar__item status-bar__item--primary">
        <dt>{mn.common.buildingStatus}</dt>
        <dd>
          <HealthIndicator {...data.health} />
        </dd>
      </div>
      <div className="status-bar__item">
        <dt>{mn.common.regions.alerts}</dt>
        {/* Шошго «Идэвхтэй дохио» тул утга нь зөвхөн тоо (давхардалгүй, D101) */}
        <dd
          className="status-bar__count"
          data-has-alerts={data.activeAlertCount > 0}
          aria-label={mn.common.activeAlertCount(data.activeAlertCount)}
        >
          {data.activeAlertCount}
        </dd>
      </div>
      <div className="status-bar__item">
        <dt>{mn.control.autoModeLabel}</dt>
        <dd>
          {runtime === null ? (
            data.autoMode ? (
              mn.control.autoModeOn
            ) : (
              mn.control.autoModeOff
            )
          ) : (
            <AutoModeToggle runtime={runtime} enabled={data.autoMode} />
          )}
        </dd>
      </div>
    </dl>
  );

  // Runtime бүртгэгдээгүй бол (жишээ snapshot) удирдлага огт байхгүй — ажиллахгүй товч зурахгүй (§8.7)
  if (runtime === null || snapshot === null) return summary;
  return (
    <div className="status-bar-group">
      {summary}
      <SimulationControls
        runtime={runtime}
        running={snapshot.simulation.running}
        speed={snapshot.simulation.speed}
      />
    </div>
  );
}
