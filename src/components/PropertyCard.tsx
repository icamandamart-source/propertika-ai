import { Link } from 'react-router-dom';
import { Heart, Images, MapPin, Navigation } from 'lucide-react';
import type { Listing } from '../types';
import { formatRupiahShort, formatSpecs, formatDate } from '../lib/format';
import { formatDistance, haversineKm } from '../lib/geo';
import { store, useAppState } from '../lib/store';
import SafeImage from './SafeImage';

export default function PropertyCard({ listing }: { listing: Listing }) {
  const { favorites, profile, seller } = useAppState();
  const isFavorite = favorites.includes(listing.id);
  const myCoords = profile.coords ?? seller?.coords ?? null;
  const distanceKm =
    listing.coords && myCoords ? haversineKm(myCoords, listing.coords) : null;
  const gallery = (listing.images ?? []).filter((src) => src.trim() !== '');
  const cover = listing.imageUrl?.trim() || gallery[0] || '';
  const photoCount = (listing.imageUrl?.trim() ? 1 : 0) + gallery.length;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link to={`/properti/${listing.id}`} className="block">
        <div className="relative h-48 overflow-hidden bg-slate-200">
          <SafeImage
            src={cover}
            alt={listing.title}
            category={listing.category}
            seed={listing.id}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          {photoCount > 1 && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
              <Images className="h-3 w-3" />
              {photoCount}
            </span>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 shadow-sm">
            {listing.category}
          </span>
          <span className="absolute left-3 top-11 rounded-full bg-emerald-900/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            {listing.purpose}
          </span>
          {listing.aiGenerated && (
            <span className="absolute bottom-3 left-3 rounded-full bg-amber-500/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              Deskripsi AI
            </span>
          )}
        </div>

        <div className="p-4">
          <p className="text-lg font-bold text-emerald-900">
            {formatRupiahShort(listing.price)}
            {listing.purpose === 'Disewa' && listing.price > 0 && (
              <span className="text-sm font-medium text-slate-500"> /bulan</span>
            )}
          </p>
          <h3 className="mt-1 line-clamp-1 font-semibold text-slate-900">{listing.title}</h3>
          <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {listing.location}
              {listing.city ? `, ${listing.city}` : ''}
            </span>
          </p>
          {distanceKm !== null && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-900">
              <Navigation className="h-3 w-3 shrink-0" />
              ± {formatDistance(distanceKm)} dari lokasi Anda
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">{formatSpecs(listing)}</p>
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Dipasang {formatDate(listing.createdAt)}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => store.toggleFavorite(listing.id)}
        aria-label={isFavorite ? 'Hapus dari favorit' : 'Simpan ke favorit'}
        aria-pressed={isFavorite}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110"
      >
        <Heart className={`h-4.5 w-4.5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-500'}`} />
      </button>
    </article>
  );
}
