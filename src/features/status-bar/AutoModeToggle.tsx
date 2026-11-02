// Ерөнхий автомат горимын товч (FR-C6, CLAUDE.md §6.7, §8.2, §8.8, D78). `aria-pressed` + бичвэр (зөвхөн өнгөөр биш);
// командыг `AerisRuntime.dispatch`-аар илгээж, шинэ төлөв `subscribe` → store-оор ирнэ. Татгалзвал Монгол шалтгаан.
import { useState } from 'react';

import { Button } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';
import type { AerisRuntime } from '@/domain/runtime/AerisRuntime';

export function AutoModeToggle({ runtime, enabled }: { runtime: AerisRuntime; enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="auto-mode">
      <Button
        className={`auto-mode__toggle${enabled ? ' auto-mode__toggle--on' : ''}`}
        aria-pressed={enabled}
        aria-label={mn.control.autoModeLabel}
        onClick={async () => {
          const result = await runtime.dispatch({ type: 'control/setAutoMode', enabled: !enabled });
          setError(result.ok ? null : result.reason);
        }}
      >
        {enabled ? mn.control.autoModeOn : mn.control.autoModeOff}
      </Button>
      {error !== null && (
        <span className="sim-controls__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
