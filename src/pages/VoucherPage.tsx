import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, TicketPercent, TicketX } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import VoucherCard from '../components/VoucherCard';
import { isVoucherExpired } from '../lib/marketplace';
import { store, useAppState } from '../lib/store';

export default function VoucherPage() {
  const { vouchers, claimedVoucherCodes } = useAppState();
  const [tab, setTab] = useState<'tersedia' | 'saya'>('tersedia');
  const [code, setCode] = useState('');

  const activeVouchers = vouchers.filter((voucher) => !isVoucherExpired(voucher));
  const myVouchers = vouchers.filter((voucher) => claimedVoucherCodes.includes(voucher.code));
  const shown = tab === 'tersedia' ? activeVouchers : myVouchers;

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    const found = vouchers.find((voucher) => voucher.code.toUpperCase() === normalized);
    if (!found) {
      store.showToast('Kode voucher tidak ditemukan.', 'error');
      return;
    }
    if (isVoucherExpired(found)) {
      store.showToast('Voucher ini sudah kedaluwarsa.', 'error');
      return;
    }
    store.claimVoucher(normalized);
    setCode('');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl navy-gradient p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Pusat Voucher</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Klaim promo, hemat lebih banyak</h1>
            <p className="mt-1 max-w-xl text-xs leading-5 text-white/75">
              Diskon belanja, gratis ongkir, dan cashback untuk properti maupun perabot rumah pilihan.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <p className="text-lg font-black">{activeVouchers.length}</p>
              <p className="text-[10px] text-white/70">Tersedia</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
              <p className="text-lg font-black">{myVouchers.length}</p>
              <p className="text-[10px] text-white/70">Saya klaim</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submitCode} className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <TicketPercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Punya kode voucher? Masukkan di sini"
            aria-label="Kode voucher"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold uppercase tracking-wide text-slate-800 outline-none transition placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:border-emerald-500 focus:bg-white"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Klaim Kode
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('tersedia')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === 'tersedia' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-soft'
            }`}
          >
            Voucher tersedia
          </button>
          <button
            type="button"
            onClick={() => setTab('saya')}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === 'saya' ? 'bg-brand text-white' : 'text-slate-600 hover:bg-brand-soft'
            }`}
          >
            Koleksi saya ({myVouchers.length})
          </button>
        </div>
        <Link to="/flash-sale" className="hidden items-center gap-1 text-xs font-semibold text-brand-dark hover:underline sm:inline-flex">
          Belanja flash sale
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={tab === 'saya' ? TicketX : TicketPercent}
            title={tab === 'saya' ? 'Belum ada voucher yang diklaim' : 'Belum ada voucher aktif'}
            description={
              tab === 'saya'
                ? 'Klaim voucher dari daftar tersedia atau masukkan kode promo di atas.'
                : 'Voucher baru akan muncul di sini saat kampanye promo dibuka.'
            }
            action={
              <button
                type="button"
                onClick={() => setTab('tersedia')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                <BadgeCheck className="h-4 w-4" />
                Lihat voucher tersedia
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              claimed={claimedVoucherCodes.includes(voucher.code)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-[11px] leading-5 text-slate-500">
        <p className="font-semibold text-slate-700">Syarat singkat</p>
        <p>
          Satu voucher dipakai untuk satu transaksi. Voucher ongkir hanya mengurangi biaya kirim, sedangkan cashback
          dicatat pada rincian pesanan setelah transaksi selesai. Voucher tidak dapat digabung kecuali dinyatakan lain.
        </p>
      </div>
    </div>
  );
}
