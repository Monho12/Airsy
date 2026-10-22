// 3D хэсгийн error boundary (CLAUDE.md §8.7, §11.5, D57). Орлуулах UI агуулахгүй — алдааг л мэдэгдэнэ.
// Lazy chunk ачаалагдаагүй (сүлжээ) болон зурах үеийн алдаа хоёуланг барина.
import { Component, type ReactNode } from 'react';

interface Props {
  onError: () => void;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class Building3DErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    // Алдааны дараа юу ч зурахгүй — орлуулах харагдацыг `app/` сонгоно (§8.6)
    return this.state.failed ? null : this.props.children;
  }
}
