// Модал dialog (CLAUDE.md §8.7, §8.8): focus-ийг дотроо барина (Tab / Shift+Tab эргэлдэнэ), Escape-ээр хаагдана,
// хаагдахад өмнө нь focus-тэй байсан элемент рүү focus буцна. Нээгдэхэд `data-autofocus` элемент (байхгүй бол эхний
// focus авах элемент) focus авна. Portal хэрэглэхгүй — `position: fixed` давхарга (react-dom-ийн нэмэлт API-гүй).
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Үндсэн агуулга (тайлбар) — `aria-describedby`-д холбогдоно */
  children: ReactNode;
  /** Доод хэсгийн товчнууд */
  actions: ReactNode;
  /** Анхааруулгын (яаралтай байдлын) хэв маяг — ноцтой өнгийн хүрээ */
  tone?: 'default' | 'danger';
}

export function Dialog({ open, title, onClose, children, actions, tone = 'default' }: DialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Нээгдэхийн өмнөх focus-ийг санаж, хаагдахад буцаана (§8.8)
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = boxRef.current;
    const target =
      box?.querySelector<HTMLElement>('[data-autofocus]') ??
      box?.querySelector<HTMLElement>(FOCUSABLE) ??
      box;
    target?.focus();
    return () => previous?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const box = boxRef.current;
    if (box === null) return;
    const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    // Focus dialog-оос гарахгүй: төгсгөлөөс эхэнд, эхнээс төгсгөлд эргэлдэнэ
    if (event.shiftKey && (active === first || active === box)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="ui-dialog__backdrop">
      <div
        ref={boxRef}
        className={tone === 'danger' ? 'ui-dialog ui-dialog--danger' : 'ui-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="ui-dialog__title">
          {title}
        </h2>
        <div id={bodyId} className="ui-dialog__body">
          {children}
        </div>
        <div className="ui-dialog__actions">{actions}</div>
      </div>
    </div>
  );
}
