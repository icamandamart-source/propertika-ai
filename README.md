# PROPERTIKA AI

Marketplace properti berbahasa Indonesia dengan akun pengguna dan fitur AI: penulis deskripsi
iklan otomatis, *room makeover*, simulasi rumah di atas tanah kosong, renovasi, dan simulator
furnitur. Dilengkapi kalkulator KPR, pencarian dengan filter, favorit, dan dashboard penjual.

## Menjalankan aplikasi

Butuh **Node.js 20 atau lebih baru**.

```bash
npm install
```

### Mode pengembangan

```bash
npm run dev
```

Buka <http://localhost:3000>. Express memasang Vite sebagai middleware, jadi perubahan berkas
langsung ter-*reload*.

### Mode produksi

```bash
npm run build
npm start
```

`npm run build` memeriksa tipe, membangun antarmuka ke `dist/`, lalu membundel `server.ts`
menjadi `server.js`. `npm start` menyajikan hasil build beserta *fallback* SPA, sehingga alamat
seperti `/properti/seed-1` tetap terbuka saat dimuat ulang langsung.

## Akun dan masuk

Aplikasi memakai **Firebase Authentication**. Halaman yang tersedia:

| Alamat | Isi |
| --- | --- |
| `/daftar` | Daftar dengan email dan kata sandi, atau dengan akun Google |
| `/masuk` | Masuk ke akun yang sudah ada |
| `/lupa-sandi` | Kirim tautan atur ulang kata sandi lewat email |
| `/favorit`, `/dashboard-user`, `/dashboard-seller` | Hanya bisa dibuka setelah masuk |

Halaman terproteksi otomatis mengalihkan ke `/masuk` bila belum masuk, lalu mengembalikan Anda
ke halaman tujuan setelah berhasil masuk.

### Yang perlu dinyalakan di Firebase Console

Konfigurasi bawaan memakai proyek Firebase yang dibuat AI Studio. Saat README ini ditulis,
**provider Email/Password belum aktif** di proyek tersebut, sehingga pendaftaran dan masuk akan
menampilkan pesan bahwa metode itu belum diaktifkan. Supaya bisa dipakai, buka:

