import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useAppState } from '../lib/store';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { isAdmin, adminReady } = useAppState();
  const location = useLocation();

  if (!ready) return <LoadingSpinner label="Memeriksa status masuk..." />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/masuk?next=${next}`} replace />;
  }

  if (!adminReady) return <LoadingSpinner label="Memeriksa akses admin..." />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Akses ditolak</h1>
        <p className="mt-2 text-sm text-slate-500">
          Halaman ini hanya dapat dibuka oleh akun admin.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
