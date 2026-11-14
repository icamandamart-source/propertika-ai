import { useState } from 'react';
import {
  Calculator,
  Check,
  CheckSquare,
  Copy,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type { RabItem } from '../types';
import { formatRupiah } from '../lib/format';

interface Props {
  items: RabItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (item: Omit<RabItem, 'id' | 'included'>) => void;
  onToggleAll: (included: boolean) => void;
  panjang: number;
  lebar: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Furniture: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Elektronik: 'bg-blue-50 text-blue-700 border-blue-200',
  Dekorasi: 'bg-purple-50 text-purple-700 border-purple-200',
  'Finishing & Cat': 'bg-amber-50 text-amber-700 border-amber-200',
  Struktur: 'bg-rose-50 text-rose-700 border-rose-200',
  Jasa: 'bg-slate-100 text-slate-700 border-slate-300',
};

export default function RabEstimator({
  items,
  onToggleItem,
  onDeleteItem,
  onAddItem,
  onToggleAll,
  panjang,
  lebar,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newCategory, setNewCategory] = useState<RabItem['category']>('Furniture');

  const luas = Number((panjang * lebar).toFixed(1));
  const selectedItems = items.filter((item) => item.included);
  const totalSelected = selectedItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalAll = items.reduce((acc, item) => acc + item.price * item.qty, 0);
  const totalSavings = totalAll - totalSelected;

  const handleCopy = async () => {
    const lines = [
      `=== ESTIMASI RAB PROPERTIKA AI ===`,
      `Ukuran Ruangan: ${panjang} m x ${lebar} m (${luas} m²)`,
      `Tanggal: ${new Date().toLocaleDateString('id-ID')}`,
      ``,
      `--- DAFTAR RINCIAN BARANG & BIAYA ---`,
      ...selectedItems.map(
        (item, index) =>
          `${index + 1}. [${item.category}] ${item.name} (${item.qty} ${item.unit}) : ${formatRupiah(item.price * item.qty)}`,
      ),
      ``,
      `---------------------------------------`,
      `TOTAL ESTIMASI RAB: ${formatRupiah(totalSelected)}`,
      `Barang terpilih: ${selectedItems.length} dari ${items.length} item`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(newPrice.replace(/[^0-9]/g, ''));
    if (!newName.trim() || priceNum <= 0) return;

    onAddItem({
      name: newName.trim(),
      category: newCategory,
      price: priceNum,
      qty: Math.max(1, Number(newQty) || 1),
      unit: 'unit',
    });

    setNewName('');
    setNewPrice('');
    setNewQty('1');
    setShowAddForm(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-900 text-white">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Estimasi RAB & Rincian Harga</h3>
            <p className="text-xs text-slate-500">
              Rencana Anggaran Biaya interior & renovasi ({panjang}m × {lebar}m = {luas} m²)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Tersalin!' : 'Salin RAB'}
          </button>
        </div>
      </div>

      {/* Ringkasan Total RAB */}
      <div className="my-4 rounded-xl border border-emerald-900/15 bg-gradient-to-r from-emerald-950 to-emerald-900 p-4 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-medium text-emerald-200">Total Estimasi Anggaran (RAB)</span>
            <div className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {formatRupiah(totalSelected)}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full bg-emerald-800/80 px-2.5 py-1 text-xs font-semibold text-emerald-100">
              {selectedItems.length} dari {items.length} barang terpilih
            </span>
            {totalSavings > 0 && (
              <p className="mt-1 text-xs text-emerald-300">
                Hemat {formatRupiah(totalSavings)} dari barang yang dicancel
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar Seleksi & Tambah */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleAll(true)}
            className="text-slate-500 hover:text-emerald-800 underline font-medium"
          >
            Pilih Semua
          </button>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => onToggleAll(false)}
            className="text-slate-500 hover:text-red-700 underline font-medium"
          >
            Batalkan Semua
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-900 border border-emerald-200 hover:bg-emerald-100 transition"
        >
          {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showAddForm ? 'Tutup Form' : '+ Tambah Barang'}
        </button>
      </div>

      {/* Form Tambah Item Custom */}
      {showAddForm && (
        <form onSubmit={handleAddNewItem} className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
          <h4 className="mb-2 text-xs font-bold text-slate-800">Tambah Item / Biaya Baru</h4>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
            <input
              type="text"
              placeholder="Nama barang / jasa"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-600"
              required
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as RabItem['category'])}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-600"
            >
              <option value="Furniture">Furniture</option>
              <option value="Elektronik">Elektronik</option>
              <option value="Dekorasi">Dekorasi</option>
              <option value="Finishing & Cat">Finishing & Cat</option>
              <option value="Struktur">Struktur</option>
              <option value="Jasa">Jasa</option>
            </select>
            <input
              type="number"
              placeholder="Harga (Rp)"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-emerald-600"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition"
            >
              Simpan Item
            </button>
          </div>
        </form>
      )}

      {/* Daftar Item RAB */}
      <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => {
          const itemTotal = item.price * item.qty;
          const badgeClass = CATEGORY_COLORS[item.category] ?? 'bg-slate-100 text-slate-700 border-slate-200';

          return (
            <div
              key={item.id}
              className={`group flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                item.included
                  ? 'border-slate-200 bg-slate-50/60 hover:border-emerald-400 hover:bg-white'
                  : 'border-slate-100 bg-slate-100/50 opacity-60'
              }`}
            >
              {/* Checkbox & Details */}
              <div
                className="flex flex-1 cursor-pointer items-start gap-2.5 select-none"
                onClick={() => onToggleItem(item.id)}
              >
                <button
                  type="button"
                  aria-label={item.included ? 'Batalkan item' : 'Pilih item'}
                  className="mt-0.5 text-emerald-800 transition shrink-0"
                >
                  {item.included ? (
                    <CheckSquare className="h-4.5 w-4.5 fill-emerald-900 text-white" />
                  ) : (
                    <Square className="h-4.5 w-4.5 text-slate-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-sm font-semibold transition ${
                        item.included ? 'text-slate-900' : 'text-slate-400 line-through'
                      }`}
                    >
                      {item.name}
                    </span>
                    {!item.included && (
                      <span className="rounded bg-red-100 px-1.5 py-0.2 text-[10px] font-semibold text-red-700">
                        Dibatalkan
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`rounded-full border px-2 py-0.2 text-[10px] font-medium ${badgeClass}`}>
                      {item.category}
                    </span>
                    <span>
                      {item.qty} {item.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Harga & Aksi */}
              <div className="flex items-center gap-2.5 shrink-0 text-right">
                <div>
                  <div
                    className={`text-sm font-bold ${
                      item.included ? 'text-emerald-900' : 'text-slate-400 line-through'
                    }`}
                  >
                    {formatRupiah(itemTotal)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  title="Hapus item permanen"
                  className="rounded-lg p-1.5 text-slate-400 opacity-60 transition hover:bg-red-50 hover:text-red-600 hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Petunjuk Interaktif */}
      <div className="mt-3.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
        💡 <em>Klik kotak centang barang untuk membatalkan item yang belum dibutuhkan, total anggaran akan otomatis menyesuaikan.</em>
      </div>
    </div>
  );
}
