import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Lock, Mail, Store } from 'lucide-react';
import { useAuth, authErrorMessage, roleLabel } from '../lib/auth';
import { authConsoleUrl, currentHost, firebaseConfigured } from '../firebase';
import { store, useAppState } from '../lib/store';
import { SELLER_TYPES, type GeoCoords, type SellerProfile, type UserRole } from '../types';
import AddressPicker from '../components/AddressPicker';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';

const EMPTY_SELLER: SellerProfile = {
  businessName: '',
  sellerType: '',
  phone: '',
  city: '',
  address: '',
  npwp: '',
  description: '',
  coords: null,
};

/** Hanya izinkan tujuan berupa path internal, supaya tidak bisa dipakai mengalihkan ke situs lain. */
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

interface RoleConfig {
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  dashboard: string;
  loginPath: string;
  registerPath: string;
  otherLoginPath: string;
  otherLoginLabel: string;
  otherRegisterPath: string;
  otherRegisterLabel: string;
}

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  buyer: {
    loginTitle: 'Masuk Pembeli',
    loginSubtitle: 'Masuk untuk menyimpan favorit dan mengirim permintaan ke penjual.',
    registerTitle: 'Daftar Akun Pembeli',
    registerSubtitle: 'Buat akun pembeli untuk mencari properti, menyimpan favorit, dan menghubungi penjual.',
    dashboard: '/dashboard-user',
    loginPath: '/masuk',
    registerPath: '/daftar',
    otherLoginPath: '/masuk-penjual',
    otherLoginLabel: 'Masuk sebagai Penjual',
    otherRegisterPath: '/daftar-penjual',
    otherRegisterLabel: 'Daftar sebagai Penjual',
  },
  seller: {
    loginTitle: 'Masuk Penjual',
    loginSubtitle: 'Masuk untuk memasang iklan, mengelola properti, dan membaca pesan calon pembeli.',
    registerTitle: 'Daftar Akun Penjual',
    registerSubtitle: 'Lengkapi kriteria penjual untuk memasang properti di marketplace.',
    dashboard: '/dashboard-seller',
    loginPath: '/masuk-penjual',
    registerPath: '/daftar-penjual',
    otherLoginPath: '/masuk',
    otherLoginLabel: 'Masuk sebagai Pembeli',
    otherRegisterPath: '/daftar',
    otherRegisterLabel: 'Daftar sebagai Pembeli',
  },
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.55 14.67a6.9 6.9 0 0 1 0-4.41V7.28H1.7a11.5 11.5 0 0 0 0 10.37l3.85-2.98Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.24 15.1 0 12 0A11.5 11.5 0 0 0 1.7 7.28l3.85 2.98C6.46 7.54 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'error' | 'success'; children: ReactNode }) {
  const styles = {
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${styles}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 space-y-1.5">{children}</div>
    </div>
  );
}

/** Ditampilkan kalau Firebase belum diisi sama sekali — aplikasi tetap bisa dijelajahi. */
function UnconfiguredNotice() {
  return (
    <Notice tone="warning">
      <p className="font-semibold">Autentikasi belum dikonfigurasi.</p>
      <p>
        Isi kunci Firebase di berkas <code className="rounded bg-white/70 px-1">.env</code> (lihat{' '}
        <code className="rounded bg-white/70 px-1">.env.example</code>), lalu jalankan ulang server. Sementara ini Anda
        tetap bisa menjelajahi properti, memakai AI Studio, dan menghitung KPR.
      </p>
    </Notice>
  );
}

function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
        {children}
      </div>
      {footer && <div className="mt-5 space-y-1 text-center text-sm text-slate-500">{footer}</div>}
    </div>
  );
}

