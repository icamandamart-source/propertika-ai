import { AlertTriangle, Cloud, HardDrive, Loader2 } from 'lucide-react';
import type { HealthResponse } from '../types';

interface Props {
  health: HealthResponse | null;
  /** Fitur mana yang dicek kesiapannya: penulisan teks atau pembuatan gambar. */
  capability?: 'text' | 'image';
  /** Tampilkan info driver penyimpanan foto (hanya di halaman yang relevan). */
  showStorage?: boolean;
}

export default function AiStatusBanner({ health, capability = 'text', showStorage = false }: Props) {
  if (!health) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memeriksa status layanan AI...
      </div>
    );
  }

  if (capability === 'image') {
    const provider = health.imageProvider ?? (health.aiEnabled ? 'gemini' : 'none');
    if (provider !== 'none') return null;

    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong className="font-semibold">Fitur gambar AI belum aktif.</strong> Isi{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">CLOUDFLARE_ACCOUNT_ID</code> dan{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">CLOUDFLARE_API_TOKEN</code> di berkas{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">.env</code>, lalu jalankan ulang server.
          Pendaftaran Cloudflare gratis dan tidak perlu kartu kredit — kuotanya 10.000 neuron per hari.
        </span>
      </div>
    );
  }

  const storageInfo = showStorage && health.storageDriver ? (
    health.storageDriver === 'cloudinary' ? (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
        <Cloud className="h-3.5 w-3.5" />
        Foto disimpan permanen di Cloudinary CDN — aman saat server restart/redeploy.
      </div>
    ) : (
      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <HardDrive className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Foto tersimpan di disk lokal server</strong> (folder <code className="rounded bg-white/70 px-1 py-0.5">uploads/</code>).
          Aktifkan Cloudinary agar foto tetap ada setelah server di-restart atau redeploy.
          Isi <code className="rounded bg-white/70 px-1 py-0.5">CLOUDINARY_CLOUD_NAME</code>,{' '}
          <code className="rounded bg-white/70 px-1 py-0.5">CLOUDINARY_API_KEY</code>, dan{' '}
          <code className="rounded bg-white/70 px-1 py-0.5">CLOUDINARY_API_SECRET</code> di berkas <code className="rounded bg-white/70 px-1 py-0.5">.env</code>.
        </span>
      </div>
    )
  ) : null;

  if (health.aiEnabled) return storageInfo;

  return (
    <>
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong className="font-semibold">GEMINI_API_KEY belum diatur.</strong> Salin berkas{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">.env.example</code> menjadi{' '}
          <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">.env</code>, isi kuncinya, lalu jalankan ulang
          server. Selama belum diisi, deskripsi properti memakai draf offline.
        </span>
      </div>
      {storageInfo}
    </>
  );
}
