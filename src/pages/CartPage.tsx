import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShoppingBag, Store, TicketPercent, Trash2, Truck } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import QuantityStepper from '../components/QuantityStepper';
import SafeImage from '../components/SafeImage';
import { formatRupiah } from '../lib/format';
import {
  cartTotals,
  hydrateCart,
  originalPriceOf,
  stockOf,
  storeNameOf,
  voucherEligible,
  type CartLine,
} from '../lib/marketplace';
import { store, useAppState } from '../lib/store';

export default function CartPage() {
  const navigate = useNavigate();
  const { cart, listings, vouchers, claimedVoucherCodes } = useAppState();
  const lines = hydrateCart(cart, listings);

  const groups = new Map<string, CartLine[]>();
  for (const line of lines) {
    const key = storeNameOf(line.listing);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  }

  const { count, subtotal } = cartTotals(lines);
  const selectedCount = lines.filter((line) => line.selected).length;
  const allSelected = lines.length > 0 && lines.every((line) => line.selected);
  const savings = lines
    .filter((line) => line.selected)
    .reduce((sum, line) => {
      const original = originalPriceOf(line.listing) ?? line.unitPrice;
      return sum + Math.max(0, original - line.unitPrice) * line.qty;
    }, 0);
  const availableVouchers = vouchers.filter(
    (voucher) =>
      claimedVoucherCodes.includes(voucher.code) &&
      voucherEligible(voucher, subtotal) &&
      (!voucher.storeName || Array.from(groups.keys()).includes(voucher.storeName)),
  ).length;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingBag}
          title="Keranjang masih kosong"
          description="Yuk cari properti, furnitur, atau kebutuhan rumah lainnya. Produk yang Anda tambahkan akan muncul di sini."
          action={
            <Link
              to="/properti"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Mulai belanja
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Keranjang Belanja</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {lines.length} produk · {groups.size} toko
          </p>
        </div>
        <Link to="/properti" className="text-xs font-semibold text-brand-dark hover:underline">
          Lanjut belanja
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => store.toggleAllCart(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Pilih semua ({lines.length})
            </label>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                if (window.confirm(`Hapus ${selectedCount} produk terpilih dari keranjang?`)) {
                  store.removeSelectedCartItems();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus terpilih
            </button>
          </div>

          {Array.from(groups.entries()).map(([storeName, storeLines]) => {
            const storeSelected = storeLines.length > 0 && storeLines.every((line) => line.selected);
            return (
              <section key={storeName} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                  <label className="inline-flex min-w-0 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={storeSelected}
                      onChange={() => {
                        const shouldSelect = !storeSelected;
                        storeLines.forEach((line) => {
                          if (line.selected !== shouldSelect) store.toggleCartItem(line.id);
                        });
                      }}
                      className="h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <Store className="h-4 w-4 shrink-0 text-brand" />
                    <span className="truncate text-sm font-semibold text-slate-900">{storeName}</span>
                  </label>
                  <Link
                    to={`/properti?q=${encodeURIComponent(storeName)}`}
                    className="shrink-0 text-[11px] font-semibold text-brand-dark hover:underline"
                  >
                    Kunjungi toko
                  </Link>
                </header>

                <div className="divide-y divide-slate-100">
                  {storeLines.map((line) => {
                    const original = originalPriceOf(line.listing);
                    const stock = stockOf(line.listing);
                    return (
                      <div key={line.id} className="flex gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={line.selected}
                          onChange={() => store.toggleCartItem(line.id)}
                          aria-label={`Pilih ${line.listing.title}`}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                        />

                        <Link
                          to={`/properti/${line.listing.id}`}
                          className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:h-24 sm:w-24"
                        >
                          <SafeImage
                            src={line.listing.imageUrl}
                            alt={line.listing.title}
                            category={line.listing.category}
                            seed={line.listing.id}
                            className="h-full w-full object-cover"
                          />
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              to={`/properti/${line.listing.id}`}
                              className="line-clamp-2 text-sm font-medium leading-5 text-slate-800 hover:text-brand-dark"
                            >
                              {line.listing.title}
                            </Link>
                            <button
                              type="button"
                              onClick={() => store.removeCartItem(line.id)}
                              aria-label={`Hapus ${line.listing.title}`}
                              className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {line.variation && (
                            <p className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              Varian: {line.variation}
                            </p>
                          )}

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-brand">{formatRupiah(line.unitPrice)}</span>
                            {original && <span className="price-strike text-[11px]">{formatRupiah(original)}</span>}
                            {line.listing.freeShipping && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1 py-0.5 text-[9px] font-semibold text-green-700">
                                <Truck className="h-2.5 w-2.5" />
                                Gratis ongkir
                              </span>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400">
                              {stock > 0 ? `Stok ${stock}` : 'Stok habis'}
                            </span>
                            <QuantityStepper
                              value={line.qty}
                              onChange={(value) => store.updateCartQty(line.id, value)}
                              min={1}
                              max={Math.max(1, stock)}
                              compact
                              disabled={stock <= 0}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Ringkasan Belanja</h2>

            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Total harga ({count} barang)</dt>
                <dd className="font-semibold text-slate-800">{formatRupiah(subtotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Hemat diskon</dt>
                  <dd className="font-semibold text-green-600">-{formatRupiah(savings)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Ongkir</dt>
                <dd className="text-slate-500">Dihitung saat checkout</dd>
              </div>
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-medium text-slate-700">Subtotal</span>
              <span className="text-lg font-black text-brand">{formatRupiah(subtotal)}</span>
            </div>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => navigate('/checkout')}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Checkout ({count})
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-3 space-y-1.5 text-[11px] text-slate-500">
              <p className="flex items-center gap-1.5">
                <TicketPercent className="h-3.5 w-3.5 text-brand" />
                {availableVouchers > 0
                  ? `${availableVouchers} voucher bisa dipakai di keranjang ini`
                  : 'Klaim voucher dulu untuk potongan ekstra'}
              </p>
              <p className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-brand" />
                Gratis ongkir reguler untuk belanja min. Rp5.000.000
              </p>
            </div>
          </div>

          <Link
            to="/voucher"
            className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-brand-soft-2 bg-brand-soft/50 px-4 py-3 text-xs font-semibold text-brand-dark transition hover:bg-brand-soft"
          >
            <span className="inline-flex items-center gap-2">
              <TicketPercent className="h-4 w-4" />
              Pusat voucher
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
