import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, FileText, Loader2, Wand2 } from 'lucide-react';
import AiStatusBanner from '../components/AiStatusBanner';
import {
  DESCRIPTION_TONES,
  LISTING_CATEGORIES,
  LISTING_PURPOSES,
  type DescriptionTone,
  type ListingCategory,
  type ListingPurpose,
} from '../types';
import { formatNumberInput, parseNumberInput } from '../lib/format';
import { generateDescription } from '../lib/ai';
import { useAiHealth } from '../lib/useAiHealth';
import { newId, store, useAppState } from '../lib/store';
import { useAuth } from '../lib/auth';

interface FormState {
  title: string;
  category: ListingCategory;
  purpose: ListingPurpose;
  price: number;
  location: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  buildingArea: number;
  features: string;
  details: string;
}

const EMPTY: FormState = {
  title: '',
  category: 'Rumah',
  purpose: 'Dijual',
  price: 0,
  location: '',
  city: '',
  bedrooms: 3,
  bathrooms: 2,
  landArea: 0,
  buildingArea: 0,
  features: '',
  details: '',
};

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export default function AIDeskripsiPropertiPage() {
  const health = useAiHealth();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, role } = useAppState();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [tone, setTone] = useState<DescriptionTone>('Profesional');
  const [result, setResult] = useState('');
  const [source, setSource] = useState<'ai' | 'template' | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setNumber = (key: 'price' | 'bedrooms' | 'bathrooms' | 'landArea' | 'buildingArea', raw: string) =>
    setForm((current) => ({ ...current, [key]: parseNumberInput(raw) }));

  const features = form.features.split(',').map((item) => item.trim()).filter(Boolean);

  const generate = async () => {
    if (!form.title.trim()) {
      setError('Judul properti wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await generateDescription({ ...form, features, tone });
      setResult(response.description);
      setSource(response.source);
      if (response.note) store.showToast(response.note, 'info');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat deskripsi.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      store.showToast('Peramban menolak akses papan klip.', 'error');
    }
  };

  const saveAsListing = () => {
    if (!result.trim()) {
      store.showToast('Buat deskripsi terlebih dahulu.', 'error');
      return;
    }
    if (!user) {
      store.showToast('Masuk dulu untuk menyimpan sebagai listing.', 'error');
      navigate('/masuk?next=/ai-deskripsi');
      return;
    }
    if (role !== 'seller') {
      store.showToast('Hanya akun penjual yang bisa memasang listing. Lengkapi kriteria penjual dulu.', 'info');
      navigate('/jadi-penjual');
      return;
    }
    const id = newId('listing');
    store.upsertListing({
      id,
      title: form.title.trim(),
      category: form.category,
      purpose: form.purpose,
      price: form.price,
      location: form.location.trim(),
      city: form.city.trim(),
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      landArea: form.landArea,
      buildingArea: form.buildingArea,
      description: result.trim(),
      features,
      imageUrl: '',
      ownerId: user.uid,
      ownerName: user.displayName || profile.name,
      contactPhone: profile.phone,
      createdAt: new Date().toISOString(),
      aiGenerated: source === 'ai',
    });
    navigate(`/properti/${id}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900 text-white">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">AI Deskripsi Properti</h1>
          <p className="mt-1 text-sm text-slate-500">
            Isi data properti, dan AI akan menyusun deskripsi iklan yang persuasif dan ramah SEO.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <AiStatusBanner health={health} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Data properti</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Judul properti *">
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="Rumah Modern Minimalis di Bintaro"
                />
              </Field>
            </div>

            <Field label="Kategori">
              <select
                className={inputClass}
                value={form.category}
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
                value={form.purpose}
                onChange={(event) => set('purpose', event.target.value as ListingPurpose)}
              >
                {LISTING_PURPOSES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={form.purpose === 'Disewa' ? 'Harga per bulan (Rp)' : 'Harga (Rp)'}>
              <input
                className={inputClass}
                inputMode="numeric"
                value={formatNumberInput(form.price)}
                onChange={(event) => setNumber('price', event.target.value)}
                placeholder="1.500.000.000"
              />
            </Field>

            <Field label="Lokasi / kawasan">
              <input
                className={inputClass}
                value={form.location}
                onChange={(event) => set('location', event.target.value)}
                placeholder="Bintaro, Pesanggrahan"
              />
            </Field>

            <Field label="Kota / kabupaten">
              <input
                className={inputClass}
                value={form.city}
                onChange={(event) => set('city', event.target.value)}
                placeholder="Jakarta Selatan"
              />
            </Field>

            <Field label="Kamar tidur">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.bedrooms || ''}
                onChange={(event) => setNumber('bedrooms', event.target.value)}
                placeholder="3"
              />
            </Field>

            <Field label="Kamar mandi">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.bathrooms || ''}
                onChange={(event) => setNumber('bathrooms', event.target.value)}
                placeholder="2"
              />
            </Field>

            <Field label="Luas tanah (m²)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.landArea || ''}
                onChange={(event) => setNumber('landArea', event.target.value)}
                placeholder="120"
              />
            </Field>

            <Field label="Luas bangunan (m²)">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.buildingArea || ''}
                onChange={(event) => setNumber('buildingArea', event.target.value)}
                placeholder="96"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Fasilitas (pisahkan dengan koma)">
                <input
                  className={inputClass}
                  value={form.features}
                  onChange={(event) => set('features', event.target.value)}
                  placeholder="Carport 2 mobil, Keamanan 24 jam"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Catatan tambahan">
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={form.details}
                  onChange={(event) => set('details', event.target.value)}
                  placeholder="Dekat stasiun, bebas banjir, sertifikat SHM…"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Gaya bahasa">
                <select
                  className={inputClass}
                  value={tone}
                  onChange={(event) => setTone(event.target.value as DescriptionTone)}
                >
                  {DESCRIPTION_TONES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-3 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loading ? 'Menyusun deskripsi…' : 'Generate Deskripsi'}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Hasil deskripsi</h2>
            {source && (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  source === 'ai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {source === 'ai' ? 'Dibuat AI' : 'Draf offline'}
              </span>
            )}
          </div>

          <textarea
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder="Deskripsi akan muncul di sini dan bisa Anda sunting sebelum dipakai."
            className={`${inputClass} min-h-96 resize-y leading-relaxed`}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copy}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Tersalin' : 'Salin'}
            </button>
            <button
              type="button"
              onClick={saveAsListing}
              disabled={!result}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:opacity-50"
            >
              Pasang sebagai listing
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
