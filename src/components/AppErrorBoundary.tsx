import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { contactMailto } from '../data/contact';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Worship Word Video could not render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error" role="alert">
        <AlertTriangle size={30} />
        <h1>Something did not open correctly</h1>
        <p>Your saved account services are safe. Reload the app to try again.</p>
        <button type="button" onClick={() => window.location.reload()}><RotateCcw size={17} /> Reload Worship Word Video</button>
        <a href={contactMailto('technical problem')}>Contact Stephen if it keeps happening</a>
      </main>
    );
  }
}
