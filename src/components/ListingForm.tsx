import { useState, type ReactNode } from 'react';
import { Loader2, Save, Sparkles, Wand2, X } from 'lucide-react';
import {
  DESCRIPTION_TONES,
  LISTING_CATEGORIES,
  LISTING_PURPOSES,
  type DescriptionTone,
  type GeoCoords,
  type Listing,
  type ListingCategory,
  type ListingPurpose,
} from '../types';
import { formatNumberInput, parseNumberInput } from '../lib/format';
import { newId, store, useAppState } from '../lib/store';
import { useAuth } from '../lib/auth';
import { generateDescription } from '../lib/ai';
import ImageUploader from './ImageUploader';
import GalleryUploader from './GalleryUploader';
import AddressPicker from './AddressPicker';

interface Props {
  initial?: Listing;
  onDone: () => void;
}

interface Draft {
  title: string;
  category: ListingCategory;
  purpose: ListingPurpose;
  price: number;
  location: string;
  city: string;
  coords: GeoCoords | null;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  buildingArea: number;
  features: string;
  description: string;
  contactPhone: string;
  imageUrl: string;
  images: string[];
}

const EMPTY: Draft = {
  title: '',
  category: 'Rumah',
  purpose: 'Dijual',
  price: 0,
  location: '',
  city: '',
  coords: null,
  bedrooms: 0,
  bathrooms: 0,
  landArea: 0,
  buildingArea: 0,
  features: '',
  description: '',
  contactPhone: '',
  imageUrl: '',
  images: [],
};

