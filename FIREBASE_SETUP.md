# Firebase Setup Checklist untuk Propertika AI

> **Target**: Mode Firestore production-ready dengan keamanan penuh.
> **Waktu estimasi**: 30-45 menit.

---

## 1. Buat Project Firebase Baru

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Klik **"Add project"** → Nama: `propertika-ai-prod` (atau nama Anda)
3. **Disable** Google Analytics (opsional, tapi gratis)
4. Tunggu selesai → Klik **"Continue"**

---

## 2. Authentication (Wajib)

### 2.1 Enable Sign-in Methods
1. **Authentication** → **Sign-in method** tab
2. **Email/Password** → Enable → **Save**
3. **Google** → Enable → Isi **Project support email** → **Save**
   - Catat **Web client ID** & **Web client secret** (untuk nanti)

### 2.2 Authorized Domains
1. **Authentication** → **Settings** → **Authorized domains**
2. Tambahkan:
   - `localhost`
   - `your-app.onrender.com` (atau domain Railway)
   - `your-custom-domain.com` (setelah custom domain ready)

---

## 3. Firestore Database (Wajib)

### 3.1 Create Database
1. **Firestore Database** → **Create database**
2. **Start in production mode** (rules nanti di-deploy)
3. **Location**: `asia-southeast2` (Jakarta) atau `us-central1`
4. **Enable** → Tunggu selesai

### 3.2 Deploy Security Rules
```bash
# Local terminal
cd propertika-ai
npx firebase-tools login
npx firebase-tools use propertika-ai-prod  # project ID Anda
npx firebase-tools deploy --only firestore:rules
```

### 3.3 Create Indexes (Otomatis via error message)
- Saat pertama jalan, cek log server → link "Create index" di error Firestore
- Atau deploy dari CLI: `npx firebase-tools deploy --only firestore:indexes`

---

## 4. Firebase Admin SDK (Wajib untuk Mode Firestore)

### 4.1 Generate Service Account
1. **Project Settings** (⚙️) → **Service accounts** tab
2. **Generate new private key** → **Generate key** → Simpan `service-account.json`
3. **JANGAN commit file ini** — sudah di `.gitignore`

### 4.2 Convert ke One-line JSON untuk `.env`
```bash
# Mac/Linux
cat service-account.json | jq -c . | sed 's/"/\\"/g'

# Windows PowerShell
Get-Content service-account.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress | ForEach-Object { $_ -replace '"', '\"' }
```

Hasilnya paste ke `FIREBASE_SERVICE_ACCOUNT` di `.env`

---

## 5. App Check (Disarankan Production)

### 5.1 Setup reCAPTCHA Enterprise
1. **App Check** → **Apps** → **Add app** → **Web** (</> icon)
2. **Provider**: **Fraud Defense (reCAPTCHA Enterprise)**
3. Domain: `localhost`, `your-app.onrender.com`, `your-domain.com`
4. **Register** → Catat **Site Key**

### 5.2 Debug Token (Local Development)
1. **App Check** → **Apps** → pilih app Anda → **Manage debug tokens**
2. **Add debug token** → Copy token
3. Isi `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` di `.env.local`

### 5.3 Enable Enforcement (Setelah Deploy)
1. **App Check** → **Apps** → **Enforce** untuk:
   - **Firestore**
   - **Cloud Functions** (kalau dipakai)
2. Set `APP_CHECK_REQUIRED=true` di `.env` production

---

## 6. Firebase Client Config (Untuk `.env`)

Dari **Project Settings** → **General** → **Your apps** → pilih Web app (</>):

| Variable `.env` | Sumber di Firebase Console |
|-----------------|---------------------------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

---

## 7. Admin User (First Admin)

Setelah deploy & login pertama kali:

1. Buka **Authentication** → **Users** → copy **UID** user Anda
2. Buka **Firestore** → **Start collection** → `admins`
3. **Document ID**: paste UID tadi
4. Field: `createdAt` (timestamp), `email` (string)
5. **Save**

Sekarang Anda bisa akses `/admin` dashboard.

---

## 8. Platform Config (Promo, Banner, Category)

