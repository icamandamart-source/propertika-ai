import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import ProductCard from './ProductCard';
import EmptyState from './EmptyState';
import { LISTING_PURPOSES, type ListingCategory, type ListingPurpose } from '../types';
import { useAppState } from '../lib/store';
import { unique } from '../lib/marketplace';

interface Props {
  title: string;
  subtitle?: string;
  lockedCategory?: ListingCategory;
  lockedPurpose?: ListingPurpose;
}

const JUAL_RANGES = [
  { label: 'Semua harga', value: '' },
  { label: '< Rp 500 Jt', value: '0-500000000' },
  { label: 'Rp 500 Jt – 1 M', value: '500000000-1000000000' },
  { label: 'Rp 1 M – 2 M', value: '1000000000-2000000000' },
  { label: 'Rp 2 M – 5 M', value: '2000000000-5000000000' },
  { label: '> Rp 5 M', value: '5000000000-' },
];

const SEWA_RANGES = [
  { label: 'Semua harga', value: '' },
  { label: '< Rp 5 Jt /bulan', value: '0-5000000' },
  { label: 'Rp 5 – 15 Jt /bulan', value: '5000000-15000000' },
  { label: '> Rp 15 Jt /bulan', value: '15000000-' },
];

const SORTS = [
  { label: 'Terbaru', value: 'terbaru' },
  { label: 'Terlaris', value: 'terlaris' },
  { label: 'Rating tertinggi', value: 'rating' },
  { label: 'Harga terendah', value: 'termurah' },
  { label: 'Harga tertinggi', value: 'termahal' },
];

const RATINGS = [
  { label: 'Semua rating', value: '' },
  { label: '4 bintang ke atas', value: '4' },
  { label: '3 bintang ke atas', value: '3' },
];

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500';

export default function ListingExplorer({ title, subtitle, lockedCategory, lockedPurpose }: Props) {
  const { listings, profile, seller, isSignedIn, categories } = useAppState();
  const hasLocation = Boolean(profile.coords ?? seller?.coords);
  const [params, setParams] = useSearchParams();

  const query = params.get('q') ?? '';
  const category = lockedCategory ?? params.get('kategori') ?? '';
  const purpose = lockedPurpose ?? params.get('tujuan') ?? '';
  const range = params.get('harga') ?? '';
  const rating = params.get('rating') ?? '';
  const city = params.get('lokasi') ?? '';
  const sort = params.get('urut') ?? 'terbaru';

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const cities = useMemo(
    () => unique(listings.map((listing) => listing.city).filter(Boolean)).sort((a, b) => a.localeCompare(b)),
    [listings],
  );

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const [minRaw, maxRaw] = range.split('-');
    const min = minRaw ? Number(minRaw) : 0;
    const max = maxRaw ? Number(maxRaw) : Number.POSITIVE_INFINITY;
    const minRating = rating ? Number(rating) : 0;

    const filtered = listings.filter((listing) => {
      if (lockedCategory && listing.category !== lockedCategory) return false;
      if (lockedPurpose && listing.purpose !== lockedPurpose) return false;
      if (category && listing.category !== category) return false;
      if (purpose && listing.purpose !== purpose) return false;
      if (range && (listing.price < min || listing.price > max)) return false;
      if (minRating && (listing.rating ?? 0) < minRating) return false;
      if (city && listing.city !== city) return false;
      if (!keyword) return true;
      return [
        listing.title,
        listing.location,
        listing.city,
        listing.category,
        listing.description,
        listing.brand ?? '',
        listing.storeName ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });

    return filtered.sort((a, b) => {
      if (sort === 'termurah') return a.price - b.price;
      if (sort === 'termahal') return b.price - a.price;
      if (sort === 'terlaris') return (b.sold ?? 0) - (a.sold ?? 0);
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [listings, query, category, purpose, range, rating, city, sort, lockedCategory, lockedPurpose]);

  const ranges = purpose === 'Disewa' ? SEWA_RANGES : JUAL_RANGES;
  const hasFilter = Boolean(query || category || purpose || range || rating || city);
  const activeFilters = [
    query && `"${query}"`,
    category,
    purpose,
    range && ranges.find((item) => item.value === range)?.label,
    rating && `${rating}★+`,
    city,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          {subtitle ?? `${results.length} produk ditemukan`}
          {hasFilter && <span className="text-slate-400"> · filter aktif</span>}
        </p>
      </header>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => update('q', event.target.value)}
              placeholder="Cari judul, lokasi, toko, atau kata kunci…"
              aria-label="Cari listing"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
            {!lockedCategory && (
              <select
                value={category}
                onChange={(event) => update('kategori', event.target.value)}
                aria-label="Filter kategori"
                className={selectClass}
              >
                <option value="">Semua kategori</option>
                {categories.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.label}
                  </option>
                ))}
              </select>
            )}

            {!lockedPurpose && (
              <select
                value={purpose}
                onChange={(event) => update('tujuan', event.target.value)}
                aria-label="Filter tujuan"
                className={selectClass}
              >
                <option value="">Dijual &amp; Disewa</option>
                {LISTING_PURPOSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}

            <select
              value={range}
              onChange={(event) => update('harga', event.target.value)}
              aria-label="Filter harga"
              className={selectClass}
            >
              {ranges.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={rating}
              onChange={(event) => update('rating', event.target.value)}
              aria-label="Filter rating"
              className={selectClass}
            >
              {RATINGS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={city}
              onChange={(event) => update('lokasi', event.target.value)}
              aria-label="Filter lokasi"
              className={selectClass}
            >
              <option value="">Semua lokasi</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => update('urut', event.target.value)}
              aria-label="Urutkan"
              className={selectClass}
            >
              {SORTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                {filter}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-500 transition hover:border-brand hover:text-brand-dark"
            >
              <X className="h-3 w-3" />
              Reset filter
            </button>
          </div>
        )}
      </div>

      {isSignedIn && !hasLocation && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            Atur lokasi Anda agar jarak tiap properti bisa ditampilkan.
          </span>
          <Link to="/akun?tab=alamat" className="font-semibold text-brand-dark hover:underline">
            Atur lokasi
          </Link>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Tidak ada produk yang cocok"
          description="Coba ubah kata kunci atau kosongkan beberapa filter untuk melihat lebih banyak hasil."
          action={
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Reset filter
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
