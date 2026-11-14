import { Link } from 'react-router-dom';
import { Heart, Images, MapPin, ShieldCheck, Zap } from 'lucide-react';
import type { Listing } from '../types';
import { formatRupiah, formatSpecs } from '../lib/format';
import {
  discountPercent,
  effectivePrice,
  formatSold,
  isFlashAvailable,
  originalPriceOf,
  stockOf,
  storeNameOf,
} from '../lib/marketplace';
import { store, useAppState } from '../lib/store';
import SafeImage from './SafeImage';
import RatingStars from './RatingStars';

interface Props {
  listing: Listing;
  compact?: boolean;
}

export default function ProductCard({ listing, compact }: Props) {
  const { favorites } = useAppState();
  const isFavorite = favorites.includes(listing.id);
  const price = effectivePrice(listing);
  const original = originalPriceOf(listing);
  const discount = discountPercent(listing);
  const gallery = (listing.images ?? []).filter((src) => src.trim() !== '');
  const cover = listing.imageUrl?.trim() || gallery[0] || '';
  const photoCount = (listing.imageUrl?.trim() ? 1 : 0) + gallery.length;
  const flash = isFlashAvailable(listing);
  const stock = stockOf(listing);

  return (
    <article className="card-hover group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <Link to={`/properti/${listing.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
          <SafeImage
            src={cover}
            alt={listing.title}
            category={listing.category}
            seed={listing.id}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />

          {discount > 0 && (
            <span className="absolute left-0 top-0 rounded-br-lg bg-brand px-2 py-1 text-[11px] font-black text-white shadow-sm">
              -{discount}%
            </span>
          )}

          {flash && (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <Zap className="h-3 w-3 fill-amber-400 text-amber-400" />
              Flash Sale
            </span>
          )}

          {stock <= 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-sm font-semibold text-white">
              Stok habis
            </span>
          )}

          {photoCount > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <Images className="h-3 w-3" />
              {photoCount}
            </span>
          )}
        </div>

        <div className={compact ? 'p-2.5' : 'p-2.5 sm:p-3'}>
          <h3 className="line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-slate-800 transition group-hover:text-brand-dark">
            {listing.title}
          </h3>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-base font-bold text-brand">{formatRupiah(price)}</span>
            {original && <span className="price-strike text-[11px]">{formatRupiah(original)}</span>}
            {listing.purpose === 'Disewa' && <span className="text-[10px] text-slate-400">/bulan</span>}
          </div>

          <div className="mt-1 flex items-center justify-between gap-1">
            <RatingStars rating={listing.rating ?? 0} count={listing.reviewCount} />
            <span className="shrink-0 text-[10px] text-slate-400">{formatSold(listing.sold)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-1 text-[11px] text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{listing.city || storeNameOf(listing)}</span>
            </span>
            {listing.category !== 'Furniture' && (
              <span className="shrink-0 text-[10px] text-slate-400">{formatSpecs(listing)}</span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {listing.freeShipping && (
              <span className="rounded border border-brand-soft-2 bg-brand-soft px-1 py-0.5 text-[9px] font-semibold text-brand-dark">
                Gratis Ongkir
              </span>
            )}
            {listing.condition === 'Baru' && (
              <span className="rounded border border-slate-200 px-1 py-0.5 text-[9px] font-medium text-slate-500">
                Baru
              </span>
            )}
            {typeof listing.cashbackPercent === 'number' && listing.cashbackPercent > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                <ShieldCheck className="h-2.5 w-2.5" />
                Cashback {listing.cashbackPercent}%
              </span>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => store.toggleFavorite(listing.id)}
        aria-label={isFavorite ? 'Hapus dari favorit' : 'Simpan ke favorit'}
        aria-pressed={isFavorite}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur transition hover:scale-110"
      >
        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-500'}`} />
      </button>
    </article>
  );
}