1. [Firebase Console](https://console.firebase.google.com/) → pilih proyek → **Authentication**
   → **Sign-in method** → aktifkan **Email/Password** (dan **Google** bila ingin tombol Google).
2. **Authentication** → **Settings** → **Authorized domains** → pastikan `localhost` dan domain
   tempat aplikasi disajikan sudah terdaftar.

Aplikasi akan memberi tahu Anda dengan tepat bila langkah ini belum dilakukan — lengkap dengan
tautan ke halaman pengaturannya.

### Memakai proyek Firebase Anda sendiri

Isi variabel `VITE_FIREBASE_*` di berkas `.env` (lihat `.env.example`). Kalau dikosongkan,
aplikasi memakai `firebase-applet-config.json`. Tanpa konfigurasi sama sekali, aplikasi tetap
bisa dijelajahi; hanya fitur akun yang tidak tersedia.

## Pembuatan dan impor pesanan

Pada mode Firestore, checkout tidak lagi menulis pesanan dari peramban. Aplikasi memanggil
`POST /api/orders` dengan **ID token Firebase**, lalu server:

1. Membaca ulang katalog (dokumen `listings` ditambah data seed), voucher, dan stok dari sumber
   tepercaya, termasuk override harga di `platform/main`.
2. Memeriksa metode kirim/bayar, voucher yang sudah diklaim, dan ketersediaan stok.
3. Menghitung `subtotal`, diskon, ongkir, dan `total`, lalu menulis pesanan beserta `sellerUids`
   dan memotong stok dalam satu transaksi Admin SDK.

Aturan Firestore menolak `create` langsung pada `orders`, sehingga klien tidak bisa memalsukan
harga atau total. Endpoint ini membutuhkan kredensial Firebase Admin yang sama seperti kuota AI
dan App Check; tanpa kredensial server membalas `HTTP 503`.

Pesanan tamu yang dibuat sebelum masuk diimpor lewat `POST /api/orders/import` (maksimal 50
pesanan berstatus `belum-dibayar`). Server membuat ulang setiap pesanan dari katalog dan stok
saat ini; pesanan yang gagal divalidasi dilewati, bukan dipaksakan.

## Pembayaran online (Midtrans Snap)

Untuk pesanan non-COD, tombol **Bayar Sekarang** memanggil `POST /api/payments/create` dengan ID
token Firebase dan App Check. Server memvalidasi kepemilikan pesanan, status `belum-dibayar`, dan
total, lalu membuat transaksi **Midtrans Snap** dan mengembalikan `redirectUrl`. Token dan URL
pembayaran juga disimpan di dokumen pesanan (`paymentProvider`, `paymentStatus`, `paymentRef`,
`paymentUrl`).

Notifikasi Midtrans dikirim ke `POST /api/payments/midtrans/webhook`. Endpoint ini:

1. Memverifikasi `signature_key` = `SHA512(order_id + status_code + gross_amount + ServerKey)`.
2. Mencocokkan `gross_amount` dengan `total` pesanan.
3. Memperbarui pesanan lewat Admin SDK: `settlement`/`capture` menjadi `paymentStatus: paid` dan
   `status: dikemas` (bila masih `belum-dibayar`), `pending` tetap menunggu, sedangkan
   `deny`/`cancel`/`expire` menjadi `failed` agar pembeli bisa mencoba lagi.

Aturan Firestore hanya mengizinkan pembeli menandai pesanan COD sebagai `dikemas`; pesanan online
hanya bisa berubah lewat webhook server. Tanpa `MIDTRANS_SERVER_KEY`, endpoint pembayaran membalas
`HTTP 503` dan tombol bayar menampilkan pesan konfigurasi, sementara COD tetap berjalan.

Langkah mengaktifkan:

1. Daftar di <https://dashboard.midtrans.com>, buka **Environment → Sandbox**, lalu salin
   **Server Key**.
2. Isi `MIDTRANS_SERVER_KEY` di `.env` (jangan pernah memakai kunci ini di kode klien).
3. Daftarkan URL notifikasi `https://domain-anda/api/payments/midtrans/webhook` di dashboard
   Midtrans dan isi `APP_URL`.
4. Set `MIDTRANS_IS_PRODUCTION=true` hanya saat memakai kunci produksi.

Saat menguji di localhost, Midtrans tidak dapat mengirim webhook ke `localhost`. Gunakan tunnel
publik (misalnya ngrok atau cloudflared) dan daftarkan URL tunnel sebagai notification URL, atau
kirim notifikasi simulasi dengan signature yang dihitung dari Server Key.

## Mengaktifkan fitur AI

Fitur AI memakai Google Gemini dan **bersifat opsional**. Tanpa kunci API:

- Deskripsi properti tetap dibuat memakai draf offline (ditandai `source: 'template'`).
- Fitur gambar AI menampilkan pesan bahwa kunci belum diatur.

Cara mengaktifkan:

1. Ambil kunci di <https://aistudio.google.com/apikey>.
2. Salin `.env.example` menjadi `.env`, isi `GEMINI_API_KEY`.
3. Jalankan ulang server.

Isi `.env` yang didukung:

| Variabel | Bawaan | Keterangan |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Kunci API Google Gemini. |
| `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite` | Model untuk penulisan deskripsi. |
| `GEMINI_TEXT_FALLBACKS` | `gemini-3.5-flash-lite,gemini-3-flash-preview` | Model cadangan bila model utama sibuk atau tidak tersedia. |
| `GEMINI_TEXT_TIMEOUT_MS` | `25000` | Batas waktu per model sebelum beralih ke model cadangan. |
| `GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image` | Model untuk pembuatan gambar. |
| `VITE_FIREBASE_API_KEY` dan kawan-kawan | dari berkas JSON | Konfigurasi Firebase. Lihat `.env.example`. |
| `AI_MINUTE_LIMIT` | `15` | Maksimal permintaan AI per menit per akun. |
| `AI_DAY_LIMIT` | `100` | Maksimal permintaan AI per hari per akun. |
| `AI_QUOTA_BACKEND` | `auto` | `firestore` untuk kuota persisten lintas instance, `memory` untuk satu instance. |
| `VITE_FIREBASE_APP_CHECK_SITE_KEY` | — | Kunci situs reCAPTCHA Enterprise (Fraud Defense) untuk Firebase App Check di sisi klien. |
| `APP_CHECK_REQUIRED` | `false` | `true` mewajibkan token App Check valid di endpoint AI/unggah. |
| `FIREBASE_SERVICE_ACCOUNT` | — | JSON service account (satu baris) untuk Firebase Admin. |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | Alternatif: path berkas service account untuk Firebase Admin. |
| `MIDTRANS_SERVER_KEY` | — | Server Key Midtrans untuk membuat transaksi dan memverifikasi webhook. |
| `MIDTRANS_IS_PRODUCTION` | `false` | `true` memakai endpoint Midtrans produksi; biarkan `false` untuk sandbox. |
| `APP_URL` | `http://localhost:3000` | URL publik aplikasi untuk redirect setelah pembayaran. |
| `PORT` | `3000` | Port server. |
| `LOG_LEVEL` | `info` | Level log server: `debug`, `info`, `warn`, `error`, atau `silent`. |

Status fitur AI bisa dicek kapan saja lewat `GET /api/health` (publik).

Semua endpoint AI (`/api/generate-description`, `/api/generate-image`, `/api/analyze-image`)
mewajibkan **ID token Firebase** di header `Authorization: Bearer <idToken>`. Halaman alat AI
juga hanya bisa dibuka setelah masuk, sehingga kuota AI tidak bisa dipakai tanpa akun. Selain
batas per alamat IP (20 permintaan/menit), setiap akun dibatasi `AI_MINUTE_LIMIT` per menit dan
`AI_DAY_LIMIT` per hari; permintaan berlebih dibalas `HTTP 429` beserta pesan yang jelas.
Penghitung kuota disimpan di memori secara bawaan. Isi kredensial Firebase Admin dan set
`AI_QUOTA_BACKEND=firestore` agar kuota tetap tersimpan saat server restart dan konsisten di
beberapa instance.

### App Check dan kuota persisten

Untuk produksi, aktifkan **Firebase App Check** agar Firestore dan endpoint AI/unggah hanya bisa
dipanggil dari aplikasi Anda:

1. Firebase Console → **App Check** → daftarkan aplikasi web dengan penyedia **Fraud Defense
   (reCAPTCHA Enterprise)**. Pastikan domain produksi ada di daftar domain kunci tersebut.
2. Isi `VITE_FIREBASE_APP_CHECK_SITE_KEY` dengan **site key** dari konfigurasi App Check.
3. Isi kredensial Firebase Admin (`FIREBASE_SERVICE_ACCOUNT` atau
   `GOOGLE_APPLICATION_CREDENTIALS`) agar server bisa memverifikasi token.
4. Set `APP_CHECK_REQUIRED=true`, lalu jalankan ulang server.

Aplikasi memakai `ReCaptchaEnterpriseProvider`. Penyedia **reCAPTCHA v3 classic** sudah deprecated
dan tidak kompatibel dengan kode ini.

Saat pengembangan lokal, buat **debug token** di App Check → Apps → Manage debug tokens dan isi
`VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN`. Jangan memakai debug token di produksi. Bila
`APP_CHECK_REQUIRED=true` tetapi kredensial Admin belum siap, endpoint AI/unggah akan menolak
permintaan (`HTTP 503`) sampai konfigurasi dilengkapi.

### Backup Firestore

Data pengguna, pesanan, dan ulasan hanya tersimpan di Firestore. Aplikasi menyertakan
perkakas backup berbasis Admin SDK, jadi tidak perlu gcloud atau bucket tambahan:

```powershell
npm run backup                                  # semua koleksi -> backups/firestore-<waktu>.json
npm run backup -- --only listings,orders        # koleksi tertentu
npm run backup -- --keep 30                     # simpan 30 backup terbaru (bawaan 14)
npm run backup -- --out backups/sebelum-rilis.json
```

Berkas backup memuat data pribadi (nama, telepon, alamat, pesanan), sehingga
`backups/*.json` sudah masuk `.gitignore` dan **jangan** dibagikan atau di-commit.
`npm run backup` hanya membaca Firestore.

Untuk memulihkan, jalankan mode aman lebih dulu:

```powershell
npm run backup:restore                                # dry-run berkas terbaru
npm run backup:restore -- --file backups/x.json       # dry-run berkas tertentu
npm run backup:restore -- --confirm --merge           # tulis, field lama dipertahankan
npm run backup:restore -- --confirm --only orders     # pulihkan satu koleksi
```

Tanpa `--confirm` skrip tidak menulis apa pun. Restore menolak backup dari proyek
Firebase lain kecuali diberi `--force-project`. Secara bawaan dokumen ditimpa utuh;
pakai `--merge` bila hanya ingin menambahkan field yang hilang.

Untuk produksi, simpan salinan di luar mesin ini dan jadwalkan otomatis:

1. Windows: daftarkan sekali dengan
   `powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1`
   (bawaan tiap hari 02:00, menyimpan 14 backup). Ubah dengan `-Time 23:30 -Keep 30`,
   hapus dengan `-Uninstall`. Hasil dan error tercatat di `backups/backup.log`.
   Setelah itu salin folder `backups/` ke OneDrive/Google Drive atau bucket Cloud Storage.
2. Linux/VPS: tambahkan cron, misalnya `0 2 * * * cd /srv/propertika && npm run backup`.
3. Untuk arsip jangka panjang di Google Cloud, ekspor native juga bisa dipakai:
   `gcloud firestore export gs://<bucket-anda>/firestore/$(date +%Y%m%d)`.
4. Uji restore ke proyek Firestore terpisah secara berkala, bukan hanya mengandalkan
   keberadaan berkas backup.


### Logging dan pemantauan

Server menulis log terstruktur satu baris JSON ke `stdout`/`stderr`, sehingga bisa langsung
dibaca Cloud Logging, Loki, atau `docker logs`. Setiap permintaan mendapat `X-Request-Id`
(dari klien bila valid, atau UUID baru) dan ID yang sama dikembalikan pada respons error.

```json
{"time":"2026-01-01T00:00:00.000Z","level":"info","service":"propertika-ai","event":"http_request","requestId":"...","method":"GET","path":"/api/health","status":200,"durationMs":1.2}
```

- `LOG_LEVEL=debug` menampilkan detail health/aset dan upload; produksi cukup `info`.
- Nilai sensitif (`authorization`, `cookie`, `apiKey`, `token`, `password`, dll.) otomatis
  disamarkan, dan panjang pesan/stack dibatasi.
- Error tak tertangani ditulis sebagai `unhandled_error`/`unhandled_rejection` beserta
  `requestId`, tanpa membocorkan detail internal ke pengguna.
- Peramban melaporkan error ke `POST /api/client-errors` (maksimal 20 laporan per sesi,
  duplikat 10 detik diabaikan, dan path dikirim tanpa query string). Endpoint ini dibatasi
  20 permintaan/menit per IP.
- `GET /api/health` kini memuat `status`, `version`, `uptimeSeconds`, `timestamp`, `logLevel`,
  `ordersServerEnabled` (kredensial Firebase Admin siap untuk pembuatan pesanan), dan
  `paymentsEnabled` (kunci Midtrans tersedia) untuk pemeriksaan uptime.

Rekomendasi alert di layanan pemantauan:

| Sinyal | Saran ambang |
| --- | --- |
| `event=http_request` dengan `status>=500` | > 2% dari total permintaan selama 5 menit |
| `event=client_error` atau `unhandled_rejection` | Lonjakan mendadak dibanding jam sebelumnya |
| `durationMs` | p95 > 5.000 ms selama 10 menit |
| `event=app_check_rejected` | > 20 per 5 menit (kemungkinan token/site key salah) |
| Kuota/limit AI (`HTTP 429`) | Lonjakan per akun/IP (indikasi penyalahgunaan) |
| Health check eksternal | Gagal 2 kali berturut-turut atau `uptimeSeconds` terus mereset |

Contoh pemeriksaan manual:

```powershell
curl.exe -s -D - -o NUL http://localhost:3000/api/health -H "X-Request-Id: cek-health-1234"
```

Saat server menerima `SIGTERM`/`SIGINT`, server berhenti menerima koneksi baru, menutup
koneksi yang berjalan (maksimal 10 detik), lalu keluar. Di platform multi-instance, kumpulkan
log dari semua replika ke satu tempat agar `requestId` bisa ditelusuri end-to-end.

### Penting soal fitur gambar

Model gambar Gemini **tidak tersedia di Free Tier** — kuotanya 0. Selama billing
belum aktif di proyek Google Cloud yang menaungi kunci API, endpoint
`/api/generate-image` akan membalas `HTTP 429` dan aplikasi menampilkan pesan
yang menjelaskan hal ini. Fitur teks (deskripsi properti) tetap berjalan normal
tanpa billing.

Aktifkan billing di <https://console.cloud.google.com/billing>, lalu jalankan
ulang server. Untuk menguji apakah kuota sudah terbuka:

```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" -X POST http://localhost:3000/api/generate-image `
  -H "Content-Type: application/json" -H "Authorization: Bearer <ID_TOKEN_FIREBASE>" `
  -d "{\"mode\":\"room-makeover\",\"prompt\":\"\",\"image\":\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==\"}"
```

`HTTP 200` berarti kuota gambar sudah aktif.

## Perintah lain

| Perintah | Kegunaan |
| --- | --- |
| `npm run typecheck` | Pemeriksaan tipe TypeScript saja. |
| `npm run preview` | Pratinjau hasil build Vite tanpa server Express. |
| `npm test` | Uji unit Vitest (logika marketplace, format, RAB, dan store). |
| `npm run test:watch` | Uji unit Vitest dalam mode pantau. |
| `npm run test:e2e` | Uji asap Playwright di Chromium; server dev dijalankan otomatis. |
| `npm run backup` | Backup seluruh koleksi Firestore ke `backups/firestore-<waktu>.json`. |
| `npm run backup:restore` | Pulihkan backup (dry-run kecuali diberi `--confirm`). |
| `npm run midtrans:simulate` | Kirim notifikasi Midtrans palsu ke webhook lokal. |
| `npm run lint` | Alias dari `typecheck`. |

## Pengujian

Uji unit memakai **Vitest** dan berjalan di lingkungan `jsdom`:

```bash
npm test
```

Cakupannya antara lain harga flash sale, diskon, ongkir, voucher, keranjang, checkout,
pembatalan pesanan (stok dikembalikan), alamat, favorit, listing penjual, pesan masuk, ulasan,
formatter rupiah/tanggal, serta pembuatan RAB.

Uji asap antarmuka memakai **Playwright**. Pertama kali, unduh Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Uji ini membuka beranda, mencari di katalog, menambah properti ke keranjang, membuka Kalkulator
KPR dan halaman legal, serta memastikan rute tak dikenal menampilkan halaman 404. Alur yang
memerlukan akun sungguhan (masuk, checkout dengan pembayaran, dashboard admin) masih diuji
manual karena membutuhkan kredensial Firebase dan admin.

## Struktur proyek

```
server.ts              Server Express: endpoint AI, unggah foto, penyajian berkas, fallback SPA
firestore.rules        Aturan keamanan Firestore per koleksi
server/
  admin.ts             Inisialisasi Firebase Admin (service account/ADC)
  backup-core.ts       Encode/decode nilai Firestore untuk backup JSON
  order-core.ts        Validasi input, perhitungan total, dan pembentukan pesanan
  orders.ts            Endpoint /api/orders: tulis pesanan + potong stok via Admin SDK
  payment-core.ts      Verifikasi signature dan pemetaan status Midtrans
  payments.ts          Transaksi Snap dan webhook pembayaran via Admin SDK
  quota.ts             Kuota AI in-memory dan Firestore (transaksional)
  rate-limit.ts        Pembatas laju per IP yang dipakai ulang
scripts/
  backup-firestore.ts  npm run backup: ekspor semua koleksi ke JSON
  restore-firestore.ts npm run backup:restore: dry-run/pulihkan backup
  install-backup-task.ps1 Daftarkan/hapus backup harian di Task Scheduler
  run-backup.cmd       Pembungkus yang dipanggil Scheduled Task
  midtrans-simulate.mjs Simulator webhook Midtrans untuk pengujian lokal
backups/               Hasil backup Firestore (diabaikan git, berisi data pribadi)
vite.config.ts         Konfigurasi Vite + Tailwind
index.html             Kerangka HTML
public/                Berkas statis (favicon)
uploads/               Foto listing/pesanan yang diunggah (dibuat otomatis)
tests/                 Uji unit Vitest
e2e/                   Uji asap Playwright
vitest.config.ts       Konfigurasi Vitest
playwright.config.ts   Konfigurasi Playwright
src/
  types.ts             Semua tipe bersama dan kontrak API
  App.tsx              Daftar rute
  firebase.ts          Konfigurasi Firebase dan pemuatnya (dimuat belakangan)
  data/seed.ts         Properti contoh dan pemilik fiktifnya
  lib/
    auth.tsx           AuthProvider, useAuth, pesan kesalahan berbahasa Indonesia
    store.ts           Penyimpanan global per akun + localStorage/Firestore
    firestore.ts       Sinkronisasi katalog, akun, dan pesanan ke Firestore
    storage.ts         Unggah foto ke server dan ganti data URL
    orders-api.ts      Pemanggil endpoint pembuatan/impor pesanan
    payments-api.ts    Pemanggil endpoint pembayaran Midtrans
    api-client.ts      Header auth/App Check dan helper permintaan API
    ai.ts              Pemanggil endpoint AI
    image.ts           Kompresi gambar, pembuat gambar placeholder
    format.ts          Pemformat rupiah, luas, tanggal
  components/          Komponen antarmuka yang dipakai ulang
  pages/               Satu berkas per halaman
```

## Catatan penting tentang data

Ada dua mode penyimpanan, dipilih lewat `VITE_DATA_BACKEND` di `.env`:

- **Mode lokal (bawaan)** — iklan, favorit, dan pesan disimpan di **localStorage peramban**
  dengan kunci `propertika:v1`, dipisah per akun (`accounts[uid]`). Iklan hanya terlihat di
  peramban tempat iklan itu dipasang.
- **Mode Firestore** (`VITE_DATA_BACKEND=firestore`) — katalog, keranjang, alamat, favorit,
  pesanan, pesan (inquiry), ulasan, dan pengaturan promo/kategori disinkronkan ke Cloud
  Firestore, sehingga terlihat di semua perangkat. Akun tetap ditangani Firebase Authentication.

Pada mode Firestore:

- Foto listing yang diunggah dikirim ke server Express (`POST /api/upload`). Bila kredensial
  Cloudinary diatur (`CLOUDINARY_*`), foto langsung disimpan secara permanen di Cloudinary CDN.
  Bila tidak diatur, foto disimpan di disk lokal folder `uploads/`. Server memverifikasi ID token
  Firebase sebelum menerima berkas.
- **Admin** ditentukan oleh dokumen `admins/{uid}` di Firestore. Admin pertama harus dibuat
  manual dari Firebase Console: buat koleksi `admins`, lalu isi Document ID dengan UID akun
  (lihat Authentication → Users).
- **Pengaturan promo/katalog** (voucher, banner, label kategori, kategori disembunyikan, dan
  override listing) disimpan di dokumen `platform/main`. Semua orang boleh membaca, hanya admin
  yang boleh menulis.
- Aturan keamanan ada di `firestore.rules` dan di-deploy dengan
  `firebase deploy --only firestore:rules`.
- `VITE_FIREBASE_FIRESTORE_DB` menentukan nama database; isi `(default)` untuk database bawaan.

Karena localStorage punya kuota terbatas, gambar yang diunggah diperkecil dan dikompresi di
peramban sebelum disimpan/diunggah.

Tombol **Kosongkan data akun** di dashboard menghapus iklan, favorit, dan pesan milik akun yang
sedang masuk. Akun Firebase-nya sendiri tidak terhapus.

## Aturan keamanan Firestore

`firestore.rules` membatasi akses per koleksi. Ringkasannya:

| Koleksi | Baca | Tulis |
| --- | --- | --- |
| `listings` | publik | pemilik (`ownerId` tidak boleh berubah) atau admin |
| `users/{uid}` | pemilik dan admin | pemilik (peran hanya `buyer`/`seller`) atau admin |
| `inquiries` | pengirim, penerima, admin | buat: pengirim; ubah: penerima/admin (`read` saja); hapus: pengirim/penerima/admin |
| `orders` | pembeli, penjual terkait, admin | buat: **hanya server (Admin SDK)**; ubah: transisi status sesuai peran; hapus: admin |
| `reviews` | publik | buat: pembeli dengan pesanan `selesai` yang memuat listing tersebut; ubah/hapus: penulis atau admin |
| `platform` | publik | admin |
| `admins` | diri sendiri dan admin | admin |
| `aiUsage` | Admin SDK saja | Admin SDK saja (kuota AI) |

Validasi utama: judul/harga/area listing, peran akun, rating 1–5, panjang komentar/pesan, status
awal pesanan, konsistensi `total`, serta field kepemilikan (`ownerId`, `authorUid`, `listingId`,
`orderId`, `createdAt`) yang tidak boleh dipindahkan. Ulasan hanya diterima bila `orderId` milik
pembeli berstatus `selesai` dan `listingId` ada di `listingIds` pesanan; pemilik listing tidak bisa
mengulas produknya sendiri. Pembeli dan penjual juga dibatasi pada transisi status dan field yang
sesuai perannya. Rating dan jumlah ulasan pada listing tidak bisa diubah langsung oleh penjual.

Uji aturan memakai Firebase Emulator (butuh **Java 21+**, tanpa kredensial produksi):

```powershell
npm run test:rules
```

Perintah ini menjalankan emulator Firestore untuk proyek `demo-propertika-rules`, lalu
menjalankan `tests/firestore-rules.test.ts` (anonim, pemilik, penjual, pembeli, dan admin).
Tanpa emulator, file uji tersebut otomatis dilewati oleh `npm test`.

## Checklist deploy

1. **Variabel lingkungan** — salin `.env.example` menjadi `.env` di server, lalu isi:
   `VITE_FIREBASE_*`, `VITE_DATA_BACKEND=firestore`, `VITE_FIREBASE_FIRESTORE_DB`,
   `GEMINI_API_KEY`, kredensial Cloudflare (gambar), dan `CLOUDINARY_*` bila hosting tidak
   menyediakan disk persisten. Jangan pernah commit `.env`.
2. **Firebase Console** — aktifkan Email/Password dan Google di Authentication, tambahkan domain
   produksi ke Authorized domains, buat database Firestore, lalu buat dokumen `admins/{uid}`
   untuk admin pertama.
3. **Aturan keamanan** — deploy `firestore.rules`:
   `npx firebase-tools deploy --only firestore:rules --project homique-d18f8`.
4. **App Check & kuota** — daftarkan App Check dengan **Fraud Defense (reCAPTCHA Enterprise)**, isi
   `VITE_FIREBASE_APP_CHECK_SITE_KEY`, kredensial Firebase Admin, lalu set
   `APP_CHECK_REQUIRED=true` dan `AI_QUOTA_BACKEND=firestore`.
5. **Build dan verifikasi** — jalankan `npm ci`, `npm run typecheck`, `npm test`, `npm run test:rules`
   (butuh Java 21), `npm run build`, lalu `npm start`. Pastikan `GET /api/health` membalas `200`,
   halaman beranda terbuka, dan deep link seperti `/properti/seed-1` tetap terbuka saat dimuat ulang.
6. **Hosting** — Node.js 20+; arahkan reverse proxy/HTTPS ke `PORT`; pastikan folder `uploads/`
   berada di volume persisten atau gunakan Cloudinary.
7. **CI** — workflow ada di `.github/workflows/ci.yml` (typecheck + unit test, uji aturan Firestore,
   build produksi, dan uji Playwright). Jalankan otomatis saat push/PR setelah proyek dihubungkan
   ke GitHub.
8. **Uji asap setelah deploy** — beranda, katalog, masuk/daftar, unggah foto, AI deskripsi,
   keranjang sampai checkout, dan dashboard penjual/admin.
9. **Pemantauan** — kirim log server ke Cloud Logging/Loki, pasang alert untuk error 5xx,
   lonjakan `client_error`, dan kegagalan health check (lihat bagian *Logging dan pemantauan*).

## Sebelum dipakai sungguhan

- Pindahkan penyimpanan foto ke layanan berkas permanen bila server tidak menyimpan disk.
- Tinjau ulang `firestore.rules` setiap kali menambah koleksi atau field baru; jalankan
  `npm run test:rules` sebelum deploy.
- Ulasan kini diverifikasi berdasarkan pesanan `selesai` dan listing yang dibeli. Pembuatan
  pesanan juga sudah dipindah ke endpoint server (`POST /api/orders`) dengan Admin SDK, sehingga
  harga, voucher, stok, dan total dihitung ulang dari katalog, bukan dari data klien. Pembayaran
  online memakai Midtrans Snap dengan verifikasi signature webhook di server; isi
  `MIDTRANS_SERVER_KEY` dan daftarkan URL webhook sebelum menerima uang sungguhan.
- Aktifkan App Check (`APP_CHECK_REQUIRED=true`) dan kuota Firestore
  (`AI_QUOTA_BACKEND=firestore`) agar endpoint AI tidak disalahgunakan dan kuota tidak reset saat
  server restart.
- Pembatasan laju per IP masih disimpan di memori tiap instance. Untuk produksi multi-instance,
  gunakan Redis atau terapkan pembatasan di API gateway/reverse proxy.
- Backup/ekspor Firestore secara berkala; data pengguna, pesanan, dan ulasan hanya ada di sana.
- Pantau log dan pasang alert untuk error 5xx, lonjakan `client_error`, serta kegagalan health
  check; `LOG_LEVEL=debug` hanya untuk investigasi sementara karena menambah volume log.
