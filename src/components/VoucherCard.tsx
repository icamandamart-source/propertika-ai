import { BadgeCheck, Coins, TicketPercent, Truck } from 'lucide-react';
import type { Voucher } from '../types';
import { formatDate, formatRupiah } from '../lib/format';
import { isVoucherExpired } from '../lib/marketplace';
import { store } from '../lib/store';

const TONE = {
  brand: 'bg-brand text-white',
  navy: 'bg-navy text-white',
  amber: 'bg-amber-400 text-amber-950',
  rose: 'bg-rose-500 text-white',
} as const;

const ICONS = {
  ongkir: Truck,
  diskon: TicketPercent,
  cashback: Coins,
} as const;

interface Props {
  voucher: Voucher;
  claimed?: boolean;
  compact?: boolean;
  showClaim?: boolean;
  onClaim?: () => void;
}

export default function VoucherCard({ voucher, claimed, compact, showClaim = true, onClaim }: Props) {
  const Icon = ICONS[voucher.type];
  const expired = isVoucherExpired(voucher);
  const tone = TONE[voucher.color ?? 'brand'];

  const valueText =
    voucher.type === 'ongkir'
      ? `s/d ${formatRupiah(voucher.amount)}`
      : voucher.percent
        ? `${voucher.percent}%`
        : formatRupiah(voucher.amount);

  return (
    <article
      className={`relative flex overflow-hidden rounded-xl border bg-white shadow-sm ${
        expired ? 'border-slate-200 opacity-70' : 'border-slate-200'
      } ${compact ? 'min-w-[260px] sm:min-w-[290px]' : ''}`}
    >
      <div className={`flex w-20 shrink-0 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center ${tone}`}>
        <Icon className="h-5 w-5" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{voucher.type}</span>
        <span className="text-xs font-black leading-tight">{valueText}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-sm font-semibold text-slate-900">{voucher.title}</p>
            <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark">
              {voucher.code}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{voucher.description}</p>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400">
              Min. {formatRupiah(voucher.minSpend)} · s/d {formatDate(`${voucher.expiry}T00:00:00.000Z`)}
            </p>
            <p className="line-clamp-1 text-[10px] font-medium text-slate-500">{voucher.storeName ?? 'Semua Toko'}</p>
          </div>

          {showClaim && (
            <button
              type="button"
              disabled={claimed || expired}
              onClick={() => {
                if (onClaim) onClaim();
                else store.claimVoucher(voucher.code);
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                claimed || expired
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-brand text-white hover:bg-brand-dark'
              }`}
            >
              {claimed ? (
                <>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Tersimpan
                </>
              ) : expired ? (
                'Berakhir'
              ) : (
                'Klaim'
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
