// Яаралтай байдлын мөр (CLAUDE.md §6.9, §7.2 S6, §8.7, §8.9): яаралтай байдлын симуляци идэвхтэй үед дэлгэцийн
// өргөнөөр улаан мөр, заавал байх анхааруулгын бичвэр, галын давхар, «Яаралтай симуляцийг дуусгах» (`emergency/end`,
// §7.4 A). Өнгө: дэвсгэр `--color-emergency`, бичвэр зөвхөн `--color-on-emergency` (4.83:1, §8.3).
import { Siren } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import { useLiveStore } from '@/store/liveStore';
import { useRuntime } from '@/store/runtime';
import { selectEmergency } from '@/store/selectors';

import './Scenarios.css';

const text = mn.scenarios;

export function EmergencyBar() {
  const snapshot = useLiveStore((state) => state.snapshot);
  const runtime = useRuntime();
  const emergency = useMemo(() => (snapshot ? selectEmergency(snapshot) : null), [snapshot]);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);

  if (emergency === null) return null;

  const end = async () => {
    if (runtime === null) return;
    const result = await runtime.dispatch({ type: 'emergency/end' });
    setError(result.ok ? null : result.reason);
  };

  return (
    // `role="alert"` — мөр гарч ирэхэд дэлгэц уншигч нэг удаа уншина (идэвхтэй байх хугацаанд дахин уншихгүй)
    <section className="emergency-bar" role="alert" aria-labelledby={titleId}>
      <Siren className="emergency-bar__icon" size={20} aria-hidden="true" />
      <div className="emergency-bar__text">
        <h2 id={titleId} className="emergency-bar__title">
          {text.emergencyBar.title}
        </h2>
        <p className="emergency-bar__floor">
          {text.emergencyBar.fireFloor(emergency.fireFloorLabel)}
        </p>
        <p className="emergency-bar__disclaimer">{text.emergencyDisclaimer}</p>
        <p className="emergency-bar__note">{text.emergencyBar.visualNote}</p>
        {error !== null && <p className="emergency-bar__error">{error}</p>}
      </div>
      {runtime !== null && (
        <Button className="emergency-bar__end" onClick={() => void end()}>
          {text.emergencyBar.end}
        </Button>
      )}
    </section>
  );
}
