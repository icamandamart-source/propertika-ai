import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { store, useAppState } from '../lib/store';

const STYLES = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  error: { icon: AlertTriangle, className: 'border-red-200 bg-red-50 text-red-900' },
  info: { icon: Info, className: 'border-slate-200 bg-white text-slate-900' },
} as const;

export default function Toast() {
  const { toast } = useAppState();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => store.dismissToast(), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const { icon: Icon, className } = STYLES[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 z-[60] flex justify-center md:inset-x-auto md:right-6 md:bottom-6 md:justify-end"
    >
      <div className={`flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${className}`}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium">{toast.message}</p>
        <button
          type="button"
          onClick={() => store.dismissToast()}
          aria-label="Tutup notifikasi"
          className="opacity-60 transition hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
