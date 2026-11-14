import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useAppState } from '../lib/store';
import type { UserRole } from '../types';

const ROLE_HOME: Record<UserRole, string> = {
  buyer: '/dashboard-user',
  seller: '/dashboard-seller',
};

/**
 * Alihkan ke halaman masuk yang sesuai peran bila pengguna belum masuk, atau ke
 * dashboard peran yang benar bila akun mencoba membuka dashboard peran lain.
 */
export default function ProtectedRoute({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { user, ready } = useAuth();
  const { role: currentRole } = useAppState();
  const location = useLocation();

  if (!ready) {
    return <LoadingSpinner />;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    const loginPath = role === 'seller' ? '/masuk-penjual' : '/masuk';
    return <Navigate to={`${loginPath}?next=${next}`} replace />;
  }

  if (role) {
    if (!currentRole) return <LoadingSpinner />;
    if (currentRole !== role) return <Navigate to={ROLE_HOME[currentRole]} replace />;
  }

  return <>{children}</>;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Memeriksa status masuk…</span>
    </div>
  );
}
