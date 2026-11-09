// Самбар бүрийн error boundary (CLAUDE.md §8.7, §11.5, Phase 7c). Нэг самбар зурахад алдаа гарвал бүх апп унахгүй —
// зөвхөн тэр самбарын оронд энгийн мессеж ба «Дахин оролдох» товч гарна. Товч дарахад самбарыг шинээр mount хийнэ.
import { Component, type ReactNode } from 'react';

import { Panel } from '@/components/ui';
import { mn } from '@/domain/i18n/mn';

interface Props {
  /** Самбарын гарчиг — алдааны үед ч хэсэг нь нэртэй (region) хэвээр */
  title: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
  /** «Дахин оролдох» бүрт +1 — хүүхдийг шинэ `key`-ээр дахин mount хийнэ */
  attempt: number;
}

export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  private retry = () => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  render() {
    if (!this.state.failed) {
      return <PanelSlot key={this.state.attempt}>{this.props.children}</PanelSlot>;
    }
    return (
      <Panel title={this.props.title}>
        <div className="panel-error" role="alert">
          <p className="panel-error__message">{mn.common.panelError.message}</p>
          <button type="button" className="shell-button" onClick={this.retry}>
            {mn.common.panelError.retry}
          </button>
        </div>
      </Panel>
    );
  }
}

/** `key` солигдоход доорх модыг бүхэлд нь дахин үүсгэх энгийн wrapper */
function PanelSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