/** Dipakai bersama oleh halaman masuk, daftar, dan lupa sandi. */
function useAuthForm() {
  const { user, ready, signIn, signUp, signInWithGoogle, sendReset, signOutUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerDisabled, setProviderDisabled] = useState(false);

  const handle = async (action: () => Promise<void>, successMessage: string) => {
    setPending(true);
    setError(null);
    setProviderDisabled(false);
    try {
      await action();
      store.showToast(successMessage, 'success');
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'auth/operation-not-allowed') setProviderDisabled(true);
      setError(authErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return {
    user,
    ready,
    pending,
    error,
    providerDisabled,
    setError,
    handle,
    signIn,
    signUp,
    signInWithGoogle,
    sendReset,
    signOutUser,
  };
}

function ProviderHelp() {
  return (
    <Notice tone="warning">
      <p className="font-semibold">Metode masuk ini belum aktif di Firebase Console.</p>
      <p>
        Buka{' '}
        <a href={authConsoleUrl} target="_blank" rel="noreferrer" className="font-medium underline">
          Authentication → Sign-in method
        </a>
        , aktifkan penyedia <strong>Email/Password</strong> (dan <strong>Google</strong> bila ingin tombol Google), lalu
        coba lagi.
      </p>
      <p>
        Pastikan juga domain <code className="rounded bg-white/70 px-1">{currentHost}</code> ada di daftar{' '}
        <em>Authorized domains</em>.
      </p>
    </Notice>
  );
}

function AuthError({ message, showProviderHelp }: { message: string; showProviderHelp: boolean }) {
  return (
    <div className="mb-4 space-y-3">
      <Notice tone="error">{message}</Notice>
      {showProviderHelp && <ProviderHelp />}
    </div>
  );
}

/** Muncul bila pengguna sudah masuk dengan peran berbeda di portal ini. */
function WrongRoleNotice({ currentRole, expectedRole }: { currentRole: UserRole; expectedRole: UserRole }) {
  const { signOutUser } = useAuth();
  const dashboard = ROLE_CONFIG[currentRole].dashboard;
  return (
    <div className="space-y-4">
      <Notice tone="warning">
        <p className="font-semibold">Anda sudah masuk sebagai {roleLabel(currentRole)}.</p>
        <p>
          Halaman ini khusus untuk {roleLabel(expectedRole)}. Keluar dulu bila ingin masuk dengan akun{' '}
          {roleLabel(expectedRole)}.
        </p>
      </Notice>
      <div className="flex flex-wrap gap-3">
        <Link
          to={dashboard}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
        >
          <Store className="h-4 w-4" />
          Buka dashboard {roleLabel(currentRole)}
        </Link>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}

function LoginPage({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'), cfg.dashboard);
  const form = useAuthForm();
  const { role: currentRole } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (form.ready && form.user && currentRole === role) return <Navigate to={next} replace />;

  const wrongRole = Boolean(form.ready && form.user && currentRole && currentRole !== role);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      form.setError('Email dan kata sandi wajib diisi.');
      return;
    }
    void form.handle(() => form.signIn(email, password, role), `Berhasil masuk sebagai ${roleLabel(role)}.`);
  };

  return (
    <AuthLayout
      title={cfg.loginTitle}
      subtitle={cfg.loginSubtitle}
      footer={
        <>
          <p>
            Belum punya akun?{' '}
            <Link to={cfg.registerPath} className="font-semibold text-emerald-900 underline">
              Daftar {roleLabel(role)}
            </Link>
          </p>
          <p>
            <Link to={cfg.otherLoginPath} className="font-medium text-emerald-900 hover:underline">
              {cfg.otherLoginLabel}
            </Link>
          </p>
        </>
      }
    >
      {!firebaseConfigured ? (
        <UnconfiguredNotice />
      ) : wrongRole && currentRole ? (
        <WrongRoleNotice currentRole={currentRole} expectedRole={role} />
      ) : (
        <>
          {form.error && <AuthError message={form.error} showProviderHelp={form.providerDisabled} />}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  className={`${inputClass} pl-9`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Kata sandi</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  className={`${inputClass} pl-9`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </label>

            <div className="flex justify-end">
              <Link to="/lupa-sandi" className="text-sm font-medium text-emerald-900 hover:underline">
                Lupa kata sandi?
              </Link>
            </div>

            <button
              type="submit"
              disabled={form.pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {form.pending ? 'Memproses...' : `Masuk sebagai ${roleLabel(role)}`}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            atau
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={form.pending}
            onClick={() => void form.handle(() => form.signInWithGoogle(role), 'Berhasil masuk dengan Google.')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <GoogleIcon />
            Masuk dengan Google
          </button>
        </>
      )}
    </AuthLayout>
  );
}

function RegisterPage({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role];
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'), cfg.dashboard);
  const form = useAuthForm();
  const { role: currentRole } = useAppState();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [seller, setSeller] = useState<SellerProfile>(EMPTY_SELLER);
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCoords, setBuyerCoords] = useState<GeoCoords | null>(null);

  if (form.ready && form.user && currentRole === role) return <Navigate to={next} replace />;

  const wrongRole = Boolean(form.ready && form.user && currentRole && currentRole !== role);

  const validateSeller = (): boolean => {
    if (!seller.businessName.trim()) {
      form.setError('Nama usaha / brand wajib diisi.');
      return false;
    }
    if (!seller.sellerType) {
      form.setError('Jenis penjual wajib dipilih.');
      return false;
    }
    if (!seller.phone.trim()) {
      form.setError('Nomor telepon / WhatsApp wajib diisi.');
      return false;
    }
    if (!seller.city.trim()) {
      form.setError('Kota domisili wajib diisi.');
      return false;
    }
    if (!seller.address.trim()) {
      form.setError('Alamat usaha wajib diisi.');
      return false;
    }
    return true;
  };

  const finalizeSeller = () => {
    if (role === 'seller') {
      store.saveSellerRegistration(seller);
      return;
    }
    if (buyerAddress.trim() || buyerCoords) {
      store.saveBuyerAddress(buyerAddress, buyerCoords);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim()) {
      form.setError('Nama depan wajib diisi.');
      return;
    }
    if (!email.trim()) {
      form.setError('Email wajib diisi.');
      return;
    }
    if (password.length < 6) {
      form.setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirm) {
      form.setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (role === 'seller' && !validateSeller()) return;

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    void form.handle(async () => {
      await form.signUp(fullName, email, password, role);
      finalizeSeller();
    }, role === 'seller' ? 'Akun penjual berhasil dibuat. Selamat berjualan!' : 'Akun berhasil dibuat. Selamat datang!');
  };

  const googleSignUp = () => {
    if (role === 'seller' && !validateSeller()) return;
    void form.handle(async () => {
      await form.signInWithGoogle(role);
      finalizeSeller();
    }, role === 'seller' ? 'Akun penjual terhubung dengan Google.' : 'Akun Google terhubung.');
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-[#0B2457] px-4 py-12 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#F96B08] opacity-25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-blue-600 opacity-30 blur-3xl"
      />
      <form onSubmit={submit} className="auth-register relative">
        <p className="form-title">{cfg.registerTitle}</p>
        <p className="form-message">{cfg.registerSubtitle}</p>

        {!firebaseConfigured ? (
          <UnconfiguredNotice />
        ) : wrongRole && currentRole ? (
          <WrongRoleNotice currentRole={currentRole} expectedRole={role} />
        ) : (
          <>
            {form.error && <AuthError message={form.error} showProviderHelp={form.providerDisabled} />}

            <div className="field-row">
              <label>
                <input
                  required
                  placeholder=" "
                  autoComplete="given-name"
                  className="field"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
                <span>Nama depan</span>
              </label>

              <label>
                <input
                  placeholder=" "
                  autoComplete="family-name"
                  className="field"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
                <span>Nama belakang</span>
              </label>
            </div>

            <label>
              <input
                required
                type="email"
                placeholder=" "
                autoComplete="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <span>Email</span>
            </label>

            <label>
              <input
                required
                type="password"
                placeholder=" "
                autoComplete="new-password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span>Kata sandi</span>
            </label>

            <label>
              <input
                required
                type="password"
                placeholder=" "
                autoComplete="new-password"
                className="field"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              <span>Konfirmasi kata sandi</span>
            </label>

            {role === 'buyer' && (
              <div className="mt-1">
                <AddressPicker
                  address={buyerAddress}
                  coords={buyerCoords}
                  onAddressChange={setBuyerAddress}
                  onCoordsChange={setBuyerCoords}
                  label="Alamat lengkap"
                  labelClassName="field-label"
                  inputClassName="field-select"
                  placeholder="Alamat lengkap domisili Anda"
                  hint="Opsional. Dengan alamat/titik lokasi, Anda bisa melihat jarak properti ke tempat Anda."
                />
              </div>
            )}

            {role === 'seller' && (
              <div className="mt-1 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-200">
                  Kriteria Penjual
                </p>

                <label className="block">
                  <span className="field-label">Nama usaha / brand</span>
                  <input
                    className="field-select"
                    value={seller.businessName}
                    onChange={(event) => setSeller({ ...seller, businessName: event.target.value })}
                    placeholder="Contoh: Griya Nusantara"
                  />
                </label>

                <label className="block">
                  <span className="field-label">Jenis penjual</span>
                  <select
                    className="field-select"
                    value={seller.sellerType}
                    onChange={(event) =>
                      setSeller({ ...seller, sellerType: event.target.value as SellerProfile['sellerType'] })
                    }
                  >
                    <option value="">Pilih jenis penjual</option>
                    {SELLER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="field-row">
                  <label className="block">
                    <span className="field-label">Telepon / WhatsApp</span>
                    <input
                      className="field-select"
                      inputMode="tel"
                      value={seller.phone}
                      onChange={(event) => setSeller({ ...seller, phone: event.target.value })}
                      placeholder="0812-3456-7890"
                    />
                  </label>
                  <label className="block">
                    <span className="field-label">Kota</span>
                    <input
                      className="field-select"
                      value={seller.city}
                      onChange={(event) => setSeller({ ...seller, city: event.target.value })}
                      placeholder="Jakarta"
                    />
                  </label>
                </div>

                <AddressPicker
                  address={seller.address}
                  coords={seller.coords ?? null}
                  onAddressChange={(value) => setSeller((previous) => ({ ...previous, address: value }))}
                  onCoordsChange={(value) => setSeller((previous) => ({ ...previous, coords: value }))}
                  onCityChange={(value) => setSeller((previous) => ({ ...previous, city: value }))}
                  label="Alamat usaha"
                  labelClassName="field-label"
                  inputClassName="field-select"
                  placeholder="Alamat lengkap kantor / usaha"
                  hint="Deteksi lokasi agar pembeli bisa melihat jarak dari toko ke tempat mereka."
                />

                <label className="block">
                  <span className="field-label">NPWP (opsional)</span>
                  <input
                    className="field-select"
                    value={seller.npwp}
                    onChange={(event) => setSeller({ ...seller, npwp: event.target.value })}
                    placeholder="00.000.000.0-000.000"
                  />
                </label>

                <label className="block">
                  <span className="field-label">Deskripsi singkat (opsional)</span>
                  <textarea
                    className="field-area"
                    value={seller.description}
                    onChange={(event) => setSeller({ ...seller, description: event.target.value })}
                    placeholder="Ceritakan pengalaman dan fokus jualan Anda."
                  />
                </label>
              </div>
            )}

            <button type="submit" disabled={form.pending} className="submit">
              {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {form.pending ? 'Membuat akun...' : `Daftar sebagai ${roleLabel(role)}`}
            </button>

            <div className="my-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              atau
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <button type="button" disabled={form.pending} onClick={googleSignUp} className="google-btn">
              <GoogleIcon />
              Daftar dengan Google
            </button>
          </>
        )}

        <p className="signin">
          Sudah punya akun? <Link to={cfg.loginPath}>Masuk {roleLabel(role)}</Link>
        </p>
        <p className="signin">
          Ingin akun {role === 'seller' ? 'pembeli' : 'penjual'}?{' '}
          <Link to={cfg.otherRegisterPath}>{cfg.otherRegisterLabel}</Link>
        </p>
      </form>
    </div>
  );
}

export function MasukPage() {
  return <LoginPage role="buyer" />;
}

export function MasukPenjualPage() {
  return <LoginPage role="seller" />;
}

export function DaftarPage() {
  return <RegisterPage role="buyer" />;
}

export function DaftarPenjualPage() {
  return <RegisterPage role="seller" />;
}

export function LupaSandiPage() {
  const form = useAuthForm();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSent(false);
    await form.handle(async () => {
      await form.sendReset(email);
      setSent(true);
    }, 'Tautan atur ulang dikirim.');
  };

  return (
    <AuthLayout
      title="Lupa Kata Sandi"
      subtitle="Masukkan email akun Anda, kami akan mengirim tautan untuk membuat kata sandi baru."
      footer={
        <>
          <Link to="/masuk" className="font-semibold text-emerald-900 underline">
            Masuk Pembeli
          </Link>
          {' · '}
          <Link to="/masuk-penjual" className="font-semibold text-emerald-900 underline">
            Masuk Penjual
          </Link>
        </>
      }
    >
      {!firebaseConfigured ? (
        <UnconfiguredNotice />
      ) : (
        <>
          {form.error && <AuthError message={form.error} showProviderHelp={form.providerDisabled} />}
          {sent && (
            <div className="mb-4">
              <Notice tone="success">
                Tautan atur ulang sudah dikirim ke <strong>{email}</strong>. Periksa kotak masuk dan folder spam Anda.
              </Notice>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  className={`${inputClass} pl-9`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nama@email.com"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={form.pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-5 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {form.pending ? 'Mengirim...' : 'Kirim tautan atur ulang'}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
