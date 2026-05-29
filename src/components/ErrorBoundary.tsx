import { Component, type ErrorInfo, type ReactNode } from "react";

// Minimal class error boundary. main.tsx renders one of three roots
// (Settings / HUD / ConversationWorker) directly; without a boundary a
// render-time throw in any of them blanks the whole window with no
// signal. This catches the throw, logs it (so it still surfaces in the
// devtools console / log bridge), and shows a plain fallback so the
// window stays alive and the user can at least close / reopen it.

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ui] render error caught by boundary", error, info);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <main
          style={{
            padding: 16,
            font: "13px -apple-system, system-ui, sans-serif",
            color: "#1d1d1f",
            lineHeight: 1.5,
          }}
        >
          <p style={{ fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong.
          </p>
          <p style={{ margin: 0, opacity: 0.7, whiteSpace: "pre-wrap" }}>
            {error.message}
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
