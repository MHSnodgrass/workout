import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Keeps one broken screen from taking the app with it.
 *
 * React unmounts the entire tree on an uncaught render error, so before this
 * existed a failure on the Stats route left a blank page with no tab bar — no
 * way back to anything that still worked. The boundary is placed inside the
 * layout, so the tab bar always survives.
 *
 * Reset by `key`ing this on the route: without that, one bad screen would stay
 * broken for the rest of the session even after navigating away.
 */
export default class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No reporting service to send this to, but the console is where anyone
    // debugging on a phone will actually look.
    console.error('Screen failed to render', error, info.componentStack);
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div className="screen">
        <h1>This screen didn't load</h1>
        <div className="card">
          <p className="small">
            Usually this means the app updated while it was open. Reloading picks up the new
            version. Your data is stored on this device and isn't affected.
          </p>
          <button className="primary big" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
        <p className="small">{this.state.error.message}</p>
      </div>
    );
  }
}
