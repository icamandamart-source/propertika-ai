import { Minus, Plus } from 'lucide-react';
import type { ChangeEvent } from 'react';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  compact?: boolean;
}

export default function QuantityStepper({ value, onChange, min = 1, max = 99, disabled, compact }: Props) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));

  const input = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value.replace(/\D/g, ''), 10);
    onChange(clamp(parsed || min));
  };

  return (
    <div className={`inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white ${disabled ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Kurangi jumlah"
        className={`flex items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        onChange={input}
        inputMode="numeric"
        aria-label="Jumlah"
        disabled={disabled}
        className={`border-x border-slate-200 bg-white text-center text-sm font-semibold text-slate-900 outline-none ${
          compact ? 'h-8 w-10' : 'h-10 w-14'
        }`}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Tambah jumlah"
        className={`flex items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
