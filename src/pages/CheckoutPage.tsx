import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  Truck,
} from 'lucide-react';
import AddressPicker from '../components/AddressPicker';
import EmptyState from '../components/EmptyState';
import SafeImage from '../components/SafeImage';
import { formatRupiah } from '../lib/format';
import {
  PAYMENT_METHODS,
  SHIPPING_METHODS,
  calculateTotals,
  hydrateCart,
  isVoucherExpired,
  shippingCost,
  storeNameOf,
  voucherEligible,
} from '../lib/marketplace';
import { newId, store, useAppState } from '../lib/store';
import type { Address, GeoCoords } from '../types';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

interface AddressForm {
  label: string;
  recipient: string;
  phone: string;
  detail: string;
  city: string;
  postalCode: string;
  coords: GeoCoords | null;
  isDefault: boolean;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, listings, addresses, profile, vouchers, isSignedIn, claimedVoucherCodes } = useAppState();

  const selectedLines = useMemo(
    () => hydrateCart(cart, listings).filter((line) => line.selected && line.qty > 0),
    [cart, listings],
  );
  const subtotal = selectedLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showForm, setShowForm] = useState(addresses.length === 0);
  const [shippingId, setShippingId] = useState('reg');
  const [paymentId, setPaymentId] = useState('transfer-bca');
  const [voucherCode, setVoucherCode] = useState('');
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState<AddressForm>({
    label: 'Rumah',
    recipient: profile.name === 'Tamu' ? '' : profile.name,
    phone: profile.phone,
    detail: profile.address ?? '',
    city: '',
    postalCode: '',
    coords: profile.coords ?? null,
    isDefault: addresses.length === 0,
  });

  const activeAddress =
    addresses.find((address) => address.id === selectedAddressId) ??
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null;

  const eligibleVouchers = vouchers.filter(
    (voucher) =>
      claimedVoucherCodes.includes(voucher.code) &&
      !isVoucherExpired(voucher) &&
      voucherEligible(voucher, subtotal),
  );
  const selectedVoucher = eligibleVouchers.find((voucher) => voucher.code === voucherCode) ?? null;
  const totals = calculateTotals(subtotal, shippingId, selectedVoucher);
  const stores = new Set(selectedLines.map((line) => storeNameOf(line.listing)));

  if (selectedLines.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          icon={ShoppingBag}
          title="Belum ada produk untuk checkout"
          description="Pilih minimal satu produk di keranjang, lalu lanjutkan ke pembayaran."
          action={
            <Link
              to="/keranjang"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              Buka keranjang
            </Link>
          }
        />
      </div>
    );
  }

  const saveAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!form.recipient.trim() || !form.phone.trim() || !form.detail.trim() || !form.city.trim()) {
      store.showToast('Lengkapi nama penerima, telepon, alamat, dan kota.', 'error');
      return;
    }
    const address: Address = {
      id: newId('addr'),
      label: form.label.trim() || 'Rumah',
      recipient: form.recipient.trim(),
      phone: form.phone.trim(),
      detail: form.detail.trim(),
      city: form.city.trim(),
      postalCode: form.postalCode.trim() || undefined,
      coords: form.coords,
      isDefault: form.isDefault || addresses.length === 0,
    };
    store.saveAddress(address);
    setSelectedAddressId(address.id);
    setShowForm(false);
  };

  const placeOrder = async () => {
    if (placing) return;
    if (!activeAddress) {
      store.showToast('Tambahkan alamat pengiriman terlebih dahulu.', 'error');
      return;
    }
    setPlacing(true);
    try {
      const result = await store.checkout({
        address: activeAddress,
        shippingMethodId: shippingId,
        paymentMethodId: paymentId,
        voucherCode: selectedVoucher?.code,
        note,
      });
      if (!result.ok) {
        store.showToast(result.error ?? 'Checkout gagal. Coba lagi.', 'error');
        return;
      }
      if (result.orderId) navigate(`/pesanan/${result.orderId}`);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-slate-500">
        <Link to="/keranjang" className="hover:text-brand-dark">
          Keranjang
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-semibold text-slate-800">Checkout</span>
        <ChevronRight className="h-3 w-3" />
        <span>Pesanan</span>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-brand" />
                Alamat Pengiriman
              </h2>
              {addresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowForm((value) => !value)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showForm ? 'Tutup form' : 'Alamat baru'}
                </button>
              )}
            </div>

            {addresses.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {addresses.map((address) => {
                  const active = activeAddress?.id === address.id;
                  return (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => setSelectedAddressId(address.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active ? 'border-brand bg-brand-soft/50' : 'border-slate-200 hover:border-brand'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {address.label}
                          </span>
                          {address.isDefault && (
                            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">
                              Utama
                            </span>
                          )}
                        </span>
                        {active && <Check className="h-4 w-4 text-brand" />}
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium text-slate-800">
                        {address.recipient} · {address.phone}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                        {address.detail}, {address.city} {address.postalCode ?? ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {(showForm || addresses.length === 0) && (
              <form onSubmit={saveAddress} className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-2">
                <input
                  value={form.label}
                  onChange={(event) => setForm({ ...form, label: event.target.value })}
                  placeholder="Label (Rumah/Kantor)"
                  aria-label="Label alamat"
                  className={inputClass}
                />
                <input
                  value={form.recipient}
                  onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                  placeholder="Nama penerima"
                  aria-label="Nama penerima"
                  className={inputClass}
                />
                <input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  placeholder="Nomor telepon"
                  aria-label="Nomor telepon"
                  inputMode="tel"
                  className={inputClass}
                />
                <input
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  placeholder="Kota / kabupaten"
                  aria-label="Kota"
                  className={inputClass}
                />
                <div className="sm:col-span-2">
                  <AddressPicker
                    address={form.detail}
                    coords={form.coords}
                    onAddressChange={(value) => setForm((previous) => ({ ...previous, detail: value }))}
                    onCoordsChange={(value) => setForm((previous) => ({ ...previous, coords: value }))}
                    onCityChange={(value) => setForm((previous) => ({ ...previous, city: value }))}
                    onPostalCodeChange={(value) =>
                      setForm((previous) => ({ ...previous, postalCode: value }))
                    }
                    label="Alamat lengkap"
                    placeholder="Alamat lengkap, patokan, nomor rumah"
                    inputClassName={inputClass}
                    hint="Gunakan lokasi saya untuk mengisi alamat otomatis, atau ketik manual."
                  />
                </div>
                <input
                  value={form.postalCode}
                  onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                  placeholder="Kode pos (opsional)"
                  aria-label="Kode pos"
                  inputMode="numeric"
                  className={inputClass}
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Jadikan alamat utama
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark sm:col-span-2"
                >
                  Simpan alamat
                </button>
              </form>
            )}

            {!isSignedIn && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Anda checkout sebagai tamu. Pesanan tetap tersimpan di perangkat ini.{' '}
                <Link to="/masuk" className="font-semibold underline">
                  Masuk
                </Link>{' '}
                agar pesanan masuk ke akun Anda.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
              <Truck className="h-4 w-4 text-brand" />
              Metode Pengiriman
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SHIPPING_METHODS.map((method) => {
                const cost = shippingCost(method.id, subtotal);
                const active = shippingId === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setShippingId(method.id)}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition ${
                      active ? 'border-brand bg-brand-soft/50' : 'border-slate-200 hover:border-brand'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">
                        {method.label} · {method.eta}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{method.description}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold ${cost === 0 ? 'text-green-600' : 'text-slate-700'}`}>
                      {cost === 0 ? 'Gratis' : formatRupiah(cost)}
                    </span>
                  </button>
                );
              })}
            </div>
            {subtotal >= 5_000_000 && (
              <p className="mt-2 text-[11px] font-medium text-green-700">
                Selamat! Belanja Anda memenuhi syarat gratis ongkir reguler.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
              <CreditCard className="h-4 w-4 text-brand" />
              Metode Pembayaran
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PAYMENT_METHODS.map((method) => {
                const active = paymentId === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentId(method.id)}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition ${
                      active ? 'border-brand bg-brand-soft/50' : 'border-slate-200 hover:border-brand'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{method.label}</p>
                      <p className="text-[11px] text-slate-500">{method.detail}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-brand" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
              <TicketPercent className="h-4 w-4 text-brand" />
              Voucher &amp; Catatan
            </h2>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Voucher</span>
              <select
                value={voucherCode}
                onChange={(event) => setVoucherCode(event.target.value)}
                className={inputClass}
              >
                <option value="">Tanpa voucher</option>
                {eligibleVouchers.map((voucher) => (
                  <option key={voucher.code} value={voucher.code}>
                    {voucher.code} — {voucher.title}
                    {claimedVoucherCodes.includes(voucher.code) ? ' (tersimpan)' : ''}
                  </option>
                ))}
              </select>
              {eligibleVouchers.length === 0 && (
                <span className="mt-1 block text-[11px] text-slate-400">
                  Belum ada voucher yang memenuhi syarat. Lihat{' '}
                  <Link to="/voucher" className="font-semibold text-brand-dark underline">
                    pusat voucher
                  </Link>
                  .
                </span>
              )}
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Catatan untuk penjual</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Contoh: kirim setelah jam 17.00"
                className={`${inputClass} resize-y`}
              />
            </label>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Ringkasan Pesanan</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {selectedLines.length} produk dari {stores.size} toko
            </p>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedLines.map((line) => (
                <div key={line.id} className="flex gap-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200">
                    <SafeImage
                      src={line.listing.imageUrl}
                      alt={line.listing.title}
                      category={line.listing.category}
                      seed={line.listing.id}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-[11px] font-medium text-slate-800">{line.listing.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {line.qty} × {formatRupiah(line.unitPrice)}
                      {line.variation ? ` · ${line.variation}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-800">
                    {formatRupiah(line.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Subtotal produk</dt>
                <dd className="font-medium text-slate-800">{formatRupiah(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Voucher {selectedVoucher?.code}</dt>
                  <dd className="font-medium text-green-600">-{formatRupiah(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Ongkos kirim</dt>
                <dd className="font-medium text-slate-800">
                  {totals.shipping === 0 ? 'Gratis' : formatRupiah(totals.shipping)}
                </dd>
              </div>
              {totals.cashback > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Cashback</dt>
                  <dd className="font-medium text-brand-dark">{formatRupiah(totals.cashback)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-medium text-slate-700">Total bayar</span>
              <span className="text-lg font-black text-brand">{formatRupiah(totals.total)}</span>
            </div>

            <button
              type="button"
              onClick={placeOrder}
              disabled={!activeAddress || placing}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placing ? 'Memproses…' : 'Buat Pesanan'}
            </button>

            {!activeAddress && (
              <p className="mt-2 text-center text-[11px] text-rose-500">Tambahkan alamat untuk melanjutkan.</p>
            )}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              Transaksi dilindungi Propertika
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
