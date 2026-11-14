import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  Trash2,
  User,
} from 'lucide-react';
import AddressPicker from '../components/AddressPicker';
import { formatDate, formatRupiah } from '../lib/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '../lib/marketplace';
import { useAuth } from '../lib/auth';
import { newId, store, useAppState } from '../lib/store';
import type { Address, GeoCoords, Profile } from '../types';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

type Tab = 'ringkasan' | 'profil' | 'alamat';

interface AddressDraft {
  id?: string;
  label: string;
  recipient: string;
  phone: string;
  detail: string;
  city: string;
  postalCode: string;
  coords: GeoCoords | null;
  isDefault: boolean;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, signOutUser } = useAuth();
  const { profile, role, seller, addresses, orders, favorites, claimedVoucherCodes, cartCount, isSignedIn } =
    useAppState();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'profil' || tabParam === 'alamat' ? tabParam : 'ringkasan';

  const [profileForm, setProfileForm] = useState<Profile>(profile);
  const [addressDraft, setAddressDraft] = useState<AddressDraft | null>(null);

  useEffect(() => {
    setProfileForm(profile);
  }, [profile]);

  const setTab = (next: Tab) => {
    const nextParams = new URLSearchParams(params);
    if (next === 'ringkasan') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setParams(nextParams, { replace: true });
  };

  const stats = [
    { icon: Package, label: 'Pesanan', value: orders.length, to: '/pesanan' },
    { icon: Heart, label: 'Favorit', value: favorites.length, to: '/favorit' },
    { icon: TicketPercent, label: 'Voucher', value: claimedVoucherCodes.length, to: '/voucher' },
    { icon: ShoppingBag, label: 'Keranjang', value: cartCount, to: '/keranjang' },
  ];

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (!isSignedIn) {
      store.showToast('Masuk dulu untuk menyimpan profil.', 'info');
      return;
    }
    if (!profileForm.name.trim()) {
      store.showToast('Nama tidak boleh kosong.', 'error');
      return;
    }
    store.updateProfile({
      ...profileForm,
      name: profileForm.name.trim(),
      email: user?.email || profileForm.email,
      phone: profileForm.phone.trim(),
      address: (profileForm.address ?? '').trim(),
      coords: profileForm.coords ?? null,
    });
  };

  const startNewAddress = () => {
    setAddressDraft({
      label: 'Rumah',
      recipient: profile.name === 'Tamu' ? '' : profile.name,
      phone: profile.phone,
      detail: profile.address ?? '',
      city: '',
      postalCode: '',
      coords: profile.coords ?? null,
      isDefault: addresses.length === 0,
    });
  };

  const startEditAddress = (address: Address) => {
    setAddressDraft({
      id: address.id,
      label: address.label,
      recipient: address.recipient,
      phone: address.phone,
      detail: address.detail,
      city: address.city,
      postalCode: address.postalCode ?? '',
      coords: address.coords ?? null,
      isDefault: address.isDefault,
    });
  };

  const saveAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!addressDraft) return;
    if (!addressDraft.recipient.trim() || !addressDraft.phone.trim() || !addressDraft.detail.trim() || !addressDraft.city.trim()) {
      store.showToast('Lengkapi nama penerima, telepon, alamat, dan kota.', 'error');
      return;
    }
    store.saveAddress({
      id: addressDraft.id ?? newId('addr'),
      label: addressDraft.label.trim() || 'Rumah',
      recipient: addressDraft.recipient.trim(),
      phone: addressDraft.phone.trim(),
      detail: addressDraft.detail.trim(),
      city: addressDraft.city.trim(),
      postalCode: addressDraft.postalCode.trim() || undefined,
      coords: addressDraft.coords,
      isDefault: addressDraft.isDefault || addresses.length === 0,
    });
    setAddressDraft(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-lg font-bold text-white">
            {profile.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              {isSignedIn ? profile.name : 'Tamu Propertika'}
            </h1>
            <p className="truncate text-xs text-slate-500">
              {user?.email || profile.email || 'Belum masuk Â· pesanan tamu tetap tersimpan'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
                <ShieldCheck className="h-3 w-3" />
                {role === 'seller' ? 'Akun Penjual' : isSignedIn ? 'Akun Pembeli' : 'Mode Tamu'}
              </span>
              {seller?.businessName && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {seller.businessName}
                </span>
              )}
            </div>
          </div>

          {isSignedIn ? (
            <button
              type="button"
              onClick={() => {
                void signOutUser().then(() => {
                  store.showToast('Anda telah keluar.', 'info');
                  navigate('/');
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </button>
          ) : (
            <Link
              to="/masuk?next=%2Fakun"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              Masuk / Daftar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              className="rounded-xl border border-slate-200 p-3 transition hover:border-brand hover:bg-brand-soft/40"
            >
              <stat.icon className="h-4 w-4 text-brand" />
              <p className="mt-1.5 text-lg font-bold text-slate-900">{stat.value}</p>
              <p className="text-[11px] text-slate-500">{stat.label}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {[
          { id: 'ringkasan', label: 'Ringkasan' },
          { id: 'profil', label: 'Profil' },
          { id: 'alamat', label: `Alamat (${addresses.length})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as Tab)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === item.id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-soft'
            }`}
          >
            {item.label}
          </button>
        ))}
        <Link
          to="/pesanan"
          className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand-soft"
        >
          Pesanan
        </Link>
      </div>

      <div className="mt-3">
        {tab === 'ringkasan' && (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">Pesanan Terbaru</h2>
                <Link to="/pesanan" className="text-[11px] font-semibold text-brand-dark hover:underline">
                  Lihat semua
                </Link>
              </div>

              {orders.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 py-8 text-center">
                  <Package className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-xs text-slate-500">Belum ada pesanan.</p>
                  <Link
                    to="/properti"
                    className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Mulai belanja
                  </Link>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {orders.slice(0, 4).map((order) => (
                    <Link key={order.id} to={`/pesanan/${order.id}`} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{order.code}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatDate(order.createdAt)} Â· {order.items.length} produk
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ORDER_STATUS_TONE[order.status]
                        }`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-brand">{formatRupiah(order.total)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-3">
              <Link
                to="/voucher"
                className="flex items-center justify-between rounded-2xl border border-dashed border-brand-soft-2 bg-brand-soft/50 p-4 text-xs font-semibold text-brand-dark transition hover:bg-brand-soft"
              >
                <span className="inline-flex items-center gap-2">
                  <TicketPercent className="h-4 w-4" />
                  Voucher saya ({claimedVoucherCodes.length})
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {role !== 'seller' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Store className="h-4 w-4 text-brand" />
                    Ingin berjualan?
                  </h2>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Pasang iklan properti atau produk rumah dan kelola pesanan dari dashboard penjual.
                  </p>
                  <Link
                    to="/jadi-penjual"
                    className="mt-3 inline-block rounded-lg bg-brand px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Jadi Penjual
                  </Link>
                </div>
              )}

              {isSignedIn && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-semibold text-slate-900">Data akun</h2>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                    Menghapus data tidak menghapus akun Firebase Anda.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Hapus semua listing, favorit, pesan, keranjang, alamat, dan voucher akun ini?')) {
                        store.resetAccountData();
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Kosongkan data akun
                  </button>
                </div>
              )}
            </aside>
          </div>
        )}

        {tab === 'profil' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <User className="h-4 w-4 text-brand" />
              Data Profil
            </h2>

            {!isSignedIn ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-800">Masuk untuk mengatur profil</p>
                <p className="mt-1 text-xs text-slate-500">
                  Nama, telepon, dan alamat otomatis dipakai saat checkout dan menghubungi penjual.
                </p>
                <Link
                  to="/masuk?next=%2Fakun%3Ftab%3Dprofil"
                  className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                >
                  Masuk / Daftar
                </Link>
              </div>
            ) : (
              <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-700">Nama lengkap</span>
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                    placeholder="Nama Anda"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Mail className="h-3.5 w-3.5" />
                    Email akun
                  </span>
                  <input
                    value={user?.email ?? profileForm.email}
                    readOnly
                    className={`${inputClass} cursor-not-allowed text-slate-500`}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Phone className="h-3.5 w-3.5" />
                    Telepon
                  </span>
                  <input
                    value={profileForm.phone}
                    onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                    inputMode="tel"
                    placeholder="0812-3456-7890"
                    className={inputClass}
                  />
                </label>

                <div className="sm:col-span-2">
                  <AddressPicker
                    address={profileForm.address ?? ''}
                    coords={profileForm.coords ?? null}
                    onAddressChange={(value) =>
                      setProfileForm((previous) => ({ ...previous, address: value }))
                    }
                    onCoordsChange={(value) =>
                      setProfileForm((previous) => ({ ...previous, coords: value }))
                    }
                    label="Alamat domisili"
                    inputClassName={inputClass}
                    hint="Dipakai untuk menampilkan jarak properti ke lokasi Anda."
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Simpan Profil
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {tab === 'alamat' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-brand" />
                Alamat Pengiriman
              </h2>
              {!addressDraft && (
                <button
                  type="button"
                  onClick={startNewAddress}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah alamat
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {isSignedIn
                ? 'Alamat utama dipakai otomatis saat checkout.'
                : 'Alamat tamu tersimpan di perangkat ini dan ikut pindah saat Anda masuk.'}
            </p>

            {addressDraft && (
              <form onSubmit={saveAddress} className="mt-4 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-2">
                <input
                  value={addressDraft.label}
                  onChange={(event) => setAddressDraft({ ...addressDraft, label: event.target.value })}
                  placeholder="Label (Rumah/Kantor)"
                  aria-label="Label alamat"
                  className={inputClass}
                />
                <input
                  value={addressDraft.recipient}
                  onChange={(event) => setAddressDraft({ ...addressDraft, recipient: event.target.value })}
                  placeholder="Nama penerima"
                  aria-label="Nama penerima"
                  className={inputClass}
                />
                <input
                  value={addressDraft.phone}
                  onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })}
                  placeholder="Nomor telepon"
                  aria-label="Nomor telepon"
                  inputMode="tel"
                  className={inputClass}
                />
                <input
                  value={addressDraft.city}
                  onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })}
                  placeholder="Kota / kabupaten"
                  aria-label="Kota"
                  className={inputClass}
                />
                <div className="sm:col-span-2">
                  <AddressPicker
                    address={addressDraft.detail}
                    coords={addressDraft.coords}
                    onAddressChange={(value) =>
                      setAddressDraft((previous) => (previous ? { ...previous, detail: value } : previous))
                    }
                    onCoordsChange={(value) =>
                      setAddressDraft((previous) => (previous ? { ...previous, coords: value } : previous))
                    }
                    onCityChange={(value) =>
                      setAddressDraft((previous) => (previous ? { ...previous, city: value } : previous))
                    }
                    onPostalCodeChange={(value) =>
                      setAddressDraft((previous) =>
                        previous ? { ...previous, postalCode: value } : previous,
                      )
                    }
                    label="Alamat lengkap"
                    placeholder="Alamat lengkap, patokan, nomor rumah"
                    inputClassName={inputClass}
                    hint="Gunakan lokasi saya untuk mengisi alamat otomatis, atau ketik manual."
                  />
                </div>
                <input
                  value={addressDraft.postalCode}
                  onChange={(event) => setAddressDraft({ ...addressDraft, postalCode: event.target.value })}
                  placeholder="Kode pos (opsional)"
                  aria-label="Kode pos"
                  inputMode="numeric"
                  className={inputClass}
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={addressDraft.isDefault}
                    onChange={(event) => setAddressDraft({ ...addressDraft, isDefault: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Jadikan alamat utama
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                  >
                    Simpan alamat
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressDraft(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {addresses.length === 0 && !addressDraft ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-200 py-8 text-center">
                <MapPin className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">Belum ada alamat tersimpan.</p>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className={`rounded-xl border p-3 ${
                      address.isDefault ? 'border-brand bg-brand-soft/40' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {address.label}
                        </span>
                        {address.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <Check className="h-2.5 w-2.5" />
                            Utama
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditAddress(address)}
                          aria-label="Ubah alamat"
                          className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-brand-dark"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Hapus alamat ini?')) store.removeAddress(address.id);
                          }}
                          aria-label="Hapus alamat"
                          className="rounded p-1 text-slate-400 transition hover:bg-white hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-800">
                      {address.recipient} Â· {address.phone}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                      {address.detail}, {address.city} {address.postalCode ?? ''}
                    </p>
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => store.setDefaultAddress(address.id)}
                        className="mt-2 text-[11px] font-semibold text-brand-dark hover:underline"
                      >
                        Jadikan alamat utama
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

