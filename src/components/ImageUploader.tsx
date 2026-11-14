import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { compressImage } from '../lib/image';

interface Props {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  hint?: string;
  previewClassName?: string;
}

export default function ImageUploader({
  value,
  onChange,
  label = 'Unggah gambar',
  hint = 'JPG atau PNG. Gambar diperkecil otomatis agar hemat penyimpanan.',
  previewClassName = 'max-h-72',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Berkas harus berupa gambar (JPG atau PNG).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await compressImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
  };

  return (
    <div>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img src={value} alt="Pratinjau" className={`w-full object-contain ${previewClassName}`} />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
            dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
          }`}
        >
          {busy ? (
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-emerald-700" />
          ) : (
            <ImagePlus className="mb-3 h-10 w-10 text-slate-400" />
          )}
          <p className="font-medium text-slate-700">{busy ? 'Memproses gambar…' : label}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={onSelect} className="hidden" />
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
