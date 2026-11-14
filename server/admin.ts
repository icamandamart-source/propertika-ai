import type { App, ServiceAccount } from 'firebase-admin/app';
import type { AppCheck } from 'firebase-admin/app-check';
import type { Firestore } from 'firebase-admin/firestore';

export interface AdminServices {
  app: App;
  db: Firestore;
  appCheck: AppCheck;
}

const ADMIN_APP_NAME = 'propertika-server';

let adminPromise: Promise<AdminServices | null> | null = null;

function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.project_id !== 'string' || typeof record.client_email !== 'string') return null;
    if (typeof record.private_key !== 'string') return null;
    return parsed as ServiceAccount;
  } catch {
    return null;
  }
}

/** True bila ada petunjuk kredensial admin yang eksplisit atau bawaan platform cloud. */
export function adminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
      process.env.FIREBASE_CONFIG?.trim() ||
      process.env.FIRESTORE_EMULATOR_HOST?.trim() ||
      process.env.K_SERVICE?.trim() ||
      process.env.GAE_ENV?.trim() ||
      process.env.FUNCTION_TARGET?.trim(),
  );
}

/**
 * Inisialisasi Firebase Admin sekali saja (service account, ADC, atau emulator).
 * Mengembalikan null bila kredensial tidak tersedia; fitur opsional lalu memakai
 * fallback in-memory.
 */
export function getAdmin(): Promise<AdminServices | null> {
  adminPromise ??= initAdmin();
  return adminPromise;
}

async function initAdmin(): Promise<AdminServices | null> {
  try {
    const [{ getApps, initializeApp, cert, applicationDefault }, { getFirestore }, { getAppCheck }] =
      await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/firestore'),
        import('firebase-admin/app-check'),
      ]);

    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim() || undefined;
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim();
    const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
    let app: App;

    if (emulator && !rawServiceAccount) {
      app =
        existing ??
        initializeApp({ projectId: projectId ?? 'demo-propertika' }, ADMIN_APP_NAME);
    } else {
      let credential;
      if (rawServiceAccount) {
        const serviceAccount = parseServiceAccount(rawServiceAccount);
        if (!serviceAccount) throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON service account yang valid.');
        credential = cert(serviceAccount);
      } else {
        credential = applicationDefault();
      }
      app = existing ?? initializeApp({ credential, projectId }, ADMIN_APP_NAME);
    }

    const databaseId = process.env.VITE_FIREBASE_FIRESTORE_DB?.trim();
    const db =
      databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);

    return { app, db, appCheck: getAppCheck(app) };
  } catch (error) {
    console.warn(
      '[firebase-admin] tidak aktif; kuota memakai memori dan App Check tidak diverifikasi server:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}