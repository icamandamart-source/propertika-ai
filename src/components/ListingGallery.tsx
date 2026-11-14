import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Listing } from '../types';
import SafeImage from './SafeImage';

interface Props {
  listing: Listing;
}

/** Galeri foto listing dengan slide otomatis, navigasi panah, dan indikator. */
export default function ListingGallery({ listing }: Props) {
  const photos = useMemo(() => {
    const extra = (listing.images ?? []).map((src) => src.trim()).filter(Boolean);
    const main = listing.imageUrl?.trim();
    return (main ? [main, ...extra] : [...extra]).slice(0, 5);
  }, [listing.imageUrl, listing.images]);

  const slides = photos.length > 0 ? photos : [''];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [listing.id]);

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  const go = (step: number) => {
    setIndex((current) => (current + step + slides.length) % slides.length);
  };

  return (
    <div
      className="relative h-72 w-full overflow-hidden sm:h-96"
      aria-roledescription="carousel"
      aria-label={`Galeri foto ${listing.title}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((src, item) => (
        <div
          key={`${item}-${src.slice(-20)}`}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            item === index ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={item !== index}
        >
          <SafeImage
            src={src}
            alt={`${listing.title} — foto ${item + 1}`}
            category={listing.category}
            seed={`${listing.id}-${item}`}
            className="h-full w-full object-cover"
          />
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Foto sebelumnya"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:scale-105"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Foto berikutnya"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:scale-105"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, item) => (
              <button
                key={item}
                type="button"
                onClick={() => setIndex(item)}
                aria-label={`Tampilkan foto ${item + 1}`}
                aria-current={item === index}
                className={`h-2 rounded-full transition-all ${
                  item === index ? 'w-6 bg-white/90' : 'w-2 bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>

          <span className="absolute bottom-4 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
            {index + 1} / {slides.length}
          </span>
        </>
      )}
    </div>
  );
}
