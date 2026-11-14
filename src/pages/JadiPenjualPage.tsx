import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Loader2, Store } from 'lucide-react';
import { store, useAppState } from '../lib/store';
import { SELLER_TYPES, type SellerProfile } from '../types';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

export default function JadiPenjualPage() {
  const { profile, role } = useAppState();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seller, setSeller] = useState<SellerProfile>({
    businessName: profile.name === 'Tamu' ? '' : profile.name,
    sellerType: '',
    phone: profile.phone,
    city: '',
    address: '',
    npwp: '',
    description: '',
  });

  if (role === 'seller') return <Navigate to="/dashboard-seller" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!seller.businessName.trim()) {
      setError('Nama usaha / brand wajib diisi.');
      return;
    }
    if (!seller.sellerType) {
      setError('Jenis penjual wajib dipilih.');
      return;
    }
    if (!seller.phone.trim()) {
      setError('Nomor telepon / WhatsApp wajib diisi.');
      return;
    }
    if (!seller.city.trim()) {
      setError('Kota domisili wajib diisi.');
      return;
    }
    if (!seller.address.trim()) {
      setError('Alamat usaha wajib diisi.');
      return;
    }

    setPending(true);
    store.saveSellerRegistration(seller);
    setPending(false);
    navigate('/dashboard-seller');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/dashboard-user"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-emerald-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke dashboard pembeli
      </Link>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-100 bg-emerald-50/50 px-6 py-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-white">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Jadi Penjual</h1>
            <p className="mt-1 text-sm text-slate-500">
              Lengkapi kriteria penjual berikut. Akun Anda akan berubah menjadi akun penjual dan bisa memasang iklan
              properti.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 p-6 sm:grid-cols-2">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 sm:col-span-2" role="alert">
              {error}
            </p>
          )}

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama usaha / brand</span>
            <input
              className={inputClass}
              value={seller.businessName}
              onChange={(event) => setSeller({ ...seller, businessName: event.target.value })}
              placeholder="Contoh: Griya Nusantara"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Jenis penjual</span>
            <select
              className={inputClass}
              value={seller.sellerType}
              onChange={(event) =>
                setSeller({ ...seller, sellerType: event.target.value as SellerProfile['sellerType'] })
              }
            >
              <option value="">Pilih jenis penjual</option>
              {SELLER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Telepon / WhatsApp</span>
            <input
              className={inputClass}
              inputMode="tel"
              value={seller.phone}
              onChange={(event) => setSeller({ ...seller, phone: event.target.value })}
              placeholder="0812-3456-7890"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Kota</span>
            <input
              className={inputClass}
              value={seller.city}
              onChange={(event) => setSeller({ ...seller, city: event.target.value })}
              placeholder="Jakarta"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">NPWP (opsional)</span>
            <input
              className={inputClass}
              value={seller.npwp}
              onChange={(event) => setSeller({ ...seller, npwp: event.target.value })}
              placeholder="00.000.000.0-000.000"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Alamat usaha</span>
            <input
              className={inputClass}
              value={seller.address}
              onChange={(event) => setSeller({ ...seller, address: event.target.value })}
              placeholder="Alamat lengkap kantor / usaha"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Deskripsi singkat (opsional)</span>
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={seller.description}
              onChange={(event) => setSeller({ ...seller, description: event.target.value })}
              placeholder="Ceritakan pengalaman dan fokus jualan Anda."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              Aktifkan Akun Penjual
            </button>
            <Link
              to="/dashboard-user"
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
