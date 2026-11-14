import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { MAX_GALLERY_IMAGES } from '../types';
import { compressImage } from '../lib/image';

interface Props {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}

export default function GalleryUploader({ images, onChange, max = MAX_GALLERY_IMAGES }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const room = max - images.length;
    if (room <= 0) {
      setError(`Galeri sudah penuh (maksimal ${max} foto).`);
      return;
    }

    const files = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, room);
    if (files.length === 0) {
      setError('Berkas harus berupa gambar (JPG atau PNG).');
      return;
    }

    setBusy(true);
    setError(null);
    const next = [...images];
    try {
      for (const file of files) {
        next.push(await compressImage(file, 1024, 0.64));
      }
      onChange(next.slice(0, max));
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
    void addFiles(event.dataTransfer.files);
  };

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(event.target.files);
  };

  const removeAt = (index: number) => {
    onChange(images.filter((_, item) => item !== index));
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">Galeri lainnya</span>
        <span className="text-xs text-slate-400">
          {images.length}/{max} foto
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((src, index) => (
          <div
            key={`${index}-${src.slice(-24)}`}
            className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
          >
            <img src={src} alt={`Foto galeri ${index + 1}`} className="h-24 w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={`Hapus foto galeri ${index + 1}`}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-sm transition hover:bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {images.length < max && (
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
            className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition ${
              dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
            }`}
          >
            {busy ? (
              <Loader2 className="mb-1 h-5 w-5 animate-spin text-emerald-700" />
            ) : (
              <ImagePlus className="mb-1 h-5 w-5 text-slate-400" />
            )}
            <span className="px-1 text-xs font-medium text-slate-600">
              {busy ? 'Memproses…' : 'Tambah foto'}
            </span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={onSelect} className="hidden" />
      <p className="mt-1.5 text-xs text-slate-400">
        Maksimal {max} foto lainnya. Semua foto tampil sebagai slide otomatis di halaman detail properti.
      </p>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
