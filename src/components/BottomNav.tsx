import { NavLink } from 'react-router-dom';
import { Home, LayoutGrid, ShoppingCart, UserRound, Zap } from 'lucide-react';
import { useAppState } from '../lib/store';

const ITEMS = [
  { name: 'Beranda', path: '/', icon: Home },
  { name: 'Kategori', path: '/kategori', icon: LayoutGrid },
  { name: 'Flash Sale', path: '/flash-sale', icon: Zap },
  { name: 'Keranjang', path: '/keranjang', icon: ShoppingCart },
  { name: 'Akun', path: '/akun', icon: UserRound },
];

export default function BottomNav() {
  const { cartCount } = useAppState();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-dark' : 'text-slate-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" />}
                <span className="relative">
                  <item.icon className={`h-[22px] w-[22px] ${isActive ? 'text-brand' : 'text-slate-500'}`} />
                  {item.path === '/keranjang' && cartCount > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white ring-1 ring-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                  {item.path === '/flash-sale' && !isActive && (
                    <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-brand flash-dot" />
                  )}
                </span>
                <span>{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
