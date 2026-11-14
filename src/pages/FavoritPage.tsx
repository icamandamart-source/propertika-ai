import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import { useFavorites } from '../lib/store';

export default function FavoritPage() {
  const favorites = useFavorites();

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Favorit Saya</h1>
      <p className="mb-4 mt-0.5 text-xs text-slate-500 sm:text-sm">
        {favorites.length > 0
          ? `${favorites.length} produk disimpan`
          : 'Produk yang Anda simpan akan muncul di sini.'}
      </p>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Belum ada produk favorit"
          description="Tekan ikon hati pada kartu produk untuk menyimpannya di halaman ini."
          action={
            <Link
              to="/properti"
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Jelajahi produk
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {favorites.map((listing) => (
            <ProductCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
