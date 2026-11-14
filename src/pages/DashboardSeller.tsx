import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCheck,
  Eye,
  Inbox,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import ListingForm from '../components/ListingForm';
import EmptyState from '../components/EmptyState';
import SafeImage from '../components/SafeImage';
import type { Listing } from '../types';
import { formatDate, formatRupiah, formatRupiahShort, formatSpecs } from '../lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '../lib/marketplace';
import { store, useAppState, useMyListings } from '../lib/store';
import { useAuth } from '../lib/auth';

export default function DashboardSeller() {
  const myListings = useMyListings();
  const { favorites, inquiries, unreadInquiriesCount, seller, platformOrders, uid } = useAppState();
  const { user } = useAuth();
  const [editing, setEditing] = useState<Listing | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (listing: Listing) => {
    setEditing(listing);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const totalValue = myListings.reduce((sum, listing) => sum + listing.price, 0);
  const favoritedCount = myListings.filter((listing) => favorites.includes(listing.id)).length;
  const sellerOrders = platformOrders.filter(
    (order) => Boolean(uid) && order.items.some((item) => item.ownerId === uid),
  );

  const stats = [
    { icon: Building2, label: 'Listing Anda', value: String(myListings.length) },
    { icon: TrendingUp, label: 'Total nilai', value: formatRupiahShort(totalValue) },
    { icon: Eye, label: 'Disimpan pembeli', value: String(favoritedCount) },
    {
      icon: Inbox,
      label: 'Pesan masuk',
      value: unreadInquiriesCount > 0 ? `${inquiries.length} (${unreadInquiriesCount} baru)` : String(inquiries.length),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard Penjual</h1>
          <p className="mt-1 text-sm text-slate-500">
            {seller?.businessName ? `${seller.businessName} — ` : ''}
            Kelola iklan properti dan pesan dari calon pembeli{user ? `, ${user.displayName}` : ''}.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Hapus semua iklan, favorit, dan pesan milik akun ini? Tindakan ini tidak bisa dibatalkan.')) {
                store.resetAccountData();
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Kosongkan data
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" />
            Pasang Listing
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <stat.icon className="mb-3 h-5 w-5 text-emerald-900" />
            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="mb-8">
          <ListingForm initial={editing ?? undefined} onDone={closeForm} />
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Listing Anda</h2>

        {myListings.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Belum ada listing"
            description="Pasang listing pertama Anda agar muncul di marketplace."
            action={
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
              >
                <Plus className="h-4 w-4" />
                Pasang Listing
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {myListings.map((listing) => (
              <article
                key={listing.id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <SafeImage
                  src={listing.imageUrl}
                  alt={listing.title}
                  category={listing.category}
                  seed={listing.id}
                  className="h-32 w-full shrink-0 rounded-lg object-cover sm:h-20 sm:w-28"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {listing.category}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {listing.purpose}
                    </span>
                  </div>
                  <h3 className="mt-1.5 truncate font-semibold text-slate-900">{listing.title}</h3>
                  <p className="text-sm text-slate-500">
                    {listing.location}
                    {listing.city ? `, ${listing.city}` : ''} · {formatSpecs(listing)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Dipasang {formatDate(listing.createdAt)}</p>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="font-bold text-emerald-900">{formatRupiah(listing.price)}</p>
                  <div className="flex gap-2">
                    <Link
                      to={`/properti/${listing.id}`}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-900"
                      aria-label={`Lihat ${listing.title}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(listing)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-emerald-900"
                      aria-label={`Ubah ${listing.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Hapus listing "${listing.title}"?`)) store.removeListing(listing.id);
                      }}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus ${listing.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Pesanan Masuk</h2>

        {sellerOrders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Belum ada pesanan"
            description="Pesanan yang memuat produk Anda akan muncul di sini."
          />
        ) : (
          <div className="space-y-3">
            {sellerOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/pesanan/${order.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-emerald-900"
                      >
                        {order.code}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.buyerName} · {order.items.length} produk · {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Kirim ke {order.recipient}, {order.city}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-900">{formatRupiah(order.total)}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <p className="text-[11px] text-slate-400">
                    {order.status === 'belum-dibayar' && 'Menunggu pembayaran pembeli.'}
                    {order.status === 'dikemas' && 'Siap dikirim setelah pembayaran diterima.'}
                    {order.status === 'dikirim' && 'Menunggu konfirmasi penerimaan dari pembeli.'}
                    {order.status === 'selesai' && 'Pesanan selesai.'}
                    {order.status === 'dibatalkan' && 'Pesanan dibatalkan.'}
                  </p>
                  {order.status === 'dikemas' && (
                    <button
                      type="button"
                      onClick={() => store.updateOrderStatus(order.id, 'dikirim')}
                      className="rounded-lg bg-emerald-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800"
                    >
                      Kirim Pesanan
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="pesan">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">Pesan Masuk</h2>
            {unreadInquiriesCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 animate-pulse">
                {unreadInquiriesCount} belum dibaca
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => store.simulateIncomingInquiry()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-900"
              title="Simulasikan pesan untuk mencoba notifikasi"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Simulasi Pesan Masuk
            </button>
            {unreadInquiriesCount > 0 && (
              <button
                type="button"
                onClick={() => store.markAllInquiriesAsRead()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/20 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai semua dibaca
              </button>
            )}
          </div>
        </div>

        {inquiries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Belum ada pesan"
            description="Permintaan survei dari calon pembeli akan muncul di sini. Anda juga dapat mencoba tombol Simulasi Pesan Masuk di atas."
          />
        ) : (
          <div className="space-y-3">
            {inquiries.map((inquiry) => (
              <article
                key={inquiry.id}
                className={`rounded-xl border p-4 shadow-sm transition ${
                  !inquiry.read ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{inquiry.name}</p>
                      {!inquiry.read && (
                        <span className="rounded-full bg-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Baru
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{inquiry.phone}</p>
                    <p className="mt-2 text-sm text-slate-700">{inquiry.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Tentang{' '}
                      <Link to={`/properti/${inquiry.listingId}`} className="font-medium text-emerald-900 underline">
                        {inquiry.listingTitle}
                      </Link>{' '}
                      · {formatDate(inquiry.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!inquiry.read && (
                      <button
                        type="button"
                        onClick={() => store.markInquiryAsRead(inquiry.id)}
                        className="rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-emerald-900"
                        title="Tandai sudah dibaca"
                        aria-label="Tandai sudah dibaca"
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => store.removeInquiry(inquiry.id)}
                      className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Hapus pesan"
                      title="Hapus pesan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
