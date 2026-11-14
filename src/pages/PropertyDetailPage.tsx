import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  Check,
  CheckCircle2,
  Heart,
  LandPlot,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Ruler,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  Zap,
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import ProductCard from '../components/ProductCard';
import ListingGallery from '../components/ListingGallery';
import QuantityStepper from '../components/QuantityStepper';
import RatingStars from '../components/RatingStars';
import Countdown from '../components/Countdown';
import { formatArea, formatDate, formatRupiah } from '../lib/format';
import { formatDistance, haversineKm, mapsEmbedUrl, mapsSearchUrl } from '../lib/geo';
import { newId, store, useAppState } from '../lib/store';
import {
  discountPercent,
  effectivePrice,
  formatSold,
  isFlashAvailable,
  originalPriceOf,
  stockOf,
  storeNameOf,
} from '../lib/marketplace';
import type { Listing } from '../types';

function waLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '62');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { listings, favorites, profile, seller, isSignedIn, reviews, vouchers, claimedVoucherCodes } = useAppState();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'detail' | 'ulasan' | 'lokasi'>('detail');
  const [form, setForm] = useState({ name: '', phone: '', message: '' });

  const listing = listings.find((item) => item.id === id);

  useEffect(() => {
    setQty(1);
    setSelectedVariation({});
    setTab('detail');
    setSent(false);
  }, [id]);

  useEffect(() => {
    if (!listing) return;
    setSelectedVariation((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const variation of listing.variations ?? []) {
        if (!next[variation.name] && variation.options.length > 0) {
          next[variation.name] = variation.options[0];
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [listing?.id]);

  const listingReviews = useMemo(
    () =>
      reviews
        .filter((review) => review.listingId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, id],
  );

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <EmptyState
          icon={Building2}
          title="Produk tidak ditemukan"
          description="Produk ini mungkin sudah dihapus oleh penjual."
          action={
            <Link
              to="/properti"
              className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white transition hover:bg-brand-dark"
            >
              Lihat produk lain
            </Link>
          }
        />
      </div>
    );
  }

  const isFavorite = favorites.includes(listing.id);
  const myCoords = profile.coords ?? seller?.coords ?? null;
  const distanceKm = listing.coords && myCoords ? haversineKm(myCoords, listing.coords) : null;
  const price = effectivePrice(listing);
  const original = originalPriceOf(listing);
  const discount = discountPercent(listing);
  const flash = isFlashAvailable(listing);
  const stock = stockOf(listing);
  const variations = listing.variations ?? [];
  const variationText = variations
    .map((variation) => selectedVariation[variation.name])
    .filter(Boolean)
    .join(' / ');
  const allVariationsSelected = variations.every((variation) => selectedVariation[variation.name]);
  const storeName = storeNameOf(listing);
  const storeVouchers = vouchers.filter(
    (voucher) => voucher.storeName === 'Semua Toko' || voucher.storeName === storeName,
  );

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      store.showToast('Tautan produk disalin.', 'success');
    } catch {
      store.showToast('Peramban menolak akses papan klip.', 'error');
    }
  };

  const validateVariation = (): boolean => {
    if (!allVariationsSelected) {
      const missing = variations
        .filter((variation) => !selectedVariation[variation.name])
        .map((variation) => variation.name)
        .filter(Boolean);
      store.showToast(
        missing.length > 0
          ? `Pilih varian ${missing.join(', ')} terlebih dahulu.`
          : 'Pilih varian produk terlebih dahulu.',
        'info',
      );
      return false;
    }
    return true;
  };

  const addToCart = () => {
    if (!validateVariation()) return;
    store.addToCart(listing.id, qty, variationText || undefined);
  };

  const buyNow = () => {
    if (!validateVariation()) return;
    const lineId = store.addToCart(listing.id, qty, variationText || undefined);
    if (!lineId) return;
    store.selectOnlyCartLine(lineId);
    navigate('/checkout');
  };

  const submitInquiry = (event: FormEvent) => {
    event.preventDefault();
    if (!isSignedIn) {
      store.showToast('Masuk dulu untuk mengirim pesan ke penjual.', 'info');
      navigate(`/masuk?next=${encodeURIComponent(`/properti/${listing.id}`)}`);
      return;
    }
    const name = form.name.trim() || profile.name;
    const phone = form.phone.trim() || profile.phone;
    if (!name || !phone) {
      store.showToast('Isi nama dan nomor telepon Anda.', 'error');
      return;
    }
    store.addInquiry(
      {
        id: newId('inquiry'),
        listingId: listing.id,
        listingTitle: listing.title,
        name,
        phone,
        message: form.message.trim() || `Saya tertarik dengan ${listing.title}.`,
        createdAt: new Date().toISOString(),
      },
      listing.ownerId,
    );
    setSent(true);
    setForm({ name: '', phone: '', message: '' });
  };

  const similar = listings
    .filter((item) => item.id !== listing.id && (item.category === listing.category || item.brand === listing.brand))
    .slice(0, 5);

  const specs = [
    { icon: BedDouble, label: 'Kamar tidur', value: listing.bedrooms > 0 ? String(listing.bedrooms) : '-' },
    { icon: Bath, label: 'Kamar mandi', value: listing.bathrooms > 0 ? String(listing.bathrooms) : '-' },
    { icon: LandPlot, label: 'Luas tanah', value: formatArea(listing.landArea) },
    { icon: Ruler, label: 'Luas bangunan', value: formatArea(listing.buildingArea) },
  ].filter((spec) => spec.value !== '-');

  const messageText = `Halo, saya tertarik dengan "${listing.title}" (${formatRupiah(price)}) di PROPERTIKA AI. Apakah masih tersedia?`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Link to="/" className="hover:text-brand-dark">
          Beranda
        </Link>
        <span>/</span>
        <Link to={`/properti?kategori=${encodeURIComponent(listing.category)}`} className="hover:text-brand-dark">
          {listing.category}
        </Link>
        <span>/</span>
        <span className="line-clamp-1 text-slate-700">{listing.title}</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ListingGallery listing={listing} />
            <div className="absolute left-3 top-3 flex gap-1.5">
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                {listing.category}
              </span>
              <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                {listing.purpose}
              </span>
            </div>
            <div className="absolute right-3 top-3 flex gap-1.5">
              <button
                type="button"
                onClick={share}
                aria-label="Bagikan produk"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:scale-105 hover:text-brand-dark"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => store.toggleFavorite(listing.id)}
                aria-label={isFavorite ? 'Hapus dari favorit' : 'Simpan ke favorit'}
                aria-pressed={isFavorite}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-105"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-base font-bold text-slate-900">Tentang produk ini</h2>
            <p className="mt-1 text-xs text-slate-500">
              {storeName} · Dipasang {formatDate(listing.createdAt)}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: ShieldCheck, label: 'Kondisi', value: listing.condition ?? 'Baru' },
                { icon: BadgeCheck, label: 'Garansi', value: 'Sesuai toko' },
                { icon: Truck, label: 'Pengiriman', value: listing.freeShipping ? 'Gratis' : 'Mulai 12rb' },
                { icon: Zap, label: 'Stok', value: stock > 0 ? `${stock} tersedia` : 'Habis' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <item.icon className="mb-1.5 h-4 w-4 text-brand" />
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                  <p className="text-xs font-semibold text-slate-800">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white">
            <div className="flex gap-1 border-b border-slate-100 px-3 pt-3">
              {[
                { id: 'detail', label: 'Detail Produk' },
                { id: 'ulasan', label: `Ulasan (${listingReviews.length || listing.reviewCount || 0})` },
                { id: 'lokasi', label: 'Lokasi' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id as typeof tab)}
                  className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                    tab === item.id
                      ? 'border-b-2 border-brand text-brand-dark'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {tab === 'detail' && (
                <div>
                  {listing.description ? (
                    <div className="space-y-2.5 text-sm leading-6 text-slate-600">
                      {listing.description
                        .split('\n')
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-400">Penjual belum menambahkan deskripsi.</p>
                  )}

                  {specs.length > 0 && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold text-slate-900">Spesifikasi</h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {specs.map((spec) => (
                          <div key={spec.label} className="rounded-lg border border-slate-200 p-2.5">
                            <spec.icon className="mb-1.5 h-4 w-4 text-brand" />
                            <p className="text-[10px] text-slate-500">{spec.label}</p>
                            <p className="text-xs font-semibold text-slate-800">{spec.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {listing.features.length > 0 && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-semibold text-slate-900">Fasilitas &amp; keunggulan</h3>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {listing.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab === 'ulasan' && (
                <div>
                  <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-3">
                    <div className="text-center">
                      <p className="text-3xl font-black text-slate-900">
                        {(listing.rating ?? 0).toFixed(1)}
                        <span className="text-sm font-medium text-slate-400">/5</span>
                      </p>
                      <RatingStars rating={listing.rating ?? 0} size="sm" />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {listing.reviewCount ?? 0} penilaian · {formatSold(listing.sold)}
                      </p>
                    </div>
                    <div className="flex-1 text-xs text-slate-500">
                      <p>
                        {listingReviews.length > 0
                          ? 'Ulasan pembeli yang sudah bertransaksi di Propertika.'
                          : 'Jadilah pembeli pertama yang memberi ulasan setelah transaksi selesai.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    {listingReviews.map((review) => (
                      <div key={review.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-dark">
                              {review.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{review.name}</p>
                              <RatingStars rating={review.rating} />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400">{formatDate(review.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{review.comment}</p>
                      </div>
                    ))}
                    {listingReviews.length === 0 && (
                      <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                        Belum ada ulasan tertulis.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'lokasi' && (
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 shrink-0 text-brand" />
                    {listing.location}
                    {listing.city ? `, ${listing.city}` : ''}
                  </p>
                  {listing.coords ? (
                    <>
                      {distanceKm !== null ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">
                          <Navigation className="h-3.5 w-3.5" />± {formatDistance(distanceKm)} dari lokasi Anda
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          {isSignedIn ? (
                            <>
                              Atur alamat di{' '}
                              <Link to="/akun?tab=alamat" className="font-medium text-brand-dark underline">
                                profil Anda
                              </Link>{' '}
                              untuk melihat jarak.
                            </>
                          ) : (
                            <>
                              <Link
                                to={`/masuk?next=${encodeURIComponent(`/properti/${listing.id}`)}`}
                                className="font-medium text-brand-dark underline"
                              >
                                Masuk
                              </Link>{' '}
                              dan atur alamat untuk melihat jarak.
                            </>
                          )}
                        </p>
                      )}
                      <a
                        href={mapsSearchUrl(listing.coords)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-brand-dark hover:underline"
                      >
                        Buka di Google Maps
                      </a>
                      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                        <iframe
                          title={`Peta lokasi ${listing.title}`}
                          src={mapsEmbedUrl(listing.coords)}
                          className="h-56 w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Penjual belum menandai titik lokasi produk ini.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                {listing.purpose}
              </span>
              {listing.brand && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {listing.brand}
                </span>
              )}
              {listing.aiGenerated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Sparkles className="h-3 w-3" />
                  Deskripsi AI
                </span>
              )}
            </div>

            <h1 className="mt-2 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">{listing.title}</h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <RatingStars rating={listing.rating ?? 0} count={listing.reviewCount} size="sm" />
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{formatSold(listing.sold)}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">{stock > 0 ? `Stok ${stock}` : 'Stok habis'}</span>
            </div>

            <div className="mt-4 rounded-xl bg-brand-soft/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-black text-brand">{formatRupiah(price)}</span>
                {original && <span className="price-strike text-sm">{formatRupiah(original)}</span>}
                {discount > 0 && (
                  <span className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-black text-white">-{discount}%</span>
                )}
                {listing.purpose === 'Disewa' && <span className="text-xs text-slate-500">/bulan</span>}
              </div>
              {flash && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-dark">
                    <Zap className="h-3.5 w-3.5 fill-brand text-brand" />
                    Harga Flash Sale
                  </span>
                  <Countdown />
                </div>
              )}
              {typeof listing.cashbackPercent === 'number' && listing.cashbackPercent > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Cashback {listing.cashbackPercent}% setelah pesanan selesai
                </p>
              )}
            </div>

            {storeVouchers.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Voucher tersedia</p>
                <div className="space-y-1.5">
                  {storeVouchers.slice(0, 4).map((voucher) => {
                    const claimed = claimedVoucherCodes.includes(voucher.code);
                    return (
                      <div
                        key={voucher.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-brand-soft-2 bg-brand-soft/50 px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-brand-dark">{voucher.code}</p>
                          <p className="truncate text-[10px] text-slate-500">
                            {voucher.title} · min {formatRupiah(voucher.minSpend)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={claimed}
                          onClick={() => store.claimVoucher(voucher.code)}
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                            claimed
                              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                              : 'bg-brand text-white hover:bg-brand-dark'
                          }`}
                        >
                          {claimed ? 'Tersimpan' : 'Klaim'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {variations.length > 0 && (
              <div className="mt-4 space-y-3">
                {variations.map((variation) => (
                  <div key={variation.name}>
                    <p className="mb-1.5 text-xs font-semibold text-slate-700">{variation.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {variation.options.map((option) => {
                        const active = selectedVariation[variation.name] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSelectedVariation({ ...selectedVariation, [variation.name]: option })}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                              active
                                ? 'border-brand bg-brand-soft text-brand-dark'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-brand'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">Jumlah</span>
              <QuantityStepper value={qty} onChange={setQty} min={1} max={Math.max(1, stock)} disabled={stock <= 0} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                <Truck className="h-3.5 w-3.5 text-brand" />
                {listing.freeShipping ? 'Gratis ongkir' : 'Ongkir mulai Rp12.000'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                Dikirim dari {listing.city || 'Indonesia'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                Pembayaran aman
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5 text-green-600" />
                Kondisi {listing.condition ?? 'Baru'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addToCart}
                disabled={stock <= 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-brand bg-white px-3 py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingCart className="h-4 w-4" />
                Tambah ke Keranjang
              </button>
              <button
                type="button"
                onClick={buyNow}
                disabled={stock <= 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                Beli Sekarang
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => store.toggleFavorite(listing.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-brand-dark"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                {isFavorite ? 'Tersimpan di favorit' : 'Simpan ke favorit'}
              </button>
              <button
                type="button"
                onClick={share}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 transition hover:text-brand-dark"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                Bagikan
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                {storeName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-900">
                  {storeName}
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
                </p>
                <p className="text-[11px] text-slate-500">
                  {listing.city || 'Indonesia'} · {formatSold(listing.sold)}
                </p>
              </div>
              <Link
                to={`/properti?q=${encodeURIComponent(storeName)}`}
                className="shrink-0 rounded-lg border border-brand px-2.5 py-1.5 text-[11px] font-semibold text-brand-dark transition hover:bg-brand-soft"
              >
                Kunjungi
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-xs font-bold text-slate-900">{listing.rating?.toFixed(1) ?? '-'}</p>
                <p className="text-[10px] text-slate-500">Rating</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-xs font-bold text-slate-900">{listing.reviewCount ?? 0}</p>
                <p className="text-[10px] text-slate-500">Ulasan</p>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <p className="text-xs font-bold text-slate-900">{formatSold(listing.sold).replace(' terjual', '')}</p>
                <p className="text-[10px] text-slate-500">Terjual</p>
              </div>
            </div>

            {listing.contactPhone && (
              <a
                href={waLink(listing.contactPhone, messageText)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100"
              >
                <MessageCircle className="h-4 w-4" />
                Chat Penjual via WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hubungi penjual + inquiry */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Store className="h-4 w-4 text-brand" />
            Informasi Penjual
          </h2>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
              {listing.ownerName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{listing.ownerName}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="h-3 w-3" />
                {listing.contactPhone || 'Belum diisi'}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Semua transaksi di Propertika dilindungi. Hindari pembayaran di luar sistem agar pesanan Anda tetap aman.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <MessageCircle className="h-4 w-4 text-brand" />
            Kirim Pertanyaan
          </h2>
          {sent ? (
            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              <p className="font-semibold">Pesan terkirim.</p>
              <p className="mt-0.5 text-xs text-green-800">
                Permintaan Anda tersimpan dan bisa dilihat penjual di dashboard penjual.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-2 text-xs font-semibold text-green-900 underline"
              >
                Kirim pesan lain
              </button>
            </div>
          ) : (
            <form onSubmit={submitInquiry} className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={profile.name || 'Nama Anda'}
                aria-label="Nama Anda"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder={profile.phone || 'Nomor telepon'}
                aria-label="Nomor telepon"
                inputMode="tel"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />
              <textarea
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                rows={2}
                placeholder="Saya ingin menjadwalkan survei…"
                aria-label="Pesan"
                className="resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:bg-white sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:col-span-2"
              >
                Kirim pertanyaan
              </button>
            </form>
          )}
        </div>
      </section>

      {similar.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-lg font-bold text-slate-900">Produk Serupa</h2>
            <Link
              to={`/properti?kategori=${encodeURIComponent(listing.category)}`}
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              Lihat semua
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {similar.map((item: Listing) => (
              <ProductCard key={item.id} listing={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
