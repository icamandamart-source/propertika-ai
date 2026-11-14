import { Link } from 'react-router-dom';
import { ArrowRight, Flame, TicketPercent, Truck, Zap } from 'lucide-react';
import Countdown from '../components/Countdown';
import EmptyState from '../components/EmptyState';
import ProductCard from '../components/ProductCard';
import { discountPercent } from '../lib/marketplace';
import { useAppState } from '../lib/store';

export default function FlashSalePage() {
  const { listings } = useAppState();
  const flash = listings
    .filter((listing) => listing.flashSale && typeof listing.flashPrice === 'number' && listing.flashPrice > 0)
    .sort((a, b) => discountPercent(b) - discountPercent(a));

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl brand-gradient p-5 text-white sm:p-7">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest">
              <Flame className="h-3.5 w-3.5" />
              Flash Sale Hari Ini
            </span>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Harga spesial, stok terbatas</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/85">
              Diskon kilat untuk properti dan perabot pilihan. Selama stok masih ada dan waktu belum habis.
            </p>
          </div>
          <div className="rounded-xl bg-black/20 px-3 py-2 backdrop-blur">
            <Countdown tone="dark" label="Berakhir dalam" />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
          <Zap className="h-3.5 w-3.5 text-brand" />
          {flash.length} produk flash sale
        </span>
        <Link
          to="/voucher"
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:text-brand-dark"
        >
          <TicketPercent className="h-3.5 w-3.5 text-brand" />
          Klaim voucher tambahan
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
          <Truck className="h-3.5 w-3.5 text-brand" />
          Gratis ongkir min. Rp5 jt
        </span>
      </div>

      {flash.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Flame}
            title="Belum ada flash sale aktif"
            description="Promo kilat baru akan muncul di sini. Sementara itu, jelajahi produk pilihan lainnya."
            action={
              <Link
                to="/properti"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Lihat semua produk
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {flash.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold text-slate-900">Cara kerja flash sale</h2>
        <div className="mt-2 grid gap-2 text-[11px] leading-5 text-slate-500 sm:grid-cols-3">
          <p>1. Harga flash sale otomatis dipakai saat produk masuk keranjang dan checkout.</p>
          <p>2. Stok flash sale terpisah; jika habis, harga kembali normal atau produk ditandai habis.</p>
          <p>3. Pesanan yang sudah dibuat mengikuti harga saat checkout, termasuk jika promo berakhir.</p>
        </div>
      </div>
    </div>
  );
}
