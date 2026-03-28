import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-slate-400">The app hit an unexpected error. Reload to continue.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 rounded-lg bg-primary-600 hover:bg-primary-500 transition-colors text-sm font-medium"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
