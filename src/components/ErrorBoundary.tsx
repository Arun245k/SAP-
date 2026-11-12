import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nexus Component Error caught by boundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#02040a] text-slate-300 font-mono min-h-[400px]">
          <div className="max-w-md w-full p-6 rounded-2xl border border-rose-500/30 bg-rose-950/10 backdrop-blur-md text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertOctagon size={24} />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-2">
              QUANTUM VIEW SYNCHRONIZATION FAULT
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {this.state.error?.message || 'A module evaluation or rendering anomaly interrupted interface telemetry.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-colors"
              >
                <Home size={14} />
                Return to Core
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/20 transition-colors"
              >
                <RefreshCw size={14} />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
