import { Link } from 'react-router-dom';
import { Armchair, Building2, Home, Map } from 'lucide-react';
import { useAppState } from '../lib/store';

const ICONS: Record<string, typeof Home> = {
  Rumah: Home,
  Apartemen: Building2,
  Tanah: Map,
  Furniture: Armchair,
};

interface Props {
  compact?: boolean;
}

export default function CategorySection({ compact }: Props) {
  const { listings, categories } = useAppState();

  return (
    <section className={compact ? '' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'}>
      {!compact && (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Jelajahi Kategori</h2>
            <p className="mt-0.5 text-xs text-slate-500">Pilih kategori untuk melihat produk yang tersedia.</p>
          </div>
          <Link to="/kategori" className="text-xs font-semibold text-brand-dark hover:underline">
            Lihat semua
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {categories.map((category) => {
          const Icon = ICONS[category.name] ?? Home;
          const count = listings.filter((listing) => listing.category === category.name).length;
          return (
            <Link
              key={category.name}
              to={`/properti?kategori=${encodeURIComponent(category.name)}`}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md sm:flex-col sm:justify-center sm:p-4 sm:text-center"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{category.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{count} produk</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
