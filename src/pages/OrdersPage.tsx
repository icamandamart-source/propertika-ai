import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck, ReceiptText, ShoppingBag, Truck } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import SafeImage from '../components/SafeImage';
import { formatDate, formatRupiah } from '../lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_PROGRESS, ORDER_STATUS_TONE } from '../lib/marketplace';
import { store, useAppState } from '../lib/store';
import type { Order, OrderStatus } from '../types';

const TABS: { label: string; value: 'semua' | OrderStatus }[] = [
  { label: 'Semua', value: 'semua' },
  { label: 'Belum Dibayar', value: 'belum-dibayar' },
  { label: 'Dikemas', value: 'dikemas' },
  { label: 'Dikirim', value: 'dikirim' },
  { label: 'Selesai', value: 'selesai' },
  { label: 'Dibatalkan', value: 'dibatalkan' },
];

export default function OrdersPage() {
  const { orders, isSignedIn } = useAppState();
  const [tab, setTab] = useState<'semua' | OrderStatus>('semua');

  const filtered = tab === 'semua' ? orders : orders.filter((order) => order.status === tab);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Pesanan Saya</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {isSignedIn ? 'Semua pesanan akun ini.' : 'Pesanan tamu yang tersimpan di perangkat ini.'}
          </p>
        </div>
        <Link to="/properti" className="text-xs font-semibold text-brand-dark hover:underline">
          Belanja lagi
        </Link>
      </div>

      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === item.value ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-soft'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={tab === 'semua' ? 'Belum ada pesanan' : 'Tidak ada pesanan di status ini'}
          description="Setelah checkout, pesanan Anda akan muncul di sini dan bisa dilacak statusnya."
          action={
            <Link
              to="/properti"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Jelajahi produk
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const progress = ORDER_STATUS_PROGRESS[order.status];
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
            <span className="text-[11px] text-slate-400">{formatDate(order.createdAt)}</span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-slate-800">{order.code}</p>
        </div>
        <Link
          to={`/pesanan/${order.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
        >
          Lihat detail
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {order.status !== 'dibatalkan' && (
        <div className="flex items-center gap-1 px-3 pt-2">
          {['Dibuat', 'Dibayar', 'Dikemas', 'Dikirim', 'Selesai'].map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-1">
              <span
                className={`h-1.5 flex-1 rounded-full ${index + 1 <= progress ? 'bg-brand' : 'bg-slate-200'}`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {order.items.map((item) => (
          <div key={`${item.listingId}-${item.variation ?? ''}`} className="flex gap-3 p-3">
            <Link
              to={`/properti/${item.listingId}`}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              <SafeImage
                src={item.imageUrl}
                alt={item.title}
                category={item.category}
                seed={item.listingId}
                className="h-full w-full object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to={`/properti/${item.listingId}`}
                className="line-clamp-1 text-xs font-medium text-slate-800 hover:text-brand-dark"
              >
                {item.title}
              </Link>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {item.qty} × {formatRupiah(item.price)}
                {item.variation ? ` · ${item.variation}` : ''}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">{item.ownerName}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-800">
              {formatRupiah(item.price * item.qty)}
            </span>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="min-w-0 text-[11px] text-slate-500">
          <p className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-brand" />
            {order.shippingMethod} · {order.paymentMethod}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5 text-slate-400" />
            {order.items.length} produk · {order.recipient}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Total bayar</p>
            <p className="text-sm font-black text-brand">{formatRupiah(order.total)}</p>
          </div>
          {order.status === 'belum-dibayar' && (
            <>
              <button
                type="button"
                onClick={() => store.payOrder(order.id)}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
              >
                Bayar Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Batalkan pesanan ini?')) store.cancelOrder(order.id);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-white"
              >
                Batalkan
              </button>
            </>
          )}
          {order.status === 'dikirim' && (
            <button
              type="button"
              onClick={() => store.confirmOrderReceived(order.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Pesanan Diterima
            </button>
          )}
          {order.status === 'dikemas' && (
            <Link
              to={`/pesanan/${order.id}`}
              className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand-dark transition hover:bg-brand-soft"
            >
              Pantau pesanan
            </Link>
          )}
        </div>
      </footer>
    </article>
  );
}
