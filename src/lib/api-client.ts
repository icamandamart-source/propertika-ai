import { getAppCheckToken, loadFirebase } from '../firebase';

/** Header auth Firebase + App Check untuk semua panggilan API server. */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  try {
    const bundle = await loadFirebase();
    const user = bundle?.auth.currentUser;
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  } catch {
    // Server akan membalas 401 dengan pesan yang bisa ditampilkan.
  }
  const appCheckToken = await getAppCheckToken();
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  return headers;
}

export async function postJson(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
  }
}

/** Ambil pesan `error` dari respons API, atau fallback yang ramah pengguna. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {
    // Pakai pesan fallback di bawah.
  }
  return `${fallback} (HTTP ${response.status}).`;
}
