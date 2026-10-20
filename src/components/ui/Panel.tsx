// Самбар — гарчигтай `section` (хүртээмжтэй region, CLAUDE.md §8.8).
import { useId, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  /** Гарчгийн хажуух нэмэлт мэдээлэл (тоо гэх мэт) — region-ийн нэрэнд орохгүй */
  meta?: ReactNode;
  className?: string;
  busy?: boolean;
  children: ReactNode;
}

export function Panel({ title, meta, className, busy = false, children }: PanelProps) {
  const titleId = useId();
  return (
    <section
      className={className ? `ui-panel ${className}` : 'ui-panel'}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
    >
      <div className="ui-panel__header">
        <h2 id={titleId} className="ui-panel__title">
          {title}
        </h2>
        {meta !== undefined && <span className="ui-panel__meta">{meta}</span>}
      </div>
      <div className="ui-panel__body">{children}</div>
    </section>
  );
}
