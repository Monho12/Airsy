// Ачаалж буй ба хоосон төлөв (CLAUDE.md §8.7).
import { mn } from '@/domain/i18n/mn';

/** Эхний snapshot ирэхээс өмнө — хөдөлгөөн багасгах үед хөдөлгөөнгүй (§8.5). */
export function Skeleton({ label = mn.common.loading }: { label?: string }) {
  return (
    <div className="ui-skeleton" role="status">
      <span className="visually-hidden">{label}</span>
      <span className="ui-skeleton__bar" aria-hidden="true" />
      <span className="ui-skeleton__bar" aria-hidden="true" />
      <span className="ui-skeleton__bar" aria-hidden="true" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="ui-empty">{message}</p>;
}
