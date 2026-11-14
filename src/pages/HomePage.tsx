import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Clock3,
  Gift,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Wallet,
  Zap,
} from 'lucide-react';
import CategorySection from '../components/CategorySection';
import ProductCard from '../components/ProductCard';
import Countdown from '../components/Countdown';
import VoucherCard from '../components/VoucherCard';
import SafeImage from '../components/SafeImage';
import RatingStars from '../components/RatingStars';
import { useAppState } from '../lib/store';
import { discountPercent, effectivePrice, formatSold, isFlashAvailable } from '../lib/marketplace';
import { formatRupiah } from '../lib/format';

const TRUST_ITEMS = [
  { icon: Truck, title: 'Gratis Ongkir', text: 'Min. belanja Rp5 jt' },
  { icon: ShieldCheck, title: 'Pembayaran Aman', text: 'Terverifikasi' },
  { icon: BadgePercent, title: 'Harga Terbaik', text: 'Diskon tiap hari' },
  { icon: Wallet, title: 'Cashback', text: 'Hingga 5%' },
];

export default function HomePage() {
  const { listings, banners, vouchers, stores, claimedVoucherCodes, categories } = useAppState();
  const [bannerIndex, setBannerIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name ?? 'Rumah');

  const featuredBanners = banners.slice(0, 4);
  const activeBanner = featuredBanners[bannerIndex] ?? featuredBanners[0];

  useEffect(() => {
    if (featuredBanners.length <= 1) return;
    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % featuredBanners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [featuredBanners.length]);

  useEffect(() => {
    if (!categories.some((category) => category.name === selectedCategory)) {
      setSelectedCategory(categories[0]?.name ?? 'Rumah');
    }
  }, [categories, selectedCategory]);

  const flashItems = useMemo(
    () =>
      [...listings]
        .filter(isFlashAvailable)
        .sort((a, b) => discountPercent(b) - discountPercent(a))
        .slice(0, 10),
    [listings],
  );

  const recommended = useMemo(
    () =>
      [...listings]
        .sort((a, b) => (b.rating ?? 0) * (b.reviewCount ?? 0) - (a.rating ?? 0) * (a.reviewCount ?? 0))
        .slice(0, 10),
    [listings],
  );

  const bestSellers = useMemo(
    () => [...listings].sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)).slice(0, 5),
    [listings],
  );

  const newest = useMemo(
    () =>
      [...listings]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [listings],
  );

  const categoryItems = useMemo(
    () => listings.filter((listing) => listing.category === selectedCategory).slice(0, 5),
    [listings, selectedCategory],
  );

  const featuredVouchers = vouchers.slice(0, 4);
  const featuredStores = stores.slice(0, 8);
  const flashStock = flashItems.reduce((sum, item) => sum + (item.flashStock ?? 0), 0);
  const flashSold = flashItems.reduce((sum, item) => sum + (item.sold ?? 0), 0);

  return (
    <div className="pb-4">
      {/* Banner utama */}
      <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
          <div className="relative h-[280px] overflow-hidden rounded-2xl bg-navy sm:h-[340px]">
            {activeBanner ? (
              <div key={activeBanner.id} className="fade-in absolute inset-0">
                <SafeImage
                  src={activeBanner.imageUrl}
                  alt={activeBanner.title}
                  category="Rumah"
                  seed={activeBanner.id}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/10" />
                <div className="relative flex h-full max-w-lg flex-col justify-center px-6 py-8 sm:px-10">
                  {activeBanner.badge && (
                    <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      <Sparkles className="h-3 w-3" />
                      {activeBanner.badge}
                    </span>
                  )}
                  <h1 className="text-2xl font-black leading-tight text-white sm:text-4xl">{activeBanner.title}</h1>
                  <p className="mt-2 line-clamp-2 text-sm text-white/80 sm:text-base">{activeBanner.subtitle}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      to={activeBanner.to}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                    >
                      {activeBanner.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/properti"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/35 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Semua Produk
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white">Belum ada banner.</div>
            )}

            {featuredBanners.length > 1 && (
              <div className="absolute bottom-4 right-4 flex gap-1.5">
                {featuredBanners.map((banner, index) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setBannerIndex(index)}
                    aria-label={`Tampilkan banner ${index + 1}`}
                    aria-current={index === bannerIndex}
                    className={`h-1.5 rounded-full transition-all ${
                      index === bannerIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Link
              to="/flash-sale"
              className="group relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-2xl brand-gradient p-4 text-white shadow-sm"
            >
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  <Zap className="h-3 w-3" /> Flash Sale
                </span>
                <p className="mt-2 text-lg font-black leading-tight">Diskon Kilat Hari Ini</p>
                <p className="text-xs text-white/85">{flashItems.length} produk · stok terbatas</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                Belanja sekarang <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>

            <Link
              to="/voucher"
              className="group relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-2xl navy-gradient p-4 text-white shadow-sm"
            >
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  <Truck className="h-3 w-3" /> Gratis Ongkir
                </span>
                <p className="mt-2 text-lg font-black leading-tight">Voucher s/d Rp25.000</p>
                <p className="text-xs text-white/80">Klaim sebelum kehabisan</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold">
                Klaim voucher <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <item.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-800">{item.title}</p>
                <p className="truncate text-[10px] text-slate-500">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CategorySection />

      {/* Voucher */}
      <section className="mx-auto max-w-7xl px-4 pb-2 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-900 sm:text-xl">
              <Gift className="h-5 w-5 text-brand" />
              Voucher Spesial
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Klaim dulu, pakai saat checkout.</p>
          </div>
          <Link to="/voucher" className="text-xs font-semibold text-brand-dark hover:underline">
            Lihat semua
          </Link>
        </div>

        <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto pb-1">
          {featuredVouchers.map((voucher) => (
            <div key={voucher.id} className="w-[280px] shrink-0 sm:w-[300px]">
              <VoucherCard
                voucher={voucher}
                claimed={claimedVoucherCodes.includes(voucher.code)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Flash sale */}
      <section className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-brand-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white">
                <Zap className="h-4 w-4 fill-white" />
              </span>
              <div>
                <h2 className="text-base font-black text-brand-dark sm:text-lg">FLASH SALE</h2>
                <p className="text-[11px] text-slate-500">
                  {flashStock > 0 ? `Sisa ${flashStock} stok promo · ${flashSold} terjual` : 'Stok promo terbatas'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Countdown />
              <Link to="/flash-sale" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline">
                Lihat semua
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto p-3 sm:p-4">
            {flashItems.map((listing) => (
              <div key={listing.id} className="w-40 shrink-0 sm:w-44">
                <ProductCard listing={listing} compact />
              </div>
            ))}
            {flashItems.length === 0 && (
              <p className="px-2 py-6 text-sm text-slate-500">Belum ada produk flash sale hari ini.</p>
            )}
          </div>
        </div>
      </section>

      {/* Rekomendasi */}
      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Rekomendasi Untukmu</h2>
            <p className="mt-0.5 text-xs text-slate-500">Pilihan populer dengan rating dan ulasan terbaik.</p>
          </div>
          <Link to="/properti" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline">
            Lihat semua <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {recommended.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Gratis ongkir */}
      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl navy-gradient px-5 py-6 text-white sm:px-8">
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                <Truck className="h-3.5 w-3.5" />
                Gratis Ongkir
              </span>
              <h2 className="mt-2 text-xl font-black sm:text-2xl">Gratis ongkir reguler untuk belanja min. Rp5 juta.</h2>
              <p className="mt-1 text-sm text-white/75">
                Atau klaim voucher ongkir hingga Rp25.000 untuk belanja min. Rp150.000.
              </p>
            </div>
            <Link
              to="/voucher"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Klaim voucher
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/30 blur-2xl" />
        </div>
      </section>

      {/* Produk per kategori */}
      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Produk Berdasarkan Kategori</h2>
            <p className="mt-0.5 text-xs text-slate-500">Temukan cepat sesuai kebutuhan hunian Anda.</p>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => setSelectedCategory(category.name)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === category.name
                    ? 'bg-brand text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand-dark'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categoryItems.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* Terlaris & terbaru */}
      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <BadgePercent className="h-4 w-4 text-brand" />
                Produk Terlaris
              </h2>
              <Link to="/properti?urut=terlaris" className="text-[11px] font-semibold text-brand-dark hover:underline">
                Lihat semua
              </Link>
            </div>
            <div className="space-y-1">
              {bestSellers.map((listing, index) => (
                <Link
                  key={listing.id}
                  to={`/properti/${listing.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${
                      index === 0
                        ? 'bg-brand text-white'
                        : index === 1
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <SafeImage
                    src={listing.imageUrl}
                    alt={listing.title}
                    category={listing.category}
                    seed={listing.id}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-slate-800">{listing.title}</p>
                    <p className="text-[11px] text-slate-400">{formatSold(listing.sold)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand">{formatRupiah(effectivePrice(listing))}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <Clock3 className="h-4 w-4 text-brand" />
                Produk Terbaru
              </h2>
              <Link to="/properti?urut=terbaru" className="text-[11px] font-semibold text-brand-dark hover:underline">
                Lihat semua
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {newest.slice(0, 3).map((listing) => (
                <Link
                  key={listing.id}
                  to={`/properti/${listing.id}`}
                  className="group overflow-hidden rounded-xl border border-slate-200 transition hover:border-brand"
                >
                  <SafeImage
                    src={listing.imageUrl}
                    alt={listing.title}
                    category={listing.category}
                    seed={listing.id}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-slate-700">{listing.title}</p>
                    <p className="mt-1 text-xs font-bold text-brand">{formatRupiah(effectivePrice(listing))}</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link
              to="/properti"
              className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand-soft hover:text-brand-dark"
            >
              Jelajahi semua produk <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Toko pilihan */}
      <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-900 sm:text-xl">
              <Store className="h-5 w-5 text-brand" />
              Toko Pilihan
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Penjual terpercaya dengan produk terlaris.</p>
          </div>
        </div>
        <div className="no-scrollbar snap-rail flex gap-3 overflow-x-auto pb-1">
          {featuredStores.map((storeInfo) => (
            <Link
              key={`${storeInfo.ownerId}-${storeInfo.name}`}
              to={`/properti?q=${encodeURIComponent(storeInfo.name)}`}
              className="card-hover w-52 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <SafeImage
                src={storeInfo.imageUrl}
                alt={storeInfo.name}
                category="Rumah"
                seed={storeInfo.name}
                className="h-24 w-full object-cover"
              />
              <div className="p-3">
                <p className="line-clamp-1 text-sm font-semibold text-slate-900">{storeInfo.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                  {storeInfo.city || 'Indonesia'} · {storeInfo.listingCount} produk
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <RatingStars rating={storeInfo.rating} showValue />
                  <span className="text-[10px] text-slate-400">{formatSold(storeInfo.sold)}</span>
                </div>
                <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-[10px] font-semibold text-brand-dark">
                  Kunjungi Toko
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* AI Studio */}
      <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-dark">
                <Sparkles className="h-3.5 w-3.5" />
                AI Property Studio
              </span>
              <h2 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">
                Pasang iklan lebih cepat, tampilkan properti lebih menarik.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Buat deskripsi jualan otomatis, ubah ruangan kosong jadi berperabot, dan simulasikan cicilan KPR
                dalam satu tempat.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  to="/ai-studio"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  <Sparkles className="h-4 w-4" />
                  Buka AI Studio
                </Link>
                <Link
                  to="/kalkulator-kpr"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand-dark"
                >
                  Hitung KPR
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { title: 'Deskripsi AI', text: 'Iklan siap tayang dalam hitungan detik.' },
                { title: 'Room Makeover', text: 'Ruangan kosong jadi berperabot.' },
                { title: 'Simulasi KPR', text: 'Cicilan bulanan langsung terlihat.' },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
