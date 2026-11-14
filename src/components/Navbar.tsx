import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Gift,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Store,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { useAppState, store } from '../lib/store';
import { useAuth } from '../lib/auth';
import BrandLogo from './BrandLogo';
import NotificationDropdown from './NotificationDropdown';
import SearchBox from './SearchBox';

const MAIN_LINKS = [
  { to: '/', label: 'Beranda' },
  { to: '/kategori', label: 'Kategori' },
  { to: '/flash-sale', label: 'Flash Sale' },
  { to: '/voucher', label: 'Voucher' },
  { to: '/favorit', label: 'Favorit' },
  { to: '/pesanan', label: 'Pesanan Saya' },
  { to: '/akun', label: 'Akun Saya' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserMenu() {
  const { user, signOutUser } = useAuth();
  const { unreadInquiriesCount, role, profile, isAdmin } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          to="/masuk"
          className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-dark sm:px-3"
        >
          Masuk
        </Link>
        <Link
          to="/daftar"
          className="hidden rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:block"
        >
          Daftar
        </Link>
      </div>
    );
  }

  const isSeller = role === 'seller';
  const displayName = profile.name || user.displayName;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu akun ${displayName}`}
        className="flex items-center gap-1.5 rounded-lg p-1 pr-1.5 transition hover:bg-slate-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
          {initials(displayName)}
        </span>
        <ChevronDown className={`hidden h-4 w-4 text-slate-500 transition sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
              {isSeller ? 'Penjual' : 'Pembeli'}
            </span>
          </div>

          <div className="py-1">
            <Link to="/akun" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
              <User className="h-4 w-4 text-slate-400" />
              Akun Saya
            </Link>
            <Link to="/pesanan" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
              <Package className="h-4 w-4 text-slate-400" />
              Pesanan Saya
            </Link>
            <Link to="/favorit" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
              <Heart className="h-4 w-4 text-slate-400" />
              Favorit
            </Link>
            <Link to="/voucher" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
              <Ticket className="h-4 w-4 text-slate-400" />
              Voucher Saya
            </Link>
            <Link to="/akun?tab=alamat" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
              <MapPin className="h-4 w-4 text-slate-400" />
              Alamat Pengiriman
            </Link>
          </div>

          <div className="border-t border-slate-100 py-1">
            {isSeller ? (
              <Link
                to="/dashboard-seller"
                role="menuitem"
                className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <LayoutDashboard className="h-4 w-4 text-slate-400" />
                  Dashboard Penjual
                </span>
                {unreadInquiriesCount > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadInquiriesCount}
                  </span>
                )}
              </Link>
            ) : (
              <Link to="/jadi-penjual" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                <Store className="h-4 w-4 text-slate-400" />
                Jadi Penjual
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Dashboard Admin
              </Link>
            )}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void signOutUser().then(() => {
                store.showToast('Anda telah keluar.', 'info');
                navigate('/');
              });
            }}
            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { favorites, isSignedIn, role, cartCount, unreadInquiriesCount, isAdmin } = useAppState();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap text-sm transition-colors ${
      isActive ? 'font-semibold text-brand-dark' : 'text-slate-600 hover:text-brand-dark'
    }`;

  return (
    <header className="sticky top-0 z-50">
      <div className="hidden bg-navy text-white lg:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] sm:px-6 lg:px-8">
          <p className="text-white/75">Temukan Pilihan, Wujudkan Impian — marketplace properti &amp; perabot rumah.</p>
          <div className="flex items-center gap-4 text-white/80">
            <Link to="/jadi-penjual" className="transition hover:text-white">
              Mulai Jualan
            </Link>
            <Link to="/properti" className="transition hover:text-white">
              Bantuan
            </Link>
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1 transition hover:text-white">
                <ShieldCheck className="h-3 w-3" />
                Admin
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="site-navbar border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3 sm:gap-4">
            <BrandLogo className="shrink-0" />

            <div className="hidden min-w-0 flex-1 md:block">
              <SearchBox />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Link
                to="/favorit"
                aria-label={isSignedIn ? `Favorit, ${favorites.length} tersimpan` : 'Favorit'}
                className="relative hidden rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand-dark sm:flex"
              >
                <Heart className="h-5 w-5" />
                {favorites.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {favorites.length}
                  </span>
                )}
              </Link>

              <Link
                to="/keranjang"
                aria-label={`Keranjang, ${cartCount} produk`}
                className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand-dark"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

              <NotificationDropdown />

              {role === 'seller' && (
                <Link
                  to="/dashboard-seller"
                  className="hidden items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark lg:flex"
                >
                  <Plus className="h-4 w-4" />
                  Pasang Iklan
                </Link>
              )}

              <UserMenu />

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Buka menu"
                aria-expanded={menuOpen}
                className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand-dark lg:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="pb-2 md:hidden">
            <SearchBox />
          </div>

          <nav className="hidden items-center gap-5 border-t border-slate-100 py-2.5 lg:flex">
            {MAIN_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === '/'} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
            <Link
              to="/ai-studio"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-2"
            >
              <Gift className="h-3.5 w-3.5" />
              AI Studio
            </Link>
          </nav>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              {MAIN_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-brand-soft text-brand-dark' : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              <NavLink
                to="/keranjang"
                className="rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white"
              >
                Keranjang {cartCount > 0 ? `(${cartCount})` : ''}
              </NavLink>
              <NavLink
                to="/ai-studio"
                className="rounded-lg bg-navy px-3 py-2 text-center text-sm font-semibold text-white"
              >
                AI Studio
              </NavLink>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <NavLink
                    to={role === 'seller' ? '/dashboard-seller' : '/akun'}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    {role === 'seller' ? 'Dashboard Penjual' : 'Akun Saya'}
                  </NavLink>
                  {role === 'seller' ? (
                    unreadInquiriesCount > 0 ? (
                      <span className="flex items-center justify-center rounded-lg border border-brand/20 bg-brand-soft px-3 py-2 text-center text-[11px] font-medium text-brand-dark">
                        {unreadInquiriesCount} pesan belum dibaca
                      </span>
                    ) : null
                  ) : (
                    <NavLink
                      to="/jadi-penjual"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                    >
                      Jadi Penjual
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink
                      to="/admin"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                    >
                      Admin
                    </NavLink>
                  )}
                </>
              ) : (
                <>
                  <NavLink
                    to="/masuk"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    Masuk
                  </NavLink>
                  <NavLink
                    to="/daftar"
                    className="rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white"
                  >
                    Daftar
                  </NavLink>
                  <NavLink
                    to="/masuk-penjual"
                    className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    <ReceiptText className="h-4 w-4" />
                    Portal Penjual
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
