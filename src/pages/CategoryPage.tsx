import { Link } from 'react-router-dom';
import {
  Armchair,
  ArrowRight,
  Building2,
  Flame,
  Home,
  LandPlot,
  Store,
  TicketPercent,
  Truck,
} from 'lucide-react';
import { useAppState } from '../lib/store';

const ICONS: Record<string, typeof Home> = {
  Rumah: Home,
  Apartemen: Building2,
  Tanah: LandPlot,
  Furniture: Armchair,
};

export default function CategoryPage() {
  const { categories, listings, stores } = useAppState();

  const countByCategory = new Map<string, number>();
  for (const listing of listings) {
    countByCategory.set(listing.category, (countByCategory.get(listing.category) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Kategori</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          Temukan properti dan kebutuhan rumah sesuai kategori pilihan Anda.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {categories.map((category) => {
          const Icon = ICONS[category.name] ?? Home;
          const count = countByCategory.get(category.name) ?? 0;
          return (
            <Link
              key={category.name}
              to={`/properti?kategori=${encodeURIComponent(category.name)}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
                <Icon className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-bold text-slate-900">{category.label}</p>
              <p className="text-[11px] text-slate-500">{count} produk tersedia</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark">
                Jelajahi
                <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link
          to="/flash-sale"
          className="group relative overflow-hidden rounded-2xl brand-gradient p-4 text-white transition hover:-translate-y-0.5"
        >
          <Flame className="h-6 w-6" />
          <p className="mt-2 text-sm font-bold">Flash Sale</p>
          <p className="text-[11px] text-white/80">Harga kilat, stok terbatas</p>
          <ArrowRight className="absolute right-4 top-4 h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/voucher"
          className="group relative overflow-hidden rounded-2xl border border-dashed border-brand-soft-2 bg-brand-soft/60 p-4 text-brand-dark transition hover:-translate-y-0.5"
        >
          <TicketPercent className="h-6 w-6" />
          <p className="mt-2 text-sm font-bold">Pusat Voucher</p>
          <p className="text-[11px] text-slate-500">Diskon, ongkir, dan cashback</p>
          <ArrowRight className="absolute right-4 top-4 h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/properti?tujuan=Disewa"
          className="group relative overflow-hidden rounded-2xl navy-gradient p-4 text-white transition hover:-translate-y-0.5"
        >
          <Truck className="h-6 w-6" />
          <p className="mt-2 text-sm font-bold">Properti Disewa</p>
          <p className="text-[11px] text-white/75">Sewa rumah &amp; apartemen</p>
          <ArrowRight className="absolute right-4 top-4 h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold text-slate-900">Toko Pilihan</h2>
          <Link to="/properti" className="text-xs font-semibold text-brand-dark hover:underline">
            Lihat semua produk
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stores.slice(0, 6).map((store) => (
            <Link
              key={`${store.ownerId}-${store.name}`}
              to={`/properti?q=${encodeURIComponent(store.name)}`}
              className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:border-brand hover:shadow-md"
            >
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
              <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-800">{store.name}</p>
              <p className="text-[10px] text-slate-500">{store.city || 'Indonesia'}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-brand-dark">
                <Store className="h-3 w-3" />
                {store.listingCount} produk
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