Di Firestore, collection `platform`, document `main`:

```json
{
  "vouchers": [
    {"code": "WELCOME10", "discountPercent": 10, "maxDiscount": 50000, "minOrder": 100000, "startAt": "2026-01-01T00:00:00Z", "endAt": "2026-12-31T23:59:59Z", "usageLimit": 100, "usedCount": 0}
  ],
  "banners": [
    {"title": "Flash Sale Akhir Tahun!", "subtitle": "Diskon hingga 50%", "imageUrl": "https://...", "link": "/flash-sale", "enabled": true}
  ],
  "categoryLabels": {
    "Rumah": "🏠 Rumah",
    "Apartemen": "🏢 Apartemen",
    "Tanah": "🟫 Tanah",
    "Furniture": "🛋️ Furniture"
  },
  "hiddenCategories": [],
  "listingOverrides": {}
}
```

---

## 9. Verify Deployment

Setelah deploy ke Render/Railway:

| Check | URL | Expected |
|-------|-----|----------|
| Health | `https://your-app.onrender.com/api/health` | `{"status":"ok","ordersServerEnabled":true,"paymentsEnabled":false,...}` |
| Home | `https://your-app.onrender.com/` | Halaman beranda load |
| Auth | `https://your-app.onrender.com/daftar` | Bisa register/login |
| Firestore | `https://your-app.onrender.com/properti` | Data seed + listing user |
| Admin | `https://your-app.onrender.com/admin` | Akses setelah jadi admin |

---

## 10. Custom Domain (Optional)

### Render
1. **Settings** → **Custom Domains** → **Add Domain**
2. Ikuti instruksi DNS (CNAME ke `your-app.onrender.com`)
3. Tunggu SSL provisioned

### Update Firebase
1. **Auth** → **Authorized domains** → add custom domain
2. **App Check** → **Apps** → add custom domain
3. Update `APP_URL=https://your-domain.com` di `.env` → redeploy

---

## 11. Backup Automation (Optional)

### Render Cron Job (Uncomment di `render.yaml`)
```yaml
  - type: cron
    name: firestore-backup
    schedule: "0 2 * * *"
    command: npm run backup
```

### Atau GitHub Actions (Sudah ada di `.github/workflows/ci.yml`)
- Tambah job `backup` yang jalan scheduled

---

## 🔐 Security Checklist (Pre-Launch)

- [ ] `APP_CHECK_REQUIRED=true` di production
- [ ] `MIDTRANS_IS_PRODUCTION=true` (kalau pakai payment)
- [ ] `LOG_LEVEL=info` (bukan `debug`)
- [ ] Firebase Auth: **Email/Password** + **Google** enabled
- [ ] Firestore rules deployed & tested (`npm run test:rules`)
- [ ] Admin user created di `admins/{uid}`
- [ ] `platform/main` document exists
- [ ] Custom domain + HTTPS working
- [ ] Backup tested (run `npm run backup:restore -- --confirm --merge` ke project terpisah)

---

## 🆘 Troubleshooting Cepat

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `ordersServerEnabled: false` | Firebase Admin tidak valid | Cek `FIREBASE_SERVICE_ACCOUNT` format JSON one-line |
| `paymentsEnabled: false` | Midtrans key kosong | Isi `MIDTRANS_SERVER_KEY` atau biarkan COD only |
| `401 Unauthorized` di AI/upload | App Check gagal | Cek `VITE_FIREBASE_APP_CHECK_SITE_KEY` & domain authorized |
| `503` di checkout | Admin SDK tidak init | Log server → cek `adminConfigured()` error |
| CORS error | Domain tidak diizinkan | Tambah domain ke Firebase Auth + App Check |
| Gambar AI 429 | Kuota habis | Cek Cloudflare Workers AI quota (10k/day free) |

---

## 📞 Butuh Bantuan?

- **Firebase Console**: https://console.firebase.google.com/project/propertika-ai-prod
- **Render Dashboard**: https://dashboard.render.com
- **Logs**: `Render → propertika-ai → Logs` atau `railway logs`
- **Health Check**: `curl https://your-app.onrender.com/api/health`