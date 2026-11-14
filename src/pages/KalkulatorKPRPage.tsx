import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Info } from 'lucide-react';
import { formatNumberInput, formatRupiah, parseNumberInput } from '../lib/format';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

export default function KalkulatorKPRPage() {
  const [price, setPrice] = useState(1_500_000_000);
  const [dpPercent, setDpPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(7.5);
  const [tenure, setTenure] = useState(15);

  const result = useMemo(() => {
    const downPayment = Math.round((price * dpPercent) / 100);
    const principal = Math.max(0, price - downPayment);
    const months = Math.max(1, Math.round(tenure * 12));
    const monthlyRate = interestRate / 100 / 12;

    let monthly: number;
    if (monthlyRate <= 0) {
      monthly = principal / months;
    } else {
      const factor = Math.pow(1 + monthlyRate, months);
      monthly = (principal * monthlyRate * factor) / (factor - 1);
    }

    const total = monthly * months;
    return {
      downPayment,
      principal,
      months,
      monthly,
      total,
      interest: total - principal,
      valid: price > 0 && principal > 0 && Number.isFinite(monthly),
    };
  }, [price, dpPercent, interestRate, tenure]);

  const warnings: string[] = [];
  if (dpPercent < 10) warnings.push('Uang muka di bawah 10% umumnya ditolak bank dan dikenakan bunga lebih tinggi.');
  if (tenure > 25) warnings.push('Tenor di atas 25 tahun jarang disetujui untuk KPR rumah pertama.');
  if (interestRate > 15) warnings.push('Bunga di atas 15% membuat total bunga hampir menyamai harga rumah.');

  const interestShare = result.valid ? Math.round((result.interest / result.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900 text-white">
          <Calculator className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Kalkulator KPR</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hitung cicilan bulanan berdasarkan harga properti, uang muka, bunga, dan tenor.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="kpr-price">
                Harga properti
              </label>
              <input
                id="kpr-price"
                className={inputClass}
                inputMode="numeric"
                value={formatNumberInput(price)}
                onChange={(event) => setPrice(parseNumberInput(event.target.value))}
                placeholder="1.500.000.000"
              />
              <p className="mt-1 text-xs text-slate-400">{formatRupiah(price)}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label className="text-sm font-medium text-slate-700" htmlFor="kpr-dp">
                  Uang muka
                </label>
                <span className="text-sm font-semibold text-emerald-900">
                  {dpPercent}% · {formatRupiah(result.downPayment)}
                </span>
              </div>
              <input
                id="kpr-dp"
                type="range"
                min={0}
                max={70}
                step={1}
                value={dpPercent}
                onChange={(event) => setDpPercent(Number(event.target.value))}
                className="w-full accent-emerald-900"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[10, 20, 30, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDpPercent(preset)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      dpPercent === preset
                        ? 'border-emerald-900 bg-emerald-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-emerald-500'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="kpr-rate">
                  Suku bunga per tahun (%)
                </label>
                <input
                  id="kpr-rate"
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  className={inputClass}
                  value={interestRate}
                  onChange={(event) => setInterestRate(Math.max(0, Number(event.target.value) || 0))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="kpr-tenure">
                  Tenor (tahun)
                </label>
                <input
                  id="kpr-tenure"
                  type="number"
                  min={1}
                  max={35}
                  className={inputClass}
                  value={tenure}
                  onChange={(event) => setTenure(Math.min(35, Math.max(1, Number(event.target.value) || 1)))}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Tenor populer</label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 25].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTenure(preset)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      tenure === preset
                        ? 'border-emerald-900 bg-emerald-900 text-white'
                        : 'border-slate-200 text-slate-600 hover:border-emerald-500'
                    }`}
                  >
                    {preset} tahun
                  </button>
                ))}
              </div>
            </div>
          </div>

          {warnings.length > 0 && (
            <ul className="mt-6 space-y-2">
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl bg-emerald-900 p-6 text-center text-white shadow-sm">
              <p className="text-sm text-emerald-100">Estimasi cicilan bulanan</p>
              <p className="mt-2 text-3xl font-bold break-words">
                {result.valid ? formatRupiah(result.monthly) : '—'}
              </p>
              <p className="mt-1 text-xs text-emerald-100/80">
                selama {result.months} bulan ({tenure} tahun)
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold text-slate-900">Rincian</h2>
              <dl className="space-y-2.5 text-sm">
                {[
                  { label: 'Uang muka', value: result.downPayment },
                  { label: 'Pokok pinjaman', value: result.principal },
                  { label: 'Total pembayaran', value: result.total },
                  { label: 'Total bunga', value: result.interest },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="font-semibold text-slate-900">{formatRupiah(row.value)}</dd>
                  </div>
                ))}
              </dl>

              {result.valid && (
                <div className="mt-4">
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="bg-emerald-700" style={{ width: `${100 - interestShare}%` }} />
                    <div className="bg-amber-400" style={{ width: `${interestShare}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>Pokok {100 - interestShare}%</span>
                    <span>Bunga {interestShare}%</span>
                  </div>
                </div>
              )}
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Angka ini estimasi dasar dan belum menghitung biaya provisi, asuransi, pajak, serta kenaikan bunga
              floating. Konfirmasi simulasi resmi ke bank pilihan Anda.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
