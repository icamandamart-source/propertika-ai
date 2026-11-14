import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, LogOut, Mail, Phone, RotateCcw, Send, ShieldCheck, Store, User } from 'lucide-react';
import { store, useAppState } from '../lib/store';
import { useAuth } from '../lib/auth';
import AddressPicker from '../components/AddressPicker';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

export default function DashboardUser() {
  const { profile, favorites, inquiries } = useAppState();
  const { user, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(profile);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      store.showToast('Nama tidak boleh kosong.', 'error');
      return;
    }
    store.updateProfile({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: (form.address ?? '').trim(),
      coords: form.coords ?? null,
    });
  };

  const stats = [
    { icon: Heart, label: 'Favorit tersimpan', value: favorites.length, to: '/favorit' },
    { icon: Send, label: 'Pesan terkirim', value: inquiries.length, to: '/properti' },
    { icon: Store, label: 'Status akun', value: 'Pembeli', to: '/jadi-penjual' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-900 text-lg font-bold text-white">
          {profile.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl">{profile.name}</h1>
          <p className="truncate text-sm text-slate-500">{user?.email || profile.email || 'Email belum diisi'}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Masuk sebagai akun terverifikasi
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <stat.icon className="mb-3 h-5 w-5 text-emerald-900" />
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <User className="h-4 w-4" />
            Data profil
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            Nama dan nomor telepon ini dipakai otomatis saat Anda mengirim permintaan ke penjual.
          </p>

          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Nama lengkap</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nama Anda"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Mail className="h-3.5 w-3.5" />
                Email akun
              </span>
              <input
                type="email"
                className={`${inputClass} cursor-not-allowed text-slate-500`}
                value={user?.email ?? form.email}
                readOnly
                aria-describedby="email-bantuan"
              />
              <span id="email-bantuan" className="mt-1 block text-xs text-slate-400">
                Email dipakai untuk masuk dan tidak bisa diubah dari sini.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <Phone className="h-3.5 w-3.5" />
                Telepon
              </span>
              <input
                className={inputClass}
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="0812-3456-7890"
              />
            </label>

            <div className="sm:col-span-2">
              <AddressPicker
                address={form.address ?? ''}
                coords={form.coords ?? null}
                onAddressChange={(value) => setForm((previous) => ({ ...previous, address: value }))}
                onCoordsChange={(value) => setForm((previous) => ({ ...previous, coords: value }))}
                label="Alamat lengkap"
                inputClassName={inputClass}
                placeholder="Alamat lengkap domisili"
                hint="Dipakai untuk menampilkan jarak properti ke lokasi Anda."
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
              >
                Simpan Profil
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Ingin berjualan?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Lengkapi kriteria penjual untuk memasang iklan properti dan mengelola pesan calon pembeli.
            </p>
            <Link
              to="/jadi-penjual"
              className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              Jadi Penjual
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="font-semibold text-slate-900">Data akun</h2>
            <p className="mt-1 text-sm text-slate-500">
              Iklan, favorit, dan pesan milik akun ini tersimpan di peramban ini. Menghapusnya tidak memengaruhi akun
              Anda.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Hapus semua iklan, favorit, dan pesan milik akun ini? Tindakan ini tidak bisa dibatalkan.')) {
                  store.resetAccountData();
                }
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              Kosongkan data akun
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">Sesi</h2>
            <p className="mt-1 text-sm text-slate-500">Keluar dari akun ini di peramban yang sedang dipakai.</p>
            <button
              type="button"
              onClick={() => {
                void signOutUser().then(() => {
                  store.showToast('Anda telah keluar.', 'info');
                  navigate('/');
                });
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
