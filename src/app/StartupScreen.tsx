// Апп эхлэх дэлгэц (D106): барилгын өгөгдлийг серверээс ачаалж байна / ачаалж чадсангүй.
// Барилгын өгөгдөл зөвхөн backend-д тул түүнгүйгээр симуляци ба 3D эхлэхгүй.
import { Button } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';

import './StartupScreen.css';

const text = mn.common.server;

type StartupScreenProps = { state: 'loading' } | { state: 'error'; onRetry: () => void };

export function StartupScreen(props: StartupScreenProps) {
  if (props.state === 'loading') {
    return (
      <main className="startup" aria-busy="true">
        <p className="startup__brand">{mn.common.appName}</p>
        <p role="status">{text.startupLoading}</p>
      </main>
    );
  }
  return (
    <main className="startup">
      <p className="startup__brand">{mn.common.appName}</p>
      <div className="startup__error" role="alert">
        <h1 className="startup__title">{text.startupErrorTitle}</h1>
        <p>{text.startupErrorBody}</p>
        <p className="startup__hint">
          <code>{text.startupErrorHint}</code>
        </p>
      </div>
      <Button onClick={props.onRetry}>{text.retry}</Button>
    </main>
  );
}
