import { useState, type ComponentType } from 'react';
import { Download, Loader2, RefreshCw, Ruler, ScanSearch, Sparkles, Wand2 } from 'lucide-react';
import type { ImageMode, Listing, RabItem } from '../types';
import { analyzeImage, generateImage } from '../lib/ai';
import { useAiHealth } from '../lib/useAiHealth';
import { store } from '../lib/store';
import { downloadDataUrl } from '../lib/image';
import { generateDefaultRab } from '../lib/rab';
import AiStatusBanner from './AiStatusBanner';
import FurnitureRecommendations from './FurnitureRecommendations';
import ImageUploader from './ImageUploader';
import RabEstimator from './RabEstimator';

/** Mode yang menghasilkan visual interior, tempat rekomendasi furniture relevan. */
const INTERIOR_MODES: ImageMode[] = ['room-makeover', 'furniture'];

interface Props {
  mode: ImageMode;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  uploadLabel: string;
  uploadHint: string;
  presets: { label: string; prompt: string }[];
}

export default function AIImageTool({
  mode,
  title,
  description,
  icon: Icon,
  uploadLabel,
  uploadHint,
  presets,
}: Props) {
  const health = useAiHealth();
  const [source, setSource] = useState('');
  const [preset, setPreset] = useState(0);
  const [extra, setExtra] = useState('');
  const [panjang, setPanjang] = useState(4);
  const [lebar, setLebar] = useState(3);
  const [rabItems, setRabItems] = useState<RabItem[]>([]);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzingRab, setAnalyzingRab] = useState(false);
  const [applyingFurnitureId, setApplyingFurnitureId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const luas = Number((panjang * lebar).toFixed(1));

  const isImageReady = health
    ? (health.imageProvider ?? (health.aiEnabled ? 'gemini' : 'none')) !== 'none'
    : true;

  const handleToggleRabItem = (id: string) => {
    setRabItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, included: !item.included } : item)),
    );
  };

  const handleDeleteRabItem = (id: string) => {
    setRabItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddRabItem = (newItem: Omit<RabItem, 'id' | 'included'>) => {
    setRabItems((prev) => [
      {
        ...newItem,
        id: `custom-${Date.now()}`,
        included: true,
      },
      ...prev,
    ]);
  };

  const handleToggleAllRab = (included: boolean) => {
    setRabItems((prev) => prev.map((item) => ({ ...item, included })));
  };

  /** Susun ulang estimasi RAB dari gambar yang sedang ditampilkan. */
  const analyzeRabForImage = async (image: string) => {
    setAnalyzingRab(true);
    try {
      const analysis = await analyzeImage({ image, panjang, lebar });
      if (analysis.source === 'ai' && analysis.items.length > 0) {
        // Gemini berhasil mengidentifikasi item dari gambar
        setRabItems(
          analysis.items.map((item, idx) => ({
            ...item,
            id: `ai-${Date.now()}-${idx}`,
            included: true,
          })),
        );
      } else {
        // Fallback: gunakan deteksi kata kunci dari prompt
        setRabItems(generateDefaultRab(mode, presets[preset]?.label, extra, panjang, lebar));
      }
    } catch {
      // Jika analisis gagal, gunakan fallback
      setRabItems(generateDefaultRab(mode, presets[preset]?.label, extra, panjang, lebar));
    } finally {
      setAnalyzingRab(false);
    }
  };

  const run = async () => {
    if (!source) {
      setError('Unggah foto terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    setRabItems([]);
    try {
      const dimensionText = panjang > 0 && lebar > 0 ? `Dimensi ruangan: ${panjang}m x ${lebar}m (${luas} m²).` : '';
      const prompt = [presets[preset]?.prompt, dimensionText, extra.trim()].filter(Boolean).join('. ');
      const response = await generateImage({ mode, prompt, image: source });
      const generatedImage = response.image;
      setResult(generatedImage);
      await analyzeRabForImage(generatedImage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat gambar.');
    } finally {
      setLoading(false);
    }
  };

  /** Gabungkan furniture yang sedang dijual ke gambar hasil generate sebelumnya. */
  const applyFurniture = async (listing: Listing) => {
    if (!result) return;
    setApplyingFurnitureId(listing.id);
    setError(null);
    setRabItems([]);
    try {
      const dimensionText = panjang > 0 && lebar > 0 ? `Dimensi ruangan: ${panjang}m x ${lebar}m (${luas} m²).` : '';
      const prompt = [
        `Place this exact furniture from the marketplace into the room shown in input_image_0: ${listing.title}.`,
        'Keep the room perspective, floor plane, existing walls, shadows and lighting unchanged. Photorealistic interior render.',
        listing.description,
        listing.features.length > 0 ? `Details: ${listing.features.join(', ')}.` : '',
        dimensionText,
      ]
        .filter(Boolean)
        .join(' ');
      const response = await generateImage({ mode: 'furniture', prompt, image: result });
      setResult(response.image);
      store.showToast(`${listing.title} ditambahkan ke gambar.`, 'success');
      await analyzeRabForImage(response.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menggabungkan furniture ke gambar.');
    } finally {
      setApplyingFurnitureId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-900 text-white">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="mb-6">
        <AiStatusBanner health={health} capability="image" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-900">1. Unggah foto</h2>
          <ImageUploader value={source} onChange={setSource} label={uploadLabel} hint={uploadHint} />

          <h2 className="mb-3 mt-6 font-semibold text-slate-900">2. Pilih gaya</h2>
          <div className="flex flex-wrap gap-2">
            {presets.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setPreset(index)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  preset === index
                    ? 'border-emerald-900 bg-emerald-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-500'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Permintaan tambahan (opsional)</span>
            <textarea
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              rows={3}
              placeholder="Contoh: nuansa kayu hangat, ada tanaman besar di sudut ruangan"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </label>

          {/* 3. Ukuran & Luas Ruangan */}
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-emerald-800" />
                <h3 className="text-sm font-semibold text-slate-900">3. Dimensi Ruangan & Luas</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                Luas: {luas} m²
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Panjang (meter)</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={panjang}
                    onChange={(e) => setPanjang(Math.max(0.1, Number(e.target.value) || 0))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="pointer-events-none absolute right-3 top-2 text-xs font-semibold text-slate-400">m</span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Lebar (meter)</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={lebar}
                    onChange={(e) => setLebar(Math.max(0.1, Number(e.target.value) || 0))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="pointer-events-none absolute right-3 top-2 text-xs font-semibold text-slate-400">m</span>
                </div>
              </label>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500">
              <span>Hitungan: {panjang} m × {lebar} m</span>
              <span className="font-semibold text-emerald-800">Total Luas: {luas} m²</span>
            </div>
          </div>

          <button
            type="button"
            onClick={run}
            disabled={loading || applyingFurnitureId !== null || !source || (health !== null && !isImageReady)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-3 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          >
            {loading || applyingFurnitureId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {applyingFurnitureId
              ? 'Menggabungkan furniture…'
              : loading
                ? 'Memproses… (15–45 detik)'
                : 'Generate dengan AI'}
          </button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-semibold text-slate-900">Hasil Visualisasi AI</h2>
            {result ? (
              <>
                <img src={result} alt="Hasil AI" className="w-full rounded-xl border border-slate-200" />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadDataUrl(result, `propertika-${mode}.png`)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
                  >
                    <Download className="h-4 w-4" />
                    Unduh gambar
                  </button>
                  <button
                    type="button"
                    onClick={run}
                    disabled={loading || applyingFurnitureId !== null}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Buat ulang
                  </button>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                {loading ? (
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-700" />
                ) : (
                  <Sparkles className="mb-3 h-8 w-8 text-slate-300" />
                )}
                <p className="text-sm text-slate-500">
                  {loading ? 'AI sedang mengolah gambar Anda…' : 'Hasil visualisasi & estimasi RAB akan muncul di sini.'}
                </p>
              </div>
            )}
          </section>

          {/* Rekomendasi furniture dari listing yang sedang dijual */}
          {result && INTERIOR_MODES.includes(mode) && (
            <FurnitureRecommendations
              keywords={[presets[preset]?.label ?? '', extra, ...rabItems.map((item) => item.name)]}
              limit={3}
              onApply={applyFurniture}
              applyingId={applyingFurnitureId}
              disabled={loading}
            />
          )}

          {/* Estimasi RAB Interaktif */}
          {result && (
            analyzingRab ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-800">
                  <ScanSearch className="h-5 w-5 shrink-0 animate-pulse" />
                  <div>
                    <p className="font-semibold text-slate-900">Menganalisis gambar…</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      AI sedang mengidentifikasi furnitur & item dari hasil visualisasi untuk menyusun estimasi RAB yang akurat.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {[70, 55, 85, 45, 65].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-slate-200 animate-pulse" />
                      <div
                        className="h-3 rounded bg-slate-100 animate-pulse"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : rabItems.length > 0 ? (
              <RabEstimator
                items={rabItems}
                onToggleItem={handleToggleRabItem}
                onDeleteItem={handleDeleteRabItem}
                onAddItem={handleAddRabItem}
                onToggleAll={handleToggleAllRab}
                panjang={panjang}
                lebar={lebar}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
