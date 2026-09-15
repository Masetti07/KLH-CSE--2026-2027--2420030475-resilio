import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; onReturnTo2D: () => void; onFailure?: () => void };
type State = { failed: boolean; retryKey: number };

export default class RendererBoundary extends Component<Props, State> {
  state: State = { failed: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("3D renderer failed", error, info); this.props.onFailure?.(); }

  render() {
    if (this.state.failed) return <div className="renderer-fallback" role="alert"><strong>3D rendering is temporarily unavailable.</strong><p>Your design is preserved and the 2D workspace remains available.</p><div><button className="secondary-button" onClick={() => this.setState((state) => ({ failed: false, retryKey: state.retryKey + 1 }))}>Retry 3D</button><button className="primary-button" onClick={this.props.onReturnTo2D}>Open 2D workspace</button></div></div>;
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
