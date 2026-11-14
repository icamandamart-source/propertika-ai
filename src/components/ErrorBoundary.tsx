import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../lib/client-logger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Mencegah satu error render membuat seluruh aplikasi menjadi layar putih. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Kesalahan render:', error, info.componentStack);
    reportClientError({
      message: error.message || error.name,
      stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Terjadi kesalahan</h1>
          <p className="mt-2 text-sm text-slate-500">
            Aplikasi mengalami masalah saat menampilkan halaman ini. Memuat ulang biasanya menyelesaikannya.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
          >
            Muat ulang halaman
          </button>
        </div>
      </div>
    );
  }
}