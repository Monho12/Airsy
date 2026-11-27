// Шүүлтийн нээгддэг хэсэг (D101; шүүмжийн P2): ихэнх үед ашиглагдахгүй шүүлтүүд агуулгаас их зай эзлэхгүй.
// Идэвхтэй шүүлттэй үед анхнаасаа нээлттэй; хаалттай үед ч идэвхтэй шүүлтийн тоо товчин дээр харагдана.
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { mn } from '@/domain/i18n/mn';

export function FilterDisclosure({
  activeCount,
  children,
}: {
  /** Анхдагчаас өөр утгатай шүүлтийн тоо */
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(activeCount > 0);
  const bodyId = useId();
  const text = mn.common.filters;
  return (
    <div className="ui-filter-disclosure" data-open={open}>
      <button
        type="button"
        className="ui-filter-disclosure__toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        {text.toggle}
        {activeCount > 0 && (
          <span className="ui-filter-disclosure__count">{text.activeCount(activeCount)}</span>
        )}
        <ChevronDown className="ui-filter-disclosure__chevron" size={14} aria-hidden="true" />
      </button>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
