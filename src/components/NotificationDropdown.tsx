import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox, MessageSquare, Sparkles, Volume2 } from 'lucide-react';
import { store, useAppState } from '../lib/store';
import { formatDate } from '../lib/format';
import { requestNotificationPermission } from '../lib/notifications';

export default function NotificationDropdown() {
  const { inquiries, unreadInquiriesCount, isSignedIn, role } = useAppState();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const dashboardPath = role === 'seller' ? '/dashboard-seller' : '/dashboard-user';

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleItemClick = (id: string) => {
    store.markInquiryAsRead(id);
    setOpen(false);
    navigate(dashboardPath);
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    if (result === 'granted') {
      store.showToast('Izin notifikasi peramban aktif!', 'success');
    } else {
      store.showToast('Izin notifikasi belum diaktifkan.', 'info');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng Notifikasi */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notifikasi pesan, ${unreadInquiriesCount} pesan baru`}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-emerald-900"
      >
        <Bell className="h-5 w-5" />
        {unreadInquiriesCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadInquiriesCount > 9 ? '9+' : unreadInquiriesCount}
          </span>
        )}
      </button>

      {/* Panel Dropdown Notifikasi */}
      {open && (
        <div
          role="region"
          aria-label="Pemberitahuan pesan masuk"
          className="absolute right-0 z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-900">
                <Bell className="h-4 w-4" />
              </span>
              <span className="font-semibold text-slate-900 text-sm">Pesan Masuk</span>
              {unreadInquiriesCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {unreadInquiriesCount} baru
                </span>
              )}
            </div>

            {unreadInquiriesCount > 0 && (
              <button
                type="button"
                onClick={() => store.markAllInquiriesAsRead()}
                className="flex items-center gap-1 text-xs font-medium text-emerald-900 transition hover:text-emerald-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai dibaca
              </button>
            )}
          </div>

          {/* Banner izin notifikasi browser jika belum diaktifkan */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
            <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-xs text-amber-900">
              <span className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                Aktifkan notifikasi browser
              </span>
              <button
                type="button"
                onClick={handleRequestPermission}
                className="rounded-md bg-amber-600 px-2 py-1 font-medium text-white transition hover:bg-amber-700"
              >
                Izinkan
              </button>
            </div>
          )}

          {/* List Pesan */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {inquiries.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada pesan masuk</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pesan pertanyaan dari calon pembeli akan langsung muncul di sini.
                </p>
                {isSignedIn && (
                  <button
                    type="button"
                    onClick={() => store.simulateIncomingInquiry()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/20 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Simulasi Pesan Masuk
                  </button>
                )}
              </div>
            ) : (
              inquiries.slice(0, 5).map((inquiry) => (
                <div
                  key={inquiry.id}
                  onClick={() => handleItemClick(inquiry.id)}
                  className={`group relative flex cursor-pointer items-start gap-3 p-4 transition hover:bg-slate-50 ${
                    !inquiry.read ? 'bg-emerald-50/30' : 'bg-white'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      !inquiry.read
                        ? 'bg-emerald-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {inquiry.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {inquiry.name}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatDate(inquiry.createdAt)}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-800">
                      {inquiry.listingTitle}
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {inquiry.message}
                    </p>
                  </div>

                  {!inquiry.read && (
                    <span
                      aria-label="Belum dibaca"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {inquiries.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
              {isSignedIn && (
                <button
                  type="button"
                  onClick={() => store.simulateIncomingInquiry()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-emerald-900"
                  title="Simulasikan pesan untuk mencoba nada dan notifikasi"
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Tes Notifikasi
                </button>
              )}
              <Link
                to={dashboardPath}
                onClick={() => setOpen(false)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 hover:underline"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Lihat Semua Pesan
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
