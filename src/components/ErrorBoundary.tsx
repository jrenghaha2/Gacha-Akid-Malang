import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan sistem.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ZEROTH ErrorBoundary caught error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#0a0c0f] text-neutral-100 flex items-center justify-center p-4 ak-grid-bg">
          <div className="ak-result-terminal max-w-md w-full overflow-hidden">
            <div className="ak-hazard-strip" />
            <div className="p-5 space-y-4">
              <div className="text-[11px] font-mono-tech text-orange-400 tracking-[0.2em]">
                // ZEROTH.SYSTEM_RECOVERY
              </div>
              <h2 className="text-lg font-bold text-red-400">TERJADI GANGGUAN SINKRONISASI</h2>
              <p className="text-xs text-neutral-300 leading-relaxed break-words bg-neutral-950/80 border border-red-500/30 p-3 rounded font-mono-tech max-h-40 overflow-y-auto scroll-area">
                {this.state.errorMessage}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ak-cut btn-press w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-sm font-bold text-white"
              >
                ↺ MUAT ULANG TERMINAL
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
