import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageSquare,
  PackageCheck,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import SafeImage from '../components/SafeImage';
import { formatDate, formatRupiah } from '../lib/format';
import { firestoreEnabled } from '../lib/firestore';
import { ORDER_STATUS_LABELS, ORDER_STATUS_PROGRESS, ORDER_STATUS_TONE } from '../lib/marketplace';
import { startOrderPayment } from '../lib/payments-api';
import { store, useAppState } from '../lib/store';

const STEPS = [
  { label: 'Pesanan dibuat', threshold: 1 },
  { label: 'Dikemas', threshold: 2 },
  { label: 'Dikirim', threshold: 3 },
  { label: 'Selesai', threshold: 4 },
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { orders, platformOrders, uid, reviews } = useAppState();
  const order = orders.find((item) => item.id === id) ?? platformOrders.find((item) => item.id === id);

  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <EmptyState
          icon={PackageCheck}
          title="Pesanan tidak ditemukan"
          description="Pesanan ini mungkin milik akun lain atau sudah tidak tersedia di perangkat ini."
          action={
            <Link
              to="/pesanan"
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Kembali ke pesanan
            </Link>
          }
        />
      </div>
    );
  }

  const progress = ORDER_STATUS_PROGRESS[order.status];
  const canceled = order.status === 'dibatalkan';
  const isBuyer = uid ? order.buyerUid === uid : order.buyerUid === 'guest';
  const isSeller = Boolean(uid && order.items.some((item) => item.ownerId === uid));

  const startPayment = async () => {
    if (paying) return;
    // Tanpa Firestore atau untuk COD, pembayaran diselesaikan lokal seperti sebelumnya.
    if (!firestoreEnabled || order.paymentMethodId === 'cod') {
      store.payOrder(order.id);
      return;
    }
    setPaying(true);
    const result = await startOrderPayment(order.id);
    setPaying(false);
    if (!result.ok) {
      store.showToast(result.error, 'error');
      return;
    }
    window.location.assign(result.redirectUrl);
  };

  const submitReview = async (listingId: string) => {
    const saved = await store.addReview(
      order.id,
      listingId,
      rating,
      comment.trim() || 'Produk sesuai deskripsi, pengiriman aman.',
    );
    if (!saved) return;
    setReviewed((current) => [...current, listingId]);
    setReviewing(null);
    setRating(5);
    setComment('');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 lg:px-8">
      <Link
        to={isSeller && !isBuyer ? '/dashboard-seller' : '/pesanan'}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-dark"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isSeller && !isBuyer ? 'Kembali ke dashboard penjual' : 'Semua pesanan'}
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{order.code}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Dibuat {formatDate(order.createdAt)}
              {order.paidAt ? ` · Dibayar ${formatDate(order.paidAt)}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Total bayar</p>
            <p className="text-xl font-black text-brand">{formatRupiah(order.total)}</p>
            <p className="text-[10px] text-slate-400">{order.paymentMethod}</p>
          </div>
        </div>

        {canceled ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            Pesanan ini dibatalkan. Stok produk sudah dikembalikan ke penjual.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-4 gap-1">
            {STEPS.map((step) => {
              const done = progress >= step.threshold;
              return (
                <div key={step.label} className="text-center">
                  <div
                    className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                      done ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-300'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </div>
                  <p className={`mt-1.5 text-[10px] font-medium ${done ? 'text-slate-800' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Produk Pesanan</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {order.items.map((item) => {
                const key = `${item.listingId}-${item.variation ?? ''}`;
                const isReviewed =
                  reviewed.includes(item.listingId) ||
                  reviews.some(
                    (review) =>
                      review.orderId === order.id &&
                      review.listingId === item.listingId &&
                      (!uid || review.authorUid === uid),
                  );
                return (
                  <div key={key} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex gap-3">
                      <Link
                        to={`/properti/${item.listingId}`}
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
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
                          className="line-clamp-2 text-xs font-medium leading-5 text-slate-800 hover:text-brand-dark"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {item.qty} × {formatRupiah(item.price)}
                          {item.variation ? ` · ${item.variation}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.ownerName}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-slate-800">
                        {formatRupiah(item.price * item.qty)}
                      </span>
                    </div>

                    {order.status === 'selesai' && (
                      <div className="mt-2 pl-[76px]">
                        {isReviewed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ulasan terkirim
                          </span>
                        ) : reviewing === item.listingId ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setRating(value)}
                                  aria-label={`Beri ${value} bintang`}
                                  className="p-0.5"
                                >
                                  <Star
                                    className={`h-5 w-5 ${
                                      value <= rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                                    }`}
                                  />
                                </button>
                              ))}
                              <span className="ml-1 text-xs font-semibold text-slate-600">{rating}/5</span>
                            </div>
                            <textarea
                              value={comment}
                              onChange={(event) => setComment(event.target.value)}
                              rows={2}
                              placeholder="Bagaimana kualitas produk dan pengirimannya?"
                              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => submitReview(item.listingId)}
                                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                              >
                                Kirim ulasan
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewing(null)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewing(item.listingId);
                              setRating(5);
                              setComment('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-brand px-2.5 py-1.5 text-[11px] font-semibold text-brand-dark transition hover:bg-brand-soft"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Beri ulasan
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Informasi Pengiriman</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  Alamat
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-800">
                  {order.recipient} · {order.phone}
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  {order.address}, {order.city}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Truck className="h-3.5 w-3.5 text-brand" />
                  Pengiriman
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{order.shippingMethod}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {order.shipping === 0 ? 'Gratis ongkir' : formatRupiah(order.shipping)}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <CreditCard className="h-3.5 w-3.5 text-brand" />
                  Pembayaran
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{order.paymentMethod}</p>
                {order.paymentStatus && (
                  <p
                    className={`mt-0.5 text-[11px] font-medium ${
                      order.paymentStatus === 'paid'
                        ? 'text-emerald-600'
                        : order.paymentStatus === 'failed'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {order.paymentStatus === 'paid'
                      ? 'Pembayaran lunas'
                      : order.paymentStatus === 'failed'
                        ? 'Pembayaran gagal, silakan coba lagi'
                        : 'Menunggu pembayaran'}
                  </p>
                )}
              </div>
            </div>
            {order.note && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Catatan: {order.note}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Rincian Pembayaran</h2>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-medium text-slate-800">{formatRupiah(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Diskon {order.voucherCode}</dt>
                  <dd className="font-medium text-green-600">-{formatRupiah(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Ongkir</dt>
                <dd className="font-medium text-slate-800">
                  {order.shipping === 0 ? 'Gratis' : formatRupiah(order.shipping)}
                </dd>
              </div>
              {order.cashback > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Cashback</dt>
                  <dd className="font-medium text-brand-dark">{formatRupiah(order.cashback)}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-base font-black text-brand">{formatRupiah(order.total)}</span>
            </div>

            <div className="mt-3 space-y-2">
              {isBuyer && order.status === 'belum-dibayar' && (
                <button
                  type="button"
                  onClick={() => void startPayment()}
                  disabled={paying}
                  className="w-full rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paying
                    ? 'Mengarahkan ke pembayaran...'
                    : order.paymentMethodId === 'cod'
                      ? 'Konfirmasi Pesanan (COD)'
                      : 'Bayar Sekarang'}
                </button>
              )}
              {isBuyer && order.status === 'dikirim' && (
                <button
                  type="button"
                  onClick={() => store.confirmOrderReceived(order.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  <PackageCheck className="h-4 w-4" />
                  Pesanan Diterima
                </button>
              )}
              {isSeller && order.status === 'dikemas' && (
                <button
                  type="button"
                  onClick={() => store.updateOrderStatus(order.id, 'dikirim')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  <Truck className="h-4 w-4" />
                  Kirim Pesanan
                </button>
              )}
              {isBuyer && (order.status === 'belum-dibayar' || order.status === 'dikemas') && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Batalkan pesanan ini? Stok akan dikembalikan.')) {
                      store.cancelOrder(order.id);
                    }
                  }}
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                >
                  Batalkan pesanan
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] leading-5 text-slate-500">
            Butuh bantuan? Hubungi penjual lewat halaman produk atau gunakan pusat bantuan Propertika.
          </div>
        </aside>
      </div>
    </div>
  );
}
