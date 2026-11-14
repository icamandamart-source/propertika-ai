import express, { type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  DescriptionRequest,
  DescriptionResponse,
  ImageMode,
  ImageRequest,
  ImageResponse,
  RabItem,
} from './src/types.ts';
import { adminConfigured, getAdmin, type AdminServices } from './server/admin.ts';
import { OrderError } from './server/order-core.ts';
import { createServerOrder, importServerOrders } from './server/orders.ts';
import { PaymentError } from './server/payment-core.ts';
import { createSnapPayment, handleMidtransWebhook, midtransConfigured } from './server/payments.ts';
import {
  createFirestoreQuotaStore,
  MemoryQuotaStore,
  type QuotaDecision,
  type QuotaLimits,
  type QuotaStore,
} from './server/quota.ts';
import { createRateLimiter } from './server/rate-limit.ts';
import {
  createErrorHandler,
  createLogger,
  requestLogger,
  resolveLogLevel,
} from './server/log.ts';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const logger = createLogger({ service: 'propertika-ai' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const PORT = Number(process.env.PORT ?? 3000);
// Model yang masih dilayani untuk kunci API baru. Google menonaktifkan model lama
// untuk pengguna baru, jadi nilai ini bisa perlu diperbarui dari waktu ke waktu.
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.1-flash-lite';
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';

/**
 * Model cadangan bila model utama sedang sibuk (503) atau tidak tersedia untuk
 * kunci API ini. Dipisahkan dengan koma lewat GEMINI_TEXT_FALLBACKS.
 */
const TEXT_FALLBACKS = (process.env.GEMINI_TEXT_FALLBACKS ?? 'gemini-3.5-flash-lite,gemini-3-flash-preview')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

/**
 * Batas waktu per percobaan model. Tanpa ini, satu model yang menggantung bisa
 * menahan permintaan sampai menit-menitan sebelum model cadangan dicoba.
 */
const TEXT_TIMEOUT_MS = Number(process.env.GEMINI_TEXT_TIMEOUT_MS ?? 25_000);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Batas waktu ${ms / 1000} detik terlampaui saat memanggil ${label}.`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const TEXT_MODEL_CHAIN = [TEXT_MODEL, ...TEXT_FALLBACKS.filter((model) => model !== TEXT_MODEL)];

const apiKey = process.env.GEMINI_API_KEY?.trim();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/* --------------------------- Cloudflare Workers AI -------------------------- */
// Worker AI dipakai untuk fitur gambar karena model gambar Gemini tidak tersedia
// di Free Tier. Kuota gratisnya 10.000 neuron/hari dan tidak menuntut kartu.

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() ?? '';
const CLOUDFLARE_IMAGE_MODEL =
  process.env.CLOUDFLARE_IMAGE_MODEL ?? '@cf/black-forest-labs/flux-2-klein-4b';
const cloudflareReady = Boolean(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN);

type ImageProvider = 'cloudflare' | 'gemini' | 'none';

/**
 * Urutan pemilihan penyedia gambar. Bisa dipaksa lewat IMAGE_PROVIDER=cloudflare
 * atau IMAGE_PROVIDER=gemini bila keduanya terkonfigurasi.
 */
const IMAGE_PROVIDER: ImageProvider = (() => {
  const forced = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (forced === 'cloudflare' && cloudflareReady) return 'cloudflare';
  if (forced === 'gemini' && ai) return 'gemini';
  if (cloudflareReady) return 'cloudflare';
  if (ai) return 'gemini';
  return 'none';
})();

/* ------------------------------- Unggah foto ------------------------------- */
// Foto disimpan di server ini (folder `uploads/`) supaya tidak memerlukan
// Firebase Storage/Blaze. Unggahan hanya diterima dari pengguna yang sudah masuk.

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY?.trim() ?? '';

/* ------------------------- Penyimpanan Cloudinary -------------------------- */
// Cloudinary gratis (25 GB penyimpanan) dipakai untuk menjaga foto tetap utuh
// dan persisten saat server di-deploy ke hosting cloud seperti Render/Railway/VPS.
// Bila kredensial Cloudinary belum diatur, server otomatis fallback ke disk lokal (folder uploads/).

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY?.trim() ?? '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET?.trim() ?? '';
const cloudinaryReady = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

type StorageDriver = 'cloudinary' | 'local';
const STORAGE_DRIVER: StorageDriver = (() => {
  const forced = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (forced === 'local') return 'local';
  if (forced === 'cloudinary' && cloudinaryReady) return 'cloudinary';
  if (cloudinaryReady) return 'cloudinary';
  return 'local';
})();

async function uploadToCloudinary(dataUrl: string, folder: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = createHash('sha1').update(stringToSign).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', dataUrl);
  formData.append('api_key', CLOUDINARY_API_KEY);
  formData.append('timestamp', String(timestamp));
  formData.append('folder', folder);
  formData.append('signature', signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as { secure_url?: string };
  if (!result.secure_url) {
    throw new Error('Cloudinary tidak mengembalikan secure_url.');
  }
  return result.secure_url;
}

const UPLOAD_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/** Pastikan isi base64 benar-benar gambar, bukan berkas sembarang. */
function looksLikeImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true;
  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') return true;
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return true;
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true;
  return false;
}

/** Verifikasi ID token Firebase lewat Identity Toolkit; kembalikan uid. */
async function verifyIdToken(token: string, requestId?: string): Promise<string | null> {
  if (!FIREBASE_API_KEY) return null;
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as { users?: { localId?: string }[] };
    return payload.users?.[0]?.localId ?? null;
  } catch (error) {
    logger.warn('auth_verify_failed', { requestId, error });
    return null;
  }
}

/** Wajibkan ID token Firebase; kirim 401 dan kembalikan null kalau tidak valid. */
async function requireAuth(req: Request, res: Response, message = 'Masuk dulu untuk menggunakan fitur AI.'): Promise<string | null> {
  const authorization = req.headers.authorization ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: message });
    return null;
  }
  const uid = await verifyIdToken(token, res.locals.requestId);
  if (!uid) {
    res.status(401).json({ error: 'Sesi tidak valid. Silakan masuk ulang.' });
    return null;
  }
  return uid;
}

/* ------------------------------ Pembatasan laju ----------------------------- */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const aiLimiter = createRateLimiter({ maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS });
const uploadLimiter = createRateLimiter({ maxRequests: 30, windowMs: WINDOW_MS });
const orderLimiter = createRateLimiter({ maxRequests: 10, windowMs: WINDOW_MS });
const paymentLimiter = createRateLimiter({ maxRequests: 10, windowMs: WINDOW_MS });
const webhookLimiter = createRateLimiter({ maxRequests: 120, windowMs: WINDOW_MS });
const clientErrorLimiter = createRateLimiter({ maxRequests: 20, windowMs: WINDOW_MS });

function applyRateLimit(
  req: Request,
  res: Response,
  limiter: ReturnType<typeof createRateLimiter>,
  label: string,
): boolean {
  const decision = limiter.check(req.ip ?? 'unknown');
  if (!decision.limited) return false;
  res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  res.status(429).json({ error: `Terlalu banyak ${label}. Coba lagi sebentar lagi.` });
  return true;
}

function guard(req: Request, res: Response): boolean {
  return applyRateLimit(req, res, aiLimiter, 'permintaan AI');
}

function guardUpload(req: Request, res: Response): boolean {
  return applyRateLimit(req, res, uploadLimiter, 'unggahan foto');
}

function guardOrder(req: Request, res: Response): boolean {
  return applyRateLimit(req, res, orderLimiter, 'pembuatan pesanan');
}

function guardPayment(req: Request, res: Response): boolean {
  return applyRateLimit(req, res, paymentLimiter, 'permintaan pembayaran');
}

function guardWebhook(req: Request, res: Response): boolean {
  return applyRateLimit(req, res, webhookLimiter, 'notifikasi pembayaran');
}

/* ------------------------------- App Check -------------------------------- */

const APP_CHECK_REQUIRED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.APP_CHECK_REQUIRED ?? '').trim().toLowerCase(),
);

/** Verifikasi token App Check pada header X-Firebase-AppCheck bila diwajibkan. */
async function requireAppCheck(req: Request, res: Response): Promise<boolean> {
  if (!APP_CHECK_REQUIRED) return true;

  const header = req.headers['x-firebase-appcheck'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token?.trim()) {
    res.status(401).json({
      error: 'Verifikasi aplikasi tidak ditemukan. Muat ulang halaman lalu coba lagi.',
    });
    return false;
  }

  if (!adminConfigured()) {
    logger.error('app_check_misconfigured', {
      requestId: res.locals.requestId,
      reason: 'kredensial Firebase Admin belum diisi',
    });
    res.status(503).json({ error: 'Verifikasi aplikasi belum siap di server.' });
    return false;
  }

  const admin = await getAdmin();
  if (!admin) {
    logger.error('app_check_unavailable', {
      requestId: res.locals.requestId,
      reason: 'Firebase Admin gagal diinisialisasi',
    });
    res.status(503).json({ error: 'Verifikasi aplikasi belum siap di server.' });
    return false;
  }

  try {
    await admin.appCheck.verifyToken(token.trim());
    return true;
  } catch (error) {
    logger.warn('app_check_rejected', { requestId: res.locals.requestId, error });
    res.status(401).json({
      error: 'Verifikasi aplikasi gagal. Muat ulang halaman lalu coba lagi.',
    });
    return false;
  }
}

/* ---------------------------- Pesanan server-side --------------------------- */

/**
 * Pembuatan pesanan butuh Admin SDK untuk menghitung harga, memotong stok, dan
 * menulis order dalam satu transaksi. Tanpa kredensial, client harus memakai
 * alur lokal (mode tanpa Firestore) sampai server dikonfigurasi.
 */
async function requireOrderAdmin(res: Response): Promise<AdminServices | null> {
  if (!adminConfigured()) {
    res.status(503).json({
      error: 'Pembuatan pesanan server belum siap. Hubungi admin untuk mengatur kredensial Firebase.',
    });
    return null;
  }
  const admin = await getAdmin();
  if (!admin) {
    logger.error('order_admin_unavailable', {
      requestId: res.locals.requestId,
      reason: 'Firebase Admin gagal diinisialisasi',
    });
    res.status(503).json({ error: 'Pembuatan pesanan server belum siap di server.' });
    return null;
  }
  return admin;
}

/* ---------------------------- Kuota AI per akun ---------------------------- */

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const AI_MINUTE_LIMIT = positiveInt(process.env.AI_MINUTE_LIMIT, 15);
const AI_DAY_LIMIT = positiveInt(process.env.AI_DAY_LIMIT, 100);
const AI_DAY_MS = 24 * 60 * 60 * 1000;
const AI_QUOTA_LIMITS: QuotaLimits = {
  minuteLimit: AI_MINUTE_LIMIT,
  dayLimit: AI_DAY_LIMIT,
  windowMs: WINDOW_MS,
  dayMs: AI_DAY_MS,
};
const AI_QUOTA_BACKEND = (process.env.AI_QUOTA_BACKEND ?? 'auto').trim().toLowerCase();

interface QuotaRuntime {
  store: QuotaStore;
  backend: 'memory' | 'firestore';
}

let quotaRuntimePromise: Promise<QuotaRuntime> | null = null;
const fallbackQuotaStore = new MemoryQuotaStore();

async function getQuotaRuntime(): Promise<QuotaRuntime> {
  quotaRuntimePromise ??= (async () => {
    if (AI_QUOTA_BACKEND !== 'memory' && (adminConfigured() || AI_QUOTA_BACKEND === 'firestore')) {
      const admin = await getAdmin();
      if (admin) return { store: createFirestoreQuotaStore(admin.db), backend: 'firestore' };
      if (AI_QUOTA_BACKEND === 'firestore') {
        logger.warn('quota_firestore_unavailable', { backend: 'memory' });
      }
    }
    return { store: fallbackQuotaStore, backend: 'memory' };
  })();
  return quotaRuntimePromise;
}

/** Batasi pemakaian AI per akun; kirim 429 dan kembalikan true bila kuota habis. */
async function aiQuotaExceeded(uid: string, res: Response): Promise<boolean> {
  const runtime = await getQuotaRuntime();
  let decision: QuotaDecision;
  try {
    decision = await runtime.store.consume(uid, AI_QUOTA_LIMITS);
  } catch (error) {
    logger.warn('quota_store_failed', {
      requestId: res.locals.requestId,
      uid,
      error,
    });
    decision = await fallbackQuotaStore.consume(uid, AI_QUOTA_LIMITS);
  }

  if (decision.allowed) return false;

  res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  const message =
    decision.scope === 'day'
      ? `Kuota AI harian (${AI_DAY_LIMIT} permintaan) sudah habis. Coba lagi besok.`
      : `Terlalu banyak permintaan AI. Tunggu sebentar (maksimal ${AI_MINUTE_LIMIT} per menit).`;
  res.status(429).json({ error: message });
  return true;
}

/* -------------------------------- Deskripsi -------------------------------- */

const TONE_HINTS: Record<string, string> = {
  Profesional: 'nada profesional, faktual, dan meyakinkan',
  Santai: 'nada santai dan hangat seperti bercerita ke teman',
  Mewah: 'nada premium dan eksklusif dengan diksi elegan',
  Investasi: 'nada berorientasi investasi, tekankan potensi cuan dan lokasi strategis',
};

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function buildDescriptionPrompt(data: DescriptionRequest): string {
  const specs = [
    data.bedrooms > 0 ? `${data.bedrooms} kamar tidur` : '',
    data.bathrooms > 0 ? `${data.bathrooms} kamar mandi` : '',
    data.buildingArea > 0 ? `luas bangunan ${data.buildingArea} m2` : '',
    data.landArea > 0 ? `luas tanah ${data.landArea} m2` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return `Kamu adalah copywriter properti Indonesia yang berpengalaman.

Tulis deskripsi iklan untuk marketplace properti dengan data berikut:
- Judul: ${data.title || '(belum diisi)'}
- Kategori: ${data.category} (${data.purpose})
- Harga: ${currency.format(data.price || 0)}${data.purpose === 'Disewa' ? ' per bulan' : ''}
- Lokasi: ${data.location || '-'}, ${data.city || '-'}
- Spesifikasi: ${specs || '-'}
- Fasilitas: ${data.features.length ? data.features.join(', ') : '-'}
- Catatan tambahan: ${data.details || '-'}

Aturan penulisan:
1. Gunakan bahasa Indonesia, gaya ${TONE_HINTS[data.tone] ?? TONE_HINTS.Profesional}.
2. Panjang 120-180 kata, pecah menjadi 2 paragraf yang mengalir.
3. Paragraf pertama menonjolkan nilai jual utama dan keunggulan lokasi.
4. Paragraf kedua membahas spesifikasi, fasilitas, dan alasan pembaca harus menghubungi sekarang.
5. Jangan mengarang data yang tidak diberikan (nomor sertifikat, nama developer, dsb).
6. Jangan memakai markdown, bullet, atau tanda bintang. Tulis paragraf biasa saja.
7. Akhiri dengan satu kalimat ajakan yang natural.

Balas hanya dengan isi deskripsinya.`;
}

/** Lewati frasa lokasi kalau judulnya sudah menyebut lokasi/kota tersebut. */
function locationPhrase(title: string, location: string, city: string): string {
  const haystack = title.toLowerCase();
  const mentioned = (value: string) => Boolean(value) && haystack.includes(value.toLowerCase());
  if (mentioned(location) || mentioned(city)) return '';

  const parts = [location, city].filter(Boolean);
  return parts.length ? ` di ${parts.join(', ')}` : '';
}

/** Draf cadangan saat kunci AI belum diatur, supaya fitur tetap berguna. */
function templateDescription(data: DescriptionRequest): string {
  const harga = currency.format(data.price || 0);
  const hargaText = data.purpose === 'Disewa' ? `${harga} per bulan` : harga;
  const lokasi = locationPhrase(data.title, data.location, data.city);
  const tujuan = data.purpose === 'Disewa' ? 'untuk disewa' : 'untuk dijual';
  const specs = [
    data.bedrooms > 0 ? `${data.bedrooms} kamar tidur` : '',
    data.bathrooms > 0 ? `${data.bathrooms} kamar mandi` : '',
    data.buildingArea > 0 ? `luas bangunan ${data.buildingArea} m²` : '',
    data.landArea > 0 ? `luas tanah ${data.landArea} m²` : '',
  ].filter(Boolean);

  const paragraf1 = `${data.title || data.category}${lokasi} ditawarkan ${tujuan} dengan harga ${hargaText}. Posisinya yang berada di kawasan berkembang membuat akses ke pusat aktivitas, sekolah, rumah sakit, dan pusat perbelanjaan menjadi jauh lebih singkat. Lingkungan sekitar yang sudah tertata menjadikannya pilihan yang nyaman sekaligus aman untuk jangka panjang.`;

  const paragraf2 = [
    specs.length ? `Unit ini memiliki ${specs.join(', ')}.` : '',
    data.features.length ? `Fasilitas yang tersedia meliputi ${data.features.join(', ')}.` : '',
    data.details ? `${data.details.trim()}` : '',
    `Stok unit seperti ini tidak banyak dan biasanya cepat terjual.`,
  ]
    .filter(Boolean)
    .join(' ');

  return `${paragraf1}\n\n${paragraf2} Hubungi kami sekarang untuk mengatur jadwal survei lokasi.`;
}

function validateDescription(body: unknown): { data: DescriptionRequest } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Data permintaan tidak valid.' };
  const raw = body as Partial<DescriptionRequest>;
  const title = String(raw.title ?? '').trim();
  if (!title) return { error: 'Judul properti wajib diisi.' };

  const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    data: {
      title,
      price: toNumber(raw.price),
      location: String(raw.location ?? '').trim(),
      city: String(raw.city ?? '').trim(),
      category: String(raw.category ?? 'Rumah'),
      purpose: String(raw.purpose ?? 'Dijual'),
      bedrooms: toNumber(raw.bedrooms),
      bathrooms: toNumber(raw.bathrooms),
      landArea: toNumber(raw.landArea),
      buildingArea: toNumber(raw.buildingArea),
      features: Array.isArray(raw.features) ? raw.features.map(String).filter(Boolean).slice(0, 20) : [],
      details: String(raw.details ?? '').trim().slice(0, 2000),
      tone: (raw.tone ?? 'Profesional') as DescriptionRequest['tone'],
    },
  };
}

/* ---------------------------------- Gambar --------------------------------- */

const MODE_PROMPTS: Record<ImageMode, string> = {
  'room-makeover':
    'Redesign the room shown in input_image_0 into a fully furnished, photorealistic interior. Keep the original walls, windows, doors, perspective and room proportions of input_image_0 exactly the same. Add stylish furniture, lighting, textiles and decor.',
  'land-to-house':
    'input_image_0 shows an empty plot of land. Render a realistic modern house built directly on this exact plot, matching the original camera angle, terrain, surrounding vegetation and lighting from input_image_0. Photorealistic architectural visualization.',
  renovation:
    'Renovate the building or space shown in input_image_0 into a modern, well-maintained version while strictly keeping the same structure, footprint, walls, and camera angle of input_image_0. Photorealistic result.',
  furniture:
    'Place the described furniture into the room shown in input_image_0 realistically, precisely matching the existing perspective, floor plane, shadows, and lighting of input_image_0. Photorealistic interior render.',
};

function validateImage(body: unknown): { data: ImageRequest & { mimeType: string; data64: string } } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Data permintaan tidak valid.' };
  const raw = body as Partial<ImageRequest>;
  const image = String(raw.image ?? '');
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(image);
  if (!match) return { error: 'Unggah sebuah gambar terlebih dahulu (JPG atau PNG).' };

  const mode = (raw.mode ?? 'room-makeover') as ImageMode;
  if (!(mode in MODE_PROMPTS)) return { error: 'Mode AI tidak dikenali.' };

  const [, mimeType, data64] = match;
  if (data64.length > 8_000_000) return { error: 'Ukuran gambar terlalu besar. Maksimal sekitar 6 MB.' };

  return {
    data: {
      mode,
      image,
      prompt: String(raw.prompt ?? '').trim().slice(0, 800),
      mimeType,
      data64,
    },
  };
}

interface InlineImage {
  mimeType: string;
  data: string;
}

/** Ambil bagian gambar dari respons Gemini, apa pun bentuk kandidatnya. */
function extractInlineImage(response: unknown): InlineImage | null {
  const candidates = (response as { candidates?: unknown[] } | null)?.candidates ?? [];
  for (const candidate of candidates) {
    const parts = (candidate as { content?: { parts?: unknown[] } })?.content?.parts ?? [];
    for (const part of parts) {
      const inline = (part as { inlineData?: Partial<InlineImage> })?.inlineData;
      if (inline?.data) return { mimeType: inline.mimeType ?? 'image/png', data: inline.data };
    }
  }
  return null;
}

/* ---------------------------------- Server --------------------------------- */

/** Tebak tipe gambar dari beberapa karakter pertama base64, tanpa pustaka tambahan. */
function imageMimeFromBase64(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

/**
 * Jalankan satu model gambar di Cloudflare Workers AI.
 * Endpoint: POST /accounts/{id}/ai/run/{model} dengan Bearer token.
 */
async function cloudflareImage(
  instruction: string,
  mimeType: string,
  data64: string,
): Promise<string> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`;

  const buffer = Buffer.from(data64, 'base64');
  const filename = mimeType.includes('png') ? 'input.png' : 'input.jpg';
  let lastError: unknown = null;

  // Coba hingga 2 kali dengan seed acak yang berbeda bila terkena false positive safety flag
  for (let attempt = 1; attempt <= 2; attempt++) {
    const form = new FormData();
    form.append('prompt', instruction);
    form.append('seed', String(Math.floor(Math.random() * 2147483647)));

    const blob = new Blob([buffer], { type: mimeType });
    form.append('input_image_0', blob, filename);
    form.append('image', blob, filename);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
        body: form,
      });

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      const body = payload as {
        success?: boolean;
        result?: { image?: string };
        errors?: { code?: number; message?: string }[];
      } | null;

      if (!response.ok || body?.success === false) {
        const isFlagged =
          text.includes('flagged') ||
          body?.errors?.some((e) => e.code === 3030 || e.message?.toLowerCase().includes('flagged'));

        const detail =
          body?.errors?.map((e) => `${e.code ?? ''} ${e.message ?? ''}`.trim()).filter(Boolean).join('; ') ||
          text.slice(0, 300);

        if (isFlagged && attempt === 1) {
          logger.warn('cloudflare_safety_retry', { attempt: 1 });
          continue;
        }

        throw new Error(`Cloudflare Workers AI menolak permintaan (HTTP ${response.status}). ${detail}`);
      }

      const image = body?.result?.image;
      if (!image) throw new Error('Cloudflare tidak mengembalikan gambar.');
      return image;
    } catch (err) {
      lastError = err;
      if (attempt === 1 && String(err).toLowerCase().includes('flagged')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('Gagal menghasilkan gambar dari Cloudflare.');
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(requestLogger(logger));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    if (!isDev) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(express.json({ limit: '12mb' }));

  mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR, { index: false, maxAge: '7d', immutable: true }));

  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      logLevel: resolveLogLevel(),
      aiEnabled: Boolean(ai),
      textModel: TEXT_MODEL,
      imageProvider: IMAGE_PROVIDER,
      imageModel: IMAGE_PROVIDER === 'cloudflare' ? CLOUDFLARE_IMAGE_MODEL : IMAGE_MODEL,
      storageDriver: STORAGE_DRIVER,
      appCheckRequired: APP_CHECK_REQUIRED,
      quotaBackend: AI_QUOTA_BACKEND,
      ordersServerEnabled: adminConfigured(),
      paymentsEnabled: midtransConfigured(),
    });
  });

  // Laporan error dari peramban. Tidak butuh login karena error bisa terjadi
  // sebelum pengguna masuk; dibatasi per IP dan isinya dipotong di server.
  app.post('/api/client-errors', (req, res) => {
    if (applyRateLimit(req, res, clientErrorLimiter, 'laporan kesalahan')) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
    if (!message) {
      res.status(400).json({ error: 'Field "message" wajib diisi.' });
      return;
    }

    logger.error('client_error', {
      requestId: res.locals.requestId,
      message,
      source: typeof body.source === 'string' ? body.source.slice(0, 300) : undefined,
      path: typeof body.path === 'string' ? body.path.slice(0, 300) : undefined,
      stack: typeof body.stack === 'string' ? body.stack.slice(0, 4000) : undefined,
    });
    res.status(204).end();
  });

  app.post('/api/upload', async (req, res) => {
    if (guardUpload(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;

    const authorization = req.headers.authorization ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Masuk dulu untuk mengunggah foto.' });
      return;
    }

    const uid = await verifyIdToken(token, res.locals.requestId);
    if (!uid) {
      res.status(401).json({ error: 'Sesi tidak valid. Coba masuk ulang.' });
      return;
    }

    const dataUrl = (req.body as { dataUrl?: unknown })?.dataUrl;
    if (typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Field "dataUrl" wajib diisi.' });
      return;
    }

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Format gambar tidak valid.' });
      return;
    }

    const [, mimeType, data64] = match;
    const extension = UPLOAD_EXTENSIONS[mimeType.toLowerCase()];
    if (!extension) {
      res.status(415).json({ error: 'Tipe gambar tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau AVIF.' });
      return;
    }

    const buffer = Buffer.from(data64, 'base64');
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: 'Ukuran gambar terlalu besar. Maksimal 6 MB.' });
      return;
    }
    if (!looksLikeImage(buffer)) {
      res.status(415).json({ error: 'Berkas bukan gambar yang valid.' });
      return;
    }

    const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');

    if (STORAGE_DRIVER === 'cloudinary') {
      try {
        const secureUrl = await uploadToCloudinary(dataUrl, `propertika/${safeUid}`);
        res.json({ url: secureUrl });
        return;
      } catch (cloudErr) {
        logger.warn('cloudinary_upload_failed', {
          requestId: res.locals.requestId,
          uid,
          error: cloudErr,
        });
      }
    }

    const directory = path.join(UPLOAD_DIR, safeUid);
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(directory, filename), buffer);

    res.json({ url: `/uploads/${safeUid}/${filename}` });
  });

  app.post('/api/generate-description', async (req, res) => {
    if (guard(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (await aiQuotaExceeded(uid, res)) return;

    const validated = validateDescription(req.body);
    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const { data } = validated;

    if (!ai) {
      const payload: DescriptionResponse = {
        description: templateDescription(data),
        source: 'template',
        note: 'Draf dibuat tanpa AI karena GEMINI_API_KEY belum diatur di berkas .env.',
      };
      res.json(payload);
      return;
    }

    const prompt = buildDescriptionPrompt(data);
    let lastError: unknown = null;

    // Coba model utama, lalu model cadangan bila sedang sibuk, menggantung, atau
    // tidak tersedia untuk kunci API ini.
    for (const model of TEXT_MODEL_CHAIN) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({ model, contents: prompt }),
          TEXT_TIMEOUT_MS,
          model,
        );
        const description = response.text?.trim();
        if (!description) throw new Error('Model tidak mengembalikan teks.');
        res.json({ description, source: 'ai', model } satisfies DescriptionResponse);
        return;
      } catch (error) {
        lastError = error;
        logger.error('ai_text_failed', {
          requestId: res.locals.requestId,
          uid,
          model,
          error,
        });
      }
    }

    const failure = classifyAiError(lastError, 'text');
    res.status(failure.status).json({
      error: `Gagal membuat deskripsi (${TEXT_MODEL_CHAIN.join(', ')}). ${failure.message}`,
    });
  });

  app.post('/api/generate-image', async (req, res) => {
    if (guard(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (await aiQuotaExceeded(uid, res)) return;

    const validated = validateImage(req.body);
    if ('error' in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const { mode, prompt, mimeType, data64 } = validated.data;

    if (IMAGE_PROVIDER === 'none') {
      res.status(503).json({
        error:
          'Fitur gambar AI belum aktif. Isi CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN di berkas .env — pendaftaran Cloudflare gratis dan tidak perlu kartu kredit.',
      });
      return;
    }

    const instruction = [MODE_PROMPTS[mode], prompt ? `Additional request from the user: ${prompt}` : '']
      .filter(Boolean)
      .join(' ');

    try {
      if (IMAGE_PROVIDER === 'cloudflare') {
        const base64 = await cloudflareImage(instruction, mimeType, data64);
        res.json({
          image: `data:${imageMimeFromBase64(base64)};base64,${base64}`,
        } satisfies ImageResponse);
        return;
      }

      const response = await ai!.models.generateContent({
        model: IMAGE_MODEL,
        contents: [
          {
            role: 'user',
            parts: [{ text: instruction }, { inlineData: { mimeType, data: data64 } }],
          },
        ],
      });

      const image = extractInlineImage(response);
      if (!image) {
        const text = (response as { text?: string }).text?.trim();
        throw new Error(text || 'Model tidak mengembalikan gambar.');
      }

      res.json({ image: `data:${image.mimeType};base64,${image.data}` } satisfies ImageResponse);
    } catch (error) {
      logger.error('ai_image_failed', {
        requestId: res.locals.requestId,
        uid,
        provider: IMAGE_PROVIDER,
        error,
      });
      const failure = classifyAiError(error, 'image');
      const modelLabel = IMAGE_PROVIDER === 'cloudflare' ? CLOUDFLARE_IMAGE_MODEL : IMAGE_MODEL;
      res.status(failure.status).json({
        error: `Gagal membuat gambar dengan model ${modelLabel}. ${failure.message}`,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // /api/analyze-image — analisis gambar hasil generate AI untuk menyusun RAB
  // ---------------------------------------------------------------------------
  app.post('/api/analyze-image', async (req, res) => {
    if (guard(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res);
    if (!uid) return;
    if (await aiQuotaExceeded(uid, res)) return;

    const body = req.body as Partial<AnalyzeImageRequest>;
    const image = body?.image;

    if (!image || typeof image !== 'string') {
      res.status(400).json({ error: 'Field "image" (data URL) wajib diisi.' });
      return;
    }

    const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(image);
    if (!match) {
      res.status(400).json({ error: 'Format gambar tidak valid, harus berupa data URL base64.' });
      return;
    }

    const [, mimeType, data64] = match;
    const panjang = Number(body?.panjang ?? 0);
    const lebar = Number(body?.lebar ?? 0);
    const luasInfo = panjang > 0 && lebar > 0 ? ` Dimensi ruangan: ${panjang}m × ${lebar}m (${(panjang * lebar).toFixed(1)} m²).` : '';

    // Jika Gemini tidak dikonfigurasi, kembalikan respons fallback kosong
    // agar klien dapat menggunakan generateDefaultRab() sendiri.
    if (!ai) {
      res.json({ items: [], source: 'fallback' } satisfies AnalyzeImageResponse);
      return;
    }

    const prompt = `Kamu adalah estimator RAB (Rencana Anggaran Biaya) interior Indonesia.${luasInfo}

Lihat gambar interior ini dengan cermat dan daftarkan SEMUA item yang terlihat, meliputi:
- Furnitur (sofa, meja, kursi, lemari, rak, kasur, dll.)
- Elektronik (TV, AC, lampu, kipas, dll.)
- Dekorasi (tanaman hias, lukisan, karpet, bantal, vas, dll.)
- Material finishing yang terlihat (cat dinding, wallpaper, lantai kayu/keramik, plafon, dll.)
- Jasa pemasangan jika relevan

ATURAN:
1. Balas HANYA dengan JSON array yang valid, tidak ada teks lain di luar JSON.
2. Setiap objek wajib memiliki field: name, category, estimatedPriceIDR, qty, unit.
3. "name" dalam Bahasa Indonesia, deskriptif (contoh: "Sofa L-Shape 3 Seater", bukan hanya "sofa").
4. "category" hanya salah satu dari: "Furniture", "Elektronik", "Dekorasi", "Finishing & Cat", "Jasa".
5. "estimatedPriceIDR" adalah harga satuan wajar di pasaran Indonesia (integer, tanpa titik/koma).
6. "qty" adalah jumlah unit yang terlihat (integer >= 1).
7. "unit" adalah satuan yang tepat: "unit", "buah", "set", "m²", "m", "titik", dll.
8. Sertakan item kecil yang terlihat seperti bantal, vas, karpet, tanaman, dll.
9. Jangan sertakan item yang tidak terlihat dalam gambar.
10. Estimasi harga disesuaikan dengan kualitas yang terlihat (ekonomis/menengah/premium).

Contoh format output:
[
  {"name":"Sofa 3 Seater Fabric Abu-abu","category":"Furniture","estimatedPriceIDR":4500000,"qty":1,"unit":"unit"},
  {"name":"Meja Kopi Bulat Kayu","category":"Furniture","estimatedPriceIDR":850000,"qty":1,"unit":"unit"},
  {"name":"Smart TV 43 inci","category":"Elektronik","estimatedPriceIDR":4200000,"qty":1,"unit":"unit"},
  {"name":"Karpet Area 160×230 cm","category":"Dekorasi","estimatedPriceIDR":650000,"qty":1,"unit":"unit"},
  {"name":"Cat Dinding Putih Broken White","category":"Finishing & Cat","estimatedPriceIDR":85000,"qty":12,"unit":"m²"}
]`;

    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: TEXT_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: data64 } },
              ],
            },
          ],
        }),
        TEXT_TIMEOUT_MS,
        TEXT_MODEL,
      );

      const raw = response.text?.trim() ?? '';

      // Ekstrak JSON array dari respons (tolak teks di luar array)
      const jsonMatch = /\[[\s\S]*\]/.exec(raw);
      if (!jsonMatch) {
        logger.warn('ai_analyze_invalid_json', {
          requestId: res.locals.requestId,
          uid,
          sample: raw.slice(0, 200),
        });
        res.json({ items: [], source: 'fallback' } satisfies AnalyzeImageResponse);
        return;
      }

      type RawItem = {
        name?: unknown;
        category?: unknown;
        estimatedPriceIDR?: unknown;
        qty?: unknown;
        unit?: unknown;
      };

      const VALID_CATEGORIES: RabItem['category'][] = [
        'Furniture', 'Elektronik', 'Dekorasi', 'Finishing & Cat', 'Jasa',
      ];

      const parsed: RawItem[] = JSON.parse(jsonMatch[0]);
      const items: AnalyzeImageResponse['items'] = parsed
        .filter((item): item is RawItem => item && typeof item === 'object')
        .map((item, idx) => {
          const rawCategory = String(item.category ?? '');
          const category: RabItem['category'] = VALID_CATEGORIES.includes(rawCategory as RabItem['category'])
            ? (rawCategory as RabItem['category'])
            : 'Furniture';
          return {
            name: String(item.name ?? `Item ${idx + 1}`),
            category,
            price: Math.max(0, Math.round(Number(item.estimatedPriceIDR ?? 0))),
            qty: Math.max(1, Math.round(Number(item.qty ?? 1))),
            unit: String(item.unit ?? 'unit'),
          };
        })
        .filter((item) => item.name && item.price > 0);

      res.json({ items, source: 'ai' } satisfies AnalyzeImageResponse);
    } catch (error) {
      logger.error('ai_analyze_failed', {
        requestId: res.locals.requestId,
        uid,
        error,
      });
      // Jangan lempar error ke klien — fallback agar klien bisa pakai default
      res.json({ items: [], source: 'fallback' } satisfies AnalyzeImageResponse);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    if (guardOrder(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res, 'Masuk dulu untuk membuat pesanan.');
    if (!uid) return;
    const admin = await requireOrderAdmin(res);
    if (!admin) return;

    try {
      const order = await createServerOrder(admin, uid, req.body);
      res.status(201).json({ order });
    } catch (error) {
      if (error instanceof OrderError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // Impor pesanan tamu yang dibuat sebelum pengguna masuk. Hanya status awal
  // yang diterima; server menghitung ulang total dan memotong stok.
  app.post('/api/orders/import', async (req, res, next) => {
    if (guardOrder(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res, 'Masuk dulu untuk menyinkronkan pesanan.');
    if (!uid) return;
    const admin = await requireOrderAdmin(res);
    if (!admin) return;

    try {
      const ids = await importServerOrders(admin, uid, req.body);
      res.json({ imported: ids.length, ids });
    } catch (error) {
      if (error instanceof OrderError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // Buat tautan pembayaran Midtrans Snap untuk pesanan milik pengguna.
  app.post('/api/payments/create', async (req, res, next) => {
    if (guardPayment(req, res)) return;
    if (!(await requireAppCheck(req, res))) return;
    const uid = await requireAuth(req, res, 'Masuk dulu untuk membayar pesanan.');
    if (!uid) return;
    const admin = await requireOrderAdmin(res);
    if (!admin) return;

    try {
      const payment = await createSnapPayment(admin, uid, req.body?.orderId);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof PaymentError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // Callback Midtrans. Tidak memakai App Check/auth karena dipanggil provider;
  // keaslian dijamin oleh signature SHA512 dengan server key.
  app.post('/api/payments/midtrans/webhook', async (req, res, next) => {
    if (guardWebhook(req, res)) return;

    try {
      const admin = await getAdmin();
      if (!admin) {
        res.status(503).json({ error: 'Pembayaran online belum siap di server.' });
        return;
      }
      const result = await handleMidtransWebhook(admin, req.body);
      res.json({ ok: true, status: result.status });
    } catch (error) {
      if (error instanceof PaymentError) {
        logger.warn('midtrans_webhook_rejected', {
          requestId: res.locals.requestId,
          status: error.status,
          message: error.message,
        });
        res.status(error.status).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // Endpoint API yang tidak dikenal jangan jatuh ke index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  });

  if (isDev) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    if (!existsSync(path.join(distDir, 'index.html'))) {
      logger.error('dist_missing', { hint: 'Jalankan npm run build terlebih dahulu.' });
      process.exit(1);
    }
    app.use(express.static(distDir, { index: false }));
    // SPA fallback supaya rute seperti /properti/seed-1 tidak 404 saat di-refresh.
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use(createErrorHandler(logger));

  const server = app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n  PROPERTIKA AI siap di ${url}`);
    console.log(`  Mode      : ${isDev ? 'development (Vite HMR)' : 'production'}`);
    const textStatus = ai ? `teks: ${TEXT_MODEL_CHAIN.join(' → ')}` : 'teks: nonaktif (GEMINI_API_KEY kosong)';
    const imageStatus =
      IMAGE_PROVIDER === 'cloudflare'
        ? `gambar: aktif via Cloudflare ${CLOUDFLARE_IMAGE_MODEL}`
        : IMAGE_PROVIDER === 'gemini'
          ? `gambar: aktif via Gemini ${IMAGE_MODEL}`
          : 'gambar: nonaktif (Cloudflare/Gemini belum diisi)';
    const storageStatus =
      STORAGE_DRIVER === 'cloudinary'
        ? `Cloudinary (${CLOUDINARY_CLOUD_NAME})`
        : 'disk server lokal (folder uploads/)';
    console.log(`  Fitur AI  : ${textStatus} | ${imageStatus}`);
    console.log(`  Penyimpanan: ${storageStatus}\n`);
    logger.info('server_started', {
      port: PORT,
      mode: isDev ? 'development' : 'production',
      textModel: TEXT_MODEL,
      imageProvider: IMAGE_PROVIDER,
      storageDriver: STORAGE_DRIVER,
      appCheckRequired: APP_CHECK_REQUIRED,
      quotaBackend: AI_QUOTA_BACKEND,
      logLevel: resolveLogLevel(),
    });
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info('server_shutdown', { signal });
    server.close((error) => {
      if (error) {
        logger.error('server_shutdown_failed', { error });
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('server_shutdown_timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

interface AiFailure {
  status: number;
  message: string;
}

/**
 * Terjemahkan galat Gemini menjadi status HTTP yang tepat dan penjelasan yang
 * bisa ditindaklanjuti. Kuota gambar pada Free Tier memang 0, jadi pengguna
 * perlu tahu bahwa yang kurang adalah billing, bukan kuncinya.
 */
function classifyAiError(error: unknown, context: 'text' | 'image'): AiFailure {
  const status = (error as { status?: number } | null)?.status ?? 0;
  const raw = error instanceof Error ? error.message : String(error);
  const detail = describeError(error);

  if (raw.toLowerCase().includes('flagged') || raw.includes('3030')) {
    return {
      status: 400,
      message:
        'Gambar atau permintaan Anda terkena filter sensor otomatis (safety filter/false positive) dari AI. Ini umumnya terjadi jika foto memiliki watermark tebal, tekstur dinding tertentu, atau kata dalam prompt yang memicu filter. Coba klik "Generate dengan AI" lagi, gunakan foto tanpa watermark, atau sederhanakan kalimat pada permintaan tambahan.',
    };
  }

  if (status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        context === 'image'
          ? `Kuota pembuatan gambar tidak tersedia. Model gambar Gemini memerlukan billing aktif di proyek Google Cloud — kuota Free Tier untuk model gambar adalah 0. Aktifkan billing di https://console.cloud.google.com/billing lalu coba lagi. Detail: ${detail}`
          : `Kuota Gemini sedang habis. Tunggu sebentar, atau aktifkan billing di proyek Google Cloud. Detail: ${detail}`,
    };
  }

  if (status === 503 || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: `Model AI sedang sibuk dan belum merespons. Coba lagi beberapa saat lagi. Detail: ${detail}`,
    };
  }

  if (status === 404) {
    return {
      status: 502,
      message: `Model AI tidak tersedia untuk kunci API ini. Atur model lain lewat GEMINI_TEXT_MODEL / GEMINI_IMAGE_MODEL di berkas .env. Detail: ${detail}`,
    };
  }

  return { status: 502, message: detail };
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { error: reason });
});

process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  process.exit(1);
});

startServer().catch((error) => {
  logger.error('server_start_failed', { error });
  process.exit(1);
});
