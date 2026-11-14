import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Auth, User } from 'firebase/auth';
import { firebaseConfigured, loadAuthModule, loadFirebase } from '../firebase';
import { store } from './store';
import type { AuthUser, UserRole } from '../types';

type AuthModule = typeof import('firebase/auth');

/** Nama peran untuk pesan ke pengguna. */
export function roleLabel(role: UserRole): string {
  return role === 'seller' ? 'penjual' : 'pembeli';
}

/** Pesan saat akun mencoba masuk lewat portal peran yang salah. */
export function roleMismatchMessage(actual: UserRole): string {
  const otherPage = actual === 'seller' ? '/masuk-penjual' : '/masuk';
  const otherLabel = actual === 'seller' ? 'Masuk Penjual' : 'Masuk Pembeli';
  return `Akun ini terdaftar sebagai ${roleLabel(actual)}. Silakan masuk melalui halaman ${otherLabel} (${otherPage}).`;
}

/** Ubah kode kesalahan Firebase menjadi kalimat yang bisa dimengerti pengguna. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/missing-email': 'Email wajib diisi.',
    'auth/missing-password': 'Kata sandi wajib diisi.',
    'auth/weak-password': 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.',
    'auth/email-already-in-use': 'Email ini sudah terdaftar. Coba masuk saja.',
    'auth/user-not-found': 'Akun dengan email ini tidak ditemukan.',
    'auth/wrong-password': 'Kata sandi salah.',
    'auth/invalid-credential': 'Email atau kata sandi salah.',
    'auth/invalid-login-credentials': 'Email atau kata sandi salah.',
    'auth/user-disabled': 'Akun ini dinonaktifkan.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.',
    'auth/network-request-failed': 'Tidak bisa menghubungi server. Periksa koneksi internet Anda.',
    'auth/popup-closed-by-user': 'Jendela masuk ditutup sebelum selesai.',
    'auth/popup-blocked': 'Jendela masuk diblokir peramban. Izinkan pop-up lalu coba lagi.',
    'auth/cancelled-popup-request': 'Proses masuk dibatalkan.',
    'auth/requires-recent-login': 'Sesi sudah lama. Silakan masuk ulang.',
    'auth/unauthorized-domain': 'Domain aplikasi ini belum diizinkan di Firebase Console.',
    'auth/operation-not-allowed':
      'Metode masuk ini belum diaktifkan di Firebase Console. Buka Authentication → Sign-in method lalu aktifkan.',
  };
  if (map[code]) return map[code];
  const message = error instanceof Error ? error.message : String(error);
  return message || 'Terjadi kesalahan yang tidak diketahui.';
}

interface AuthContextValue {
  /** Pengguna yang sedang masuk, null kalau belum. */
  user: AuthUser | null;
  /** False selama status masuk masih diperiksa, supaya tidak berkedip ke halaman masuk. */
  ready: boolean;
  /** False kalau konfigurasi Firebase belum diisi sama sekali. */
  configured: boolean;
  signIn: (email: string, password: string, role?: UserRole) => Promise<void>;
  signUp: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName?.trim() || (user.email ? user.email.split('@')[0] : 'Pengguna'),
  };
}

/** Jalankan aksi Firebase setelah paket dan instansinya siap. */
async function withAuth<T>(action: (mod: AuthModule, auth: Auth) => Promise<T>): Promise<T> {
  const bundle = await loadFirebase();
  if (!bundle) throw new Error('Firebase belum dikonfigurasi.');
  const mod = await loadAuthModule();
  return action(mod, bundle.auth);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      try {
        const [bundle, mod] = await Promise.all([loadFirebase(), loadAuthModule()]);
        if (cancelled || !bundle) {
          setReady(true);
          return;
        }

        unsubscribe = mod.onAuthStateChanged(
          bundle.auth,
          (firebaseUser) => {
            const next = firebaseUser ? toAuthUser(firebaseUser) : null;
            setUser(next);
            store.setActiveUser(next);
            setReady(true);
          },
          (error) => {
            console.error('[auth] gagal memantau status masuk', error);
            store.setActiveUser(null);
            setReady(true);
          },
        );
      } catch (error) {
        console.error('[auth] Firebase gagal dimuat', error);
        if (!cancelled) {
          store.setActiveUser(null);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, role?: UserRole) => {
    store.setPendingRole(role ?? null);
    try {
      await withAuth(async (mod, auth) => {
        const credential = await mod.signInWithEmailAndPassword(auth, email.trim(), password);
        // Akun baru di peramban ini memakai peran portal yang dipilih.
        store.setActiveUser(toAuthUser(credential.user));
        if (!role) return;

        const actual = store.getRoleFor(credential.user.uid);
        if (actual && actual !== role) {
          await mod.signOut(auth);
          throw new Error(roleMismatchMessage(actual));
        }
      });
    } finally {
      store.setPendingRole(null);
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string, role: UserRole = 'buyer') => {
    store.setPendingRole(role);
    try {
      await withAuth(async (mod, auth) => {
        const credential = await mod.createUserWithEmailAndPassword(auth, email.trim(), password);
        const displayName = name.trim();
        if (!displayName) return;

        await mod.updateProfile(credential.user, { displayName });
        // onAuthStateChanged sempat berjalan sebelum nama tersimpan, jadi perbarui sekali lagi.
        const next = toAuthUser(credential.user);
        setUser(next);
        store.setActiveUser(next);
      });
    } finally {
      store.setPendingRole(null);
    }
  }, []);

  const signInWithGoogle = useCallback(async (role?: UserRole) => {
    store.setPendingRole(role ?? null);
    try {
      await withAuth(async (mod, auth) => {
        const provider = new mod.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await mod.signInWithPopup(auth, provider);
        // Pastikan store sudah mengenal akun (dan peran barunya) sebelum divalidasi.
        const nextUser = toAuthUser(credential.user);
        setUser(nextUser);
        store.setActiveUser(nextUser);
        if (!role) return;

        // Akun baru memakai pendingRole, akun lama mempertahankan perannya.
        const actual = store.getRoleFor(credential.user.uid);
        if (actual && actual !== role) {
          await mod.signOut(auth);
          throw new Error(roleMismatchMessage(actual));
        }
      });
    } finally {
      store.setPendingRole(null);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await withAuth((mod, auth) => mod.signOut(auth));
  }, []);

  const sendReset = useCallback(async (email: string) => {
    await withAuth((mod, auth) => mod.sendPasswordResetEmail(auth, email.trim()));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      configured: firebaseConfigured,
      signIn,
      signUp,
      signInWithGoogle,
      signOutUser,
      sendReset,
    }),
    [user, ready, signIn, signUp, signInWithGoogle, signOutUser, sendReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>.');
  return context;
}
