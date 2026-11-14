import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, ArrowRight, Loader2, Plus } from 'lucide-react';
import PropertyCard from './PropertyCard';
import { useAppState } from '../lib/store';
import type { Listing } from '../types';

interface Props {
  /** Kata kunci hasil generate/RAB untuk mengurutkan furniture yang paling relevan. */
  keywords?: string[];
  limit?: number;
  /** Dipanggil saat pengguna ingin menggabungkan furniture ini ke gambar hasil generate. */
  onApply?: (listing: Listing) => void;
  /** Id listing yang sedang diproses agar tombolnya menampilkan status loading. */
  applyingId?: string | null;
  /** Nonaktifkan tombol saat proses gambar lain sedang berjalan. */
  disabled?: boolean;
}

function tokenize(values: string[]): string[] {
  return values
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

export default function FurnitureRecommendations({
  keywords = [],
  limit = 3,
  onApply,
  applyingId = null,
  disabled = false,
}: Props) {
  const { listings } = useAppState();

  const recommendations = useMemo(() => {
    const furniture = listings.filter((listing) => listing.category === 'Furniture');
    const forSale = furniture.filter((listing) => listing.purpose === 'Dijual');
    const pool = forSale.length > 0 ? forSale : furniture;
    const tokens = tokenize(keywords);

    const score = (haystack: string) => {
      const text = haystack.toLowerCase();
      return tokens.reduce((total, token) => (text.includes(token) ? total + 1 : total), 0);
    };

    return [...pool]
      .sort((a, b) => {
        const diff = score(`${b.title} ${b.description} ${b.features.join(' ')}`) -
          score(`${a.title} ${a.description} ${a.features.join(' ')}`);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, limit);
  }, [listings, keywords, limit]);

  if (recommendations.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm">
        <Armchair className="mx-auto h-8 w-8 text-slate-300" />
        <h2 className="mt-3 font-semibold text-slate-900">Rekomendasi Furniture</h2>
        <p className="mt-1 text-sm text-slate-500">
          Belum ada furniture yang dijual di marketplace. Pasang iklan furniture Anda agar muncul di sini.
        </p>
        <Link
          to="/furniture"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 hover:text-emerald-700"
        >
          Lihat kategori furniture
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-900 text-white">
            <Armchair className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Rekomendasi Furniture</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Furniture yang sedang dijual di Propertika AI. Pilih salah satu untuk digabungkan ke foto hasil generate.
            </p>
          </div>
        </div>
        <Link
          to="/furniture"
          className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-emerald-900 hover:text-emerald-700 sm:inline-flex"
        >
          Lihat semua
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recommendations.map((listing) => {
          const isApplying = applyingId === listing.id;
          const isBusy = applyingId !== null || disabled;
          return (
            <div key={listing.id} className="flex flex-col gap-2">
              <PropertyCard listing={listing} />
              {onApply && (
                <button
                  type="button"
                  onClick={() => onApply(listing)}
                  disabled={isBusy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isApplying ? 'Menggabungkan…' : 'Tambahkan ke foto'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Link
        to="/furniture"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-900 hover:text-emerald-700 sm:hidden"
      >
        Lihat semua furniture
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
