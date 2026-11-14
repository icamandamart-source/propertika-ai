import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <EmptyState
        icon={Compass}
        title="Halaman tidak ditemukan"
        description="Alamat yang Anda buka tidak tersedia atau sudah dipindahkan."
        action={
          <Link
            to="/"
            className="rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
          >
            Kembali ke beranda
          </Link>
        }
      />
    </div>
  );
}
