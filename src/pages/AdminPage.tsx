import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Cloud,
  Eye,
  EyeOff,
  Megaphone,
  Package,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  TicketPercent,
  Trash2,
} from 'lucide-react';
import SafeImage from '../components/SafeImage';
import { SEED_BANNERS, SEED_VOUCHERS } from '../data/promos';
import { firestoreEnabled } from '../lib/firestore';
import { formatDate, formatRupiah } from '../lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, isVoucherExpired, stockOf } from '../lib/marketplace';
import { newId, store, useAppState } from '../lib/store';
import {
  LISTING_CATEGORIES,
  ORDER_STATUSES,
  type Banner,
  type Listing,
  type OrderStatus,
  type Voucher,
  type VoucherType,
} from '../types';

const SEED_VOUCHER_CODES = new Set(SEED_VOUCHERS.map((voucher) => voucher.code));
const SEED_BANNER_IDS = new Set(SEED_BANNERS.map((banner) => banner.id));

type Tab = 'produk' | 'pesanan' | 'voucher' | 'banner' | 'kategori';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

export default function AdminPage() {
  const { listings, platformOrders, vouchers, banners, categories } = useAppState();
  const [tab, setTab] = useState<Tab>('produk');
  const [query, setQuery] = useState('');

  const visibleCategories = new Map(categories.map((category) => [category.name, category.label]));
  const pendingOrders = platformOrders.filter((order) => order.status === 'belum-dibayar').length;
  const filteredListings = listings.filter((listing) =>
    `${listing.title} ${listing.category} ${listing.storeName ?? ''} ${listing.ownerName}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Dashboard Admin</h1>
              <p className="text-[11px] text-slate-500">
                Kelola katalog, promo, dan pesanan{firestoreEnabled ? '' : ' di peramban ini'}.
              </p>
            </div>
          </div>
          {firestoreEnabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700">
              <Cloud className="h-3.5 w-3.5" />
              Firestore aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Mode demo lokal
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Produk', value: listings.length },
            { label: 'Pesanan baru', value: pendingOrders },
            { label: 'Voucher', value: vouchers.length },
            { label: 'Banner', value: banners.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-lg font-bold text-slate-900">{stat.value}</p>
              <p className="text-[10px] text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {[
          { id: 'produk', label: 'Produk', icon: Package },
          { id: 'pesanan', label: 'Pesanan', icon: ArrowRight },
          { id: 'voucher', label: 'Voucher', icon: TicketPercent },
          { id: 'banner', label: 'Banner', icon: Megaphone },
          { id: 'kategori', label: 'Kategori', icon: Settings2 },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as Tab)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === item.id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-soft'
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === 'produk' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Katalog Produk</h2>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Kembalikan semua harga, stok, dan rating ke data awal?')) {
                    store.adminResetOverrides();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset perubahan
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari produk, toko, atau kategori…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="mt-3 space-y-2">
              {filteredListings.map((listing) => (
                <ProductRow key={listing.id} listing={listing} />
              ))}
              {filteredListings.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  Tidak ada produk yang cocok.
                </p>
              )}
            </div>
          </section>
        )}

        {tab === 'pesanan' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Semua Pesanan</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Ubah status untuk mensimulasikan proses gudang, pengiriman, dan penyelesaian.
            </p>

            <div className="mt-3 space-y-2">
              {platformOrders.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                  Belum ada pesanan.
                </p>
              )}
              {platformOrders.map((order) => (
                <div key={order.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/pesanan/${order.id}`}
                          className="text-xs font-semibold text-slate-800 hover:text-brand-dark"
                        >
                          {order.code}
                        </Link>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ORDER_STATUS_TONE[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {order.buyerName} · {order.recipient} · {order.items.length} produk ·{' '}
                        {formatDate(order.createdAt)}
                      </p>
                      <p className="text-[11px] font-semibold text-brand">{formatRupiah(order.total)}</p>
                    </div>
                    <select
                      value={order.status}
                      onChange={(event) => {
                        const status = event.target.value as OrderStatus;
                        if (status === 'dibatalkan') store.cancelOrder(order.id);
                        else store.updateOrderStatus(order.id, status);
                      }}
                      aria-label={`Status ${order.code}`}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 outline-none"
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ORDER_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'voucher' && (
          <VoucherTab vouchers={vouchers} />
        )}

        {tab === 'banner' && (
          <BannerTab banners={banners} />
        )}

        {tab === 'kategori' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Kategori</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Ubah nama tampilan kategori atau sembunyikan dari navigasi dan filter.
            </p>
            <div className="mt-3 space-y-2">
              {LISTING_CATEGORIES.map((name) => (
                <CategoryRow
                  key={name}
                  name={name}
                  label={visibleCategories.get(name) ?? ''}
                  visible={visibleCategories.has(name)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProductRow({ listing }: { listing: Listing }) {
  const [price, setPrice] = useState(listing.price);
  const [stock, setStock] = useState(stockOf(listing));
  const [flash, setFlash] = useState(Boolean(listing.flashSale));
  const [flashPrice, setFlashPrice] = useState(
    listing.flashPrice ?? Math.max(0, Math.round(listing.price * 0.8)),
  );
  const [flashStock, setFlashStock] = useState(listing.flashStock ?? stockOf(listing));

  const save = () => {
    store.adminUpdateListing(listing.id, {
      price: Math.max(0, Math.round(Number(price) || 0)),
      stock: Math.max(0, Math.round(Number(stock) || 0)),
      flashSale: flash,
      flashPrice: flash ? Math.max(0, Math.round(Number(flashPrice) || 0)) : undefined,
      flashStock: flash ? Math.max(0, Math.round(Number(flashStock) || 0)) : undefined,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <SafeImage
            src={listing.imageUrl}
            alt={listing.title}
            category={listing.category}
            seed={listing.id}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to={`/properti/${listing.id}`}
            className="line-clamp-1 text-xs font-semibold text-slate-800 hover:text-brand-dark"
          >
            {listing.title}
          </Link>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {listing.category} · {listing.storeName || listing.ownerName} · {listing.city}
          </p>
          <p className="text-[10px] text-slate-400">
            Rating {listing.rating?.toFixed(1) ?? '-'} · {listing.sold ?? 0} terjual
          </p>
        </div>
        <Link
          to={`/properti/${listing.id}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-dark hover:underline"
        >
          Lihat
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-slate-500">Harga (Rp)</span>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-medium text-slate-500">Stok</span>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(event) => setStock(Number(event.target.value))}
            className={inputClass}
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={flash}
            onChange={(event) => setFlash(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Flash sale
        </label>
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
        >
          <Save className="h-3.5 w-3.5" />
          Simpan
        </button>
      </div>

      {flash && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-brand-soft/50 p-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-brand-dark">Harga flash (Rp)</span>
            <input
              type="number"
              min={0}
              value={flashPrice}
              onChange={(event) => setFlashPrice(Number(event.target.value))}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium text-brand-dark">Stok flash</span>
            <input
              type="number"
              min={0}
              value={flashStock}
              onChange={(event) => setFlashStock(Number(event.target.value))}
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function VoucherTab({ vouchers }: { vouchers: Voucher[] }) {
  const [form, setForm] = useState({
    code: '',
    title: '',
    type: 'diskon' as VoucherType,
    amount: '',
    percent: '',
    maxDiscount: '',
    minSpend: '',
    expiry: '2026-12-31',
    description: '',
    storeName: '',
    color: 'brand' as NonNullable<Voucher['color']>,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!code || !form.title.trim()) {
      store.showToast('Kode dan judul voucher wajib diisi.', 'error');
      return;
    }
    const voucher: Voucher = {
      id: `voucher-${code.toLowerCase()}`,
      code,
      title: form.title.trim(),
      type: form.type,
      amount: Math.max(0, Number(form.amount) || 0),
      percent: form.percent ? Math.min(100, Math.max(0, Number(form.percent))) : undefined,
      maxDiscount: form.maxDiscount ? Math.max(0, Number(form.maxDiscount)) : undefined,
      minSpend: Math.max(0, Number(form.minSpend) || 0),
      description: form.description.trim() || 'Voucher promo Propertika.',
      expiry: form.expiry || '2026-12-31',
      storeName: form.storeName.trim() || undefined,
      color: form.color,
    };
    store.adminAddVoucher(voucher);
    setForm({ ...form, code: '', title: '', amount: '', percent: '', maxDiscount: '', minSpend: '', description: '' });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">Voucher</h2>
      <p className="mt-1 text-[11px] text-slate-500">Voucher bawaan tidak bisa dihapus, tetapi bisa ditimpa kodenya.</p>

      <form onSubmit={submit} className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-3">
        <input
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
          placeholder="KODE"
          aria-label="Kode voucher"
          className={`${inputClass} font-semibold uppercase`}
        />
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Judul voucher"
          aria-label="Judul voucher"
          className={`${inputClass} sm:col-span-2`}
        />
        <select
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value as VoucherType })}
          aria-label="Tipe voucher"
          className={inputClass}
        >
          <option value="diskon">Diskon</option>
          <option value="ongkir">Ongkir</option>
          <option value="cashback">Cashback</option>
        </select>
        <input
          type="number"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          placeholder="Nominal (Rp)"
          aria-label="Nominal"
          className={inputClass}
        />
        <input
          type="number"
          value={form.percent}
          onChange={(event) => setForm({ ...form, percent: event.target.value })}
          placeholder="Persen (%)"
          aria-label="Persen"
          className={inputClass}
        />
        <input
          type="number"
          value={form.minSpend}
          onChange={(event) => setForm({ ...form, minSpend: event.target.value })}
          placeholder="Min. belanja"
          aria-label="Minimal belanja"
          className={inputClass}
        />
        <input
          type="number"
          value={form.maxDiscount}
          onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
          placeholder="Maks. diskon"
          aria-label="Maksimal diskon"
          className={inputClass}
        />
        <input
          type="date"
          value={form.expiry}
          onChange={(event) => setForm({ ...form, expiry: event.target.value })}
          aria-label="Tanggal kedaluwarsa"
          className={inputClass}
        />
        <input
          value={form.storeName}
          onChange={(event) => setForm({ ...form, storeName: event.target.value })}
          placeholder="Toko (opsional)"
          aria-label="Nama toko"
          className={inputClass}
        />
        <select
          value={form.color}
          onChange={(event) => setForm({ ...form, color: event.target.value as NonNullable<Voucher['color']> })}
          aria-label="Warna voucher"
          className={inputClass}
        >
          <option value="brand">Oranye</option>
          <option value="navy">Navy</option>
          <option value="amber">Amber</option>
          <option value="rose">Rose</option>
        </select>
        <input
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="Deskripsi singkat"
          aria-label="Deskripsi voucher"
          className={`${inputClass} sm:col-span-2`}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah voucher
        </button>
      </form>

      <div className="mt-3 space-y-2">
        {vouchers.map((voucher) => {
          const builtIn = SEED_VOUCHER_CODES.has(voucher.code);
          const expired = isVoucherExpired(voucher);
          return (
            <div key={voucher.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                    {voucher.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{voucher.title}</span>
                  {builtIn && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                      Bawaan
                    </span>
                  )}
                  {expired && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-medium text-rose-600">
                      Berakhir
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {voucher.type} · min {formatRupiah(voucher.minSpend)} · s/d {formatDate(`${voucher.expiry}T00:00:00.000Z`)}
                  {voucher.storeName ? ` · ${voucher.storeName}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={builtIn}
                onClick={() => store.adminRemoveVoucher(voucher.id)}
                title={builtIn ? 'Voucher bawaan tidak bisa dihapus' : 'Hapus voucher'}
                className="rounded-lg border border-rose-200 p-1.5 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BannerTab({ banners }: { banners: Banner[] }) {
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    cta: 'Lihat promo',
    to: '/properti',
    badge: '',
    tone: 'brand' as NonNullable<Banner['tone']>,
    imageUrl: '',
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      store.showToast('Judul banner wajib diisi.', 'error');
      return;
    }
    store.adminAddBanner({
      id: newId('banner'),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      cta: form.cta.trim() || 'Lihat',
      to: form.to.trim() || '/properti',
      badge: form.badge.trim() || undefined,
      tone: form.tone,
    });
    setForm({ ...form, title: '', subtitle: '', badge: '', imageUrl: '' });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">Banner Promosi</h2>
      <p className="mt-1 text-[11px] text-slate-500">Banner baru tampil di carousel beranda bersama banner bawaan.</p>

      <form onSubmit={submit} className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-2">
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Judul banner"
          aria-label="Judul banner"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          value={form.subtitle}
          onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
          placeholder="Subjudul"
          aria-label="Subjudul banner"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          value={form.badge}
          onChange={(event) => setForm({ ...form, badge: event.target.value })}
          placeholder="Badge (opsional)"
          aria-label="Badge banner"
          className={inputClass}
        />
        <select
          value={form.tone}
          onChange={(event) => setForm({ ...form, tone: event.target.value as NonNullable<Banner['tone']> })}
          aria-label="Warna banner"
          className={inputClass}
        >
          <option value="brand">Oranye</option>
          <option value="navy">Navy</option>
          <option value="dark">Gelap</option>
          <option value="amber">Amber</option>
        </select>
        <input
          value={form.cta}
          onChange={(event) => setForm({ ...form, cta: event.target.value })}
          placeholder="Teks tombol"
          aria-label="Teks tombol"
          className={inputClass}
        />
        <input
          value={form.to}
          onChange={(event) => setForm({ ...form, to: event.target.value })}
          placeholder="/properti"
          aria-label="Tautan banner"
          className={inputClass}
        />
        <input
          value={form.imageUrl}
          onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
          placeholder="URL gambar (opsional)"
          aria-label="URL gambar banner"
          className={`${inputClass} sm:col-span-2`}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark sm:col-span-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah banner
        </button>
      </form>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {banners.map((banner) => {
          const builtIn = SEED_BANNER_IDS.has(banner.id);
          return (
            <div key={banner.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{banner.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{banner.subtitle}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {banner.cta} → {banner.to}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={builtIn}
                  onClick={() => store.adminRemoveBanner(banner.id)}
                  title={builtIn ? 'Banner bawaan tidak bisa dihapus' : 'Hapus banner'}
                  className="shrink-0 rounded-lg border border-rose-200 p-1.5 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CategoryRow({ name, label, visible }: { name: string; label: string; visible: boolean }) {
  const [value, setValue] = useState(label);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-800">
          {name}
          {!visible && <span className="ml-1.5 text-[10px] font-normal text-slate-400">(disembunyikan)</span>}
        </p>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={`Nama tampilan ${name}`}
          aria-label={`Nama tampilan ${name}`}
          className={`${inputClass} mt-1`}
        />
      </div>
      <button
        type="button"
        onClick={() => store.adminSetCategoryLabel(name, value)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-dark"
      >
        <Save className="h-3.5 w-3.5" />
        Simpan nama
      </button>
      <button
        type="button"
        onClick={() => store.adminToggleCategory(name)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {visible ? 'Sembunyikan' : 'Tampilkan'}
      </button>
    </div>
  );
}
