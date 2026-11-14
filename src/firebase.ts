/**
 * Konfigurasi dan pemuat Firebase.
 *
 * Modul ini sengaja TIDAK mengimpor paket Firebase secara langsung. Paket
 * `firebase/*` dimuat belakangan lewat `import()` dinamis supaya halaman pertama
 * tetap ringan; pemulihan sesi berjalan di latar belakang setelah aplikasi tampil.
 *
 * Konfigurasi diambil dari variabel lingkungan `VITE_FIREBASE_*` bila ada. Kalau
 * tidak diisi, dipakai nilai bawaan di `firebase-applet-config.json` (proyek yang
 * dibuat AI Studio).
 *
 * Kunci API Firebase untuk aplikasi web memang dirancang untuk terlihat publik —
 * yang melindungi data Anda adalah aturan keamanan Firestore dan daftar domain
 * yang diizinkan di Firebase Console, bukan kerahasiaan kunci ini.
 */
import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { AppCheck } from 'firebase/app-check';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

const env = import.meta.env;
const applet = appletConfig as Record<string, string | undefined>;

function pick(envValue: string | undefined, fallback: string | undefined): string {
  const trimmed = envValue?.trim();
  return trimmed ? trimmed : (fallback ?? '');
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: pick(env.VITE_FIREBASE_API_KEY, applet.apiKey),
  authDomain: pick(env.VITE_FIREBASE_AUTH_DOMAIN, applet.authDomain),
  projectId: pick(env.VITE_FIREBASE_PROJECT_ID, applet.projectId),
  storageBucket: pick(env.VITE_FIREBASE_STORAGE_BUCKET, applet.storageBucket),
  messagingSenderId: pick(env.VITE_FIREBASE_MESSAGING_SENDER_ID, applet.messagingSenderId),
  appId: pick(env.VITE_FIREBASE_APP_ID, applet.appId),
};

/** Nama basis data Firestore. Boleh kosong untuk memakai basis data bawaan. */
export const firestoreDatabaseId = pick(env.VITE_FIREBASE_FIRESTORE_DB, applet.firestoreDatabaseId);

/**
 * Kunci situs reCAPTCHA Enterprise (Fraud Defense) untuk Firebase App Check.
 * Bila kosong, App Check tidak diinisialisasi dan server harus dijalankan tanpa
 * APP_CHECK_REQUIRED.
 */
export const appCheckSiteKey = env.VITE_FIREBASE_APP_CHECK_SITE_KEY?.trim() ?? '';

/** True kalau tiga nilai wajib sudah terisi sehingga Firebase bisa diinisialisasi. */
export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

/** Nama domain tempat aplikasi ini disajikan, untuk ditambahkan ke daftar domain yang diizinkan. */
export const currentHost = typeof window === 'undefined' ? '' : window.location.hostname;

/** Tautan langsung ke pengaturan penyedia masuk pada proyek Firebase yang dipakai. */
export const authConsoleUrl = firebaseConfig.projectId
  ? `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`
  : 'https://console.firebase.google.com/';

interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  appCheck: AppCheck | null;
}

let bundlePromise: Promise<FirebaseBundle | null> | null = null;

async function createBundle(): Promise<FirebaseBundle | null> {
  if (!firebaseConfigured) return null;

  const [{ getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);

  const app = getApps()[0] ?? initializeApp(firebaseConfig);

  // App Check harus diinisialisasi sebelum layanan Firebase dipakai. Token debug
  // hanya dipakai saat pengembangan lokal; jangan diisi di produksi.
  let appCheck: AppCheck | null = null;
  if (appCheckSiteKey) {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    const debugToken = env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim();
    if (env.DEV && debugToken) {
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  // `getFirestore` dengan nama basis data hanya dipakai kalau namanya diisi, supaya
  // konfigurasi proyek lain yang memakai basis data bawaan tetap jalan.
  const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);

  return { app, auth: getAuth(app), db, appCheck };
}

/** Muat Firebase sekali saja, lalu pakai hasil yang sama untuk seterusnya. */
export function loadFirebase(): Promise<FirebaseBundle | null> {
  bundlePromise ??= createBundle().catch((error) => {
    // Jangan simpan kegagalan supaya percobaan berikutnya masih bisa berhasil.
    bundlePromise = null;
    throw error;
  });
  return bundlePromise;
}

/** Modul `firebase/auth`, dimuat bersamaan dengan inisialisasi. */
export async function loadAuthModule(): Promise<typeof import('firebase/auth')> {
  return import('firebase/auth');
}

/**
 * Ambil token App Check untuk dikirim ke endpoint kustom (`X-Firebase-AppCheck`).
 * Mengembalikan null bila App Check belum dikonfigurasi atau gagal dimuat.
 */
export async function getAppCheckToken(): Promise<string | null> {
  const bundle = await loadFirebase();
  if (!bundle?.appCheck) return null;
  try {
    const { getToken } = await import('firebase/app-check');
    const result = await getToken(bundle.appCheck, false);
    return result.token;
  } catch (error) {
    console.warn('[app-check] gagal mengambil token:', error);
    return null;
  }
}