/** Nomor telepon diisi otomatis dari profil, tapi tetap bisa diubah per listing. */
function toDraft(listing: Listing | undefined, profilePhone: string): Draft {
  if (!listing) return { ...EMPTY, contactPhone: profilePhone };
  return {
    title: listing.title,
    category: listing.category,
    purpose: listing.purpose,
    price: listing.price,
    location: listing.location,
    city: listing.city,
    coords: listing.coords ?? null,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    landArea: listing.landArea,
    buildingArea: listing.buildingArea,
    features: listing.features.join(', '),
    description: listing.description,
    contactPhone: listing.contactPhone,
    imageUrl: listing.imageUrl,
    images: listing.images ?? [],
  };
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

export default function ListingForm({ initial, onDone }: Props) {
  const { user } = useAuth();
  const { profile } = useAppState();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial, profile.phone));
  const [tone, setTone] = useState<DescriptionTone>('Profesional');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(initial?.aiGenerated ?? false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setNumber = (
    key: 'price' | 'bedrooms' | 'bathrooms' | 'landArea' | 'buildingArea',
    raw: string,
  ) => setDraft((current) => ({ ...current, [key]: parseNumberInput(raw) }));

  const generateWithAi = async () => {
    if (!draft.title.trim()) {
      setError('Isi judul properti dulu sebelum membuat deskripsi.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await generateDescription({
        title: draft.title,
        price: draft.price,
        location: draft.location,
        city: draft.city,
        category: draft.category,
        purpose: draft.purpose,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        landArea: draft.landArea,
        buildingArea: draft.buildingArea,
        features: draft.features.split(',').map((item) => item.trim()).filter(Boolean),
        details: draft.description,
        tone,
      });
      set('description', result.description);
      setAiGenerated(result.source === 'ai');
      store.showToast(
        result.source === 'ai' ? 'Deskripsi dibuat dengan AI.' : result.note ?? 'Draf dibuat tanpa AI.',
        result.source === 'ai' ? 'success' : 'info',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat deskripsi.');
    } finally {
      setGenerating(false);
    }
  };

  const submit = () => {
    if (!user) {
      setError('Sesi Anda sudah berakhir. Silakan masuk kembali.');
      return;
    }
    if (!draft.title.trim()) {
      setError('Judul properti wajib diisi.');
      return;
    }
    if (draft.price <= 0) {
      setError('Harga harus lebih besar dari nol.');
      return;
    }
    if (!draft.location.trim()) {
      setError('Lokasi wajib diisi.');
      return;
    }

    const listing: Listing = {
      id: initial?.id ?? newId('listing'),
      title: draft.title.trim(),
      category: draft.category,
      purpose: draft.purpose,
      price: draft.price,
      location: draft.location.trim(),
      city: draft.city.trim(),
      coords: draft.coords,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      landArea: draft.landArea,
      buildingArea: draft.buildingArea,
      description: draft.description.trim(),
      features: draft.features.split(',').map((item) => item.trim()).filter(Boolean),
      imageUrl: draft.imageUrl,
      images: draft.images,
      ownerId: initial?.ownerId ?? user.uid,
      ownerName: initial?.ownerName ?? (user.displayName || profile.name),
      contactPhone: draft.contactPhone.trim(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      aiGenerated,
    };

    store.upsertListing(listing);
    onDone();
  };

  const isTanah = draft.category === 'Tanah';
  const isFurniture = draft.category === 'Furniture';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{initial ? 'Ubah Listing' : 'Pasang Listing Baru'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Data tersimpan di peramban Anda, jadi listing langsung tampil di marketplace.
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          aria-label="Tutup formulir"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Judul listing">
            <input
              className={inputClass}
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="Contoh: Rumah Modern Minimalis di Bintaro"
            />
          </Field>
        </div>

        <Field label="Kategori">
          <select
            className={inputClass}
            value={draft.category}
            onChange={(event) => set('category', event.target.value as ListingCategory)}
          >
            {LISTING_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tujuan">
          <select
            className={inputClass}
            value={draft.purpose}
            onChange={(event) => set('purpose', event.target.value as ListingPurpose)}
          >
            {LISTING_PURPOSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        <Field label={draft.purpose === 'Disewa' ? 'Harga sewa per bulan (Rp)' : 'Harga (Rp)'}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={formatNumberInput(draft.price)}
            onChange={(event) => setNumber('price', event.target.value)}
            placeholder="1.500.000.000"
          />
        </Field>

        <Field label="Nomor telepon penjual">
          <input
            className={inputClass}
            value={draft.contactPhone}
            onChange={(event) => set('contactPhone', event.target.value)}
            placeholder="0812-3456-7890"
          />
        </Field>

        <Field label="Kota / kabupaten">
          <input
            className={inputClass}
            value={draft.city}
            onChange={(event) => set('city', event.target.value)}
            placeholder="Jakarta Selatan"
          />
        </Field>

        <div className="sm:col-span-2">
          <AddressPicker
            address={draft.location}
            coords={draft.coords}
            onAddressChange={(value) => set('location', value)}
            onCoordsChange={(value) => set('coords', value)}
            label="Lokasi properti"
            inputClassName={inputClass}
            placeholder="Alamat lengkap properti"
            hint="Tekan “Gunakan lokasi saya” saat berada di properti, atau “Cari di peta”, supaya pembeli melihat jarak dari lokasi mereka."
          />
        </div>

        {!isFurniture && (
          <>
            {!isTanah && (
              <>
                <Field label="Kamar tidur">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={draft.bedrooms || ''}
                    onChange={(event) => setNumber('bedrooms', event.target.value)}
                    placeholder="3"
                  />
                </Field>
                <Field label="Kamar mandi">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={draft.bathrooms || ''}
                    onChange={(event) => setNumber('bathrooms', event.target.value)}
                    placeholder="2"
                  />
                </Field>
              </>
            )}
            <Field label="Luas tanah (m²)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={draft.landArea || ''}
                onChange={(event) => setNumber('landArea', event.target.value)}
                placeholder="120"
              />
            </Field>
            {!isTanah && (
              <Field label="Luas bangunan (m²)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={draft.buildingArea || ''}
                  onChange={(event) => setNumber('buildingArea', event.target.value)}
                  placeholder="96"
                />
              </Field>
            )}
          </>
        )}

        <div className="sm:col-span-2">
          <Field label="Fasilitas" hint="Pisahkan dengan tanda koma.">
            <input
              className={inputClass}
              value={draft.features}
              onChange={(event) => set('features', event.target.value)}
              placeholder="Carport 2 mobil, Keamanan 24 jam, Taman belakang"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Galeri utama (foto sampul)" hint="Opsional. Tanpa foto, kartu listing memakai gambar bawaan.">
            <ImageUploader
              value={draft.imageUrl}
              onChange={(dataUrl) => set('imageUrl', dataUrl)}
              label="Unggah foto properti"
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <GalleryUploader images={draft.images} onChange={(value) => set('images', value)} />
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Deskripsi</span>
            <div className="flex items-center gap-2">
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value as DescriptionTone)}
                aria-label="Gaya bahasa"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500"
              >
                {DESCRIPTION_TONES.map((item) => (
                  <option key={item} value={item}>
                    Gaya {item}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={generateWithAi}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {generating ? 'Membuat…' : 'Buat dengan AI'}
              </button>
            </div>
          </div>
          <textarea
            className={`${inputClass} min-h-40 resize-y`}
            value={draft.description}
            onChange={(event) => {
              set('description', event.target.value);
              setAiGenerated(false);
            }}
            placeholder="Tuliskan keunggulan properti, atau tekan “Buat dengan AI”."
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800"
        >
          <Save className="h-4 w-4" />
          {initial ? 'Simpan Perubahan' : 'Pasang Listing'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-200 px-5 py-2.5 font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Batal
        </button>
        {aiGenerated && (
          <span className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-amber-600">
            <Sparkles className="h-3.5 w-3.5" />
            Deskripsi dibuat AI
          </span>
        )}
      </div>
    </div>
  );
}
