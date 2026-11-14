import type {
  AnalyzeImageRequest,
  AnalyzeImageResponse,
  DescriptionRequest,
  DescriptionResponse,
  HealthResponse,
  ImageRequest,
  ImageResponse,
} from '../types';
import { getAppCheckToken, loadFirebase } from '../firebase';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new Error('Tidak dapat menghubungi server. Pastikan aplikasi berjalan dengan benar.');
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Permintaan gagal (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

/** Ambil ID token Firebase dan token App Check agar endpoint AI hanya bisa dipakai akun masuk. */
async function authHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const bundle = await loadFirebase();
    const user = bundle?.auth.currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } catch {
    // Biarkan tanpa header; server akan membalas 401 dengan pesan yang jelas.
  }

  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  return headers;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
}

/** Status kemampuan AI. Jika server mati, anggap AI tidak aktif alih-alih melempar error. */
export async function fetchHealth(): Promise<HealthResponse> {
  try {
    return await request<HealthResponse>('/api/health');
  } catch {
    return { aiEnabled: false, textModel: '-', imageModel: '-' };
  }
}

export function generateDescription(payload: DescriptionRequest): Promise<DescriptionResponse> {
  return postJson<DescriptionResponse>('/api/generate-description', payload);
}

export function generateImage(payload: ImageRequest): Promise<ImageResponse> {
  return postJson<ImageResponse>('/api/generate-image', payload);
}

/**
 * Kirim gambar hasil generate ke Gemini untuk dianalisis.
 * Server akan mengenali semua item yang terlihat dan mengembalikan daftar RAB.
 * Jika Gemini tidak dikonfigurasi atau gagal, server mengembalikan items:[].
 */
export function analyzeImage(payload: AnalyzeImageRequest): Promise<AnalyzeImageResponse> {
  return postJson<AnalyzeImageResponse>('/api/analyze-image', payload);
}
