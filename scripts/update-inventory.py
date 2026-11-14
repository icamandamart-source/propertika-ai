# Perbarui inventaris Propertika AI ke kondisi 14 November 2026.
# Jalankan: python scripts/update-inventory.py
import copy

import openpyxl
from openpyxl.styles import Alignment

PATH = 'docs/Propertika-Inventaris-Backend-Frontend.xlsx'
wb = openpyxl.load_workbook(PATH)

HEADER_FILL = openpyxl.styles.PatternFill('solid', fgColor='1E293B')
HEADER_FONT = openpyxl.styles.Font(bold=True, color='FFFFFF', size=10)


def set_wrap(cell):
    a = cell.alignment
    cell.alignment = Alignment(
        horizontal=a.horizontal,
        vertical=a.vertical,
        text_rotation=a.text_rotation,
        wrap_text=True,
        shrink_to_fit=a.shrink_to_fit,
        indent=a.indent,
        relativeIndent=a.relativeIndent,
        justifyLastLine=a.justifyLastLine,
        readingOrder=a.readingOrder,
    )


def copy_style(src, dst):
    dst.font = copy.copy(src.font)
    dst.fill = copy.copy(src.fill)
    dst.border = copy.copy(src.border)
    dst.alignment = copy.copy(src.alignment)
    dst.number_format = src.number_format
    dst.protection = copy.copy(src.protection)


def append_rows(ws, rows, widths=None):
    template = ws.max_row
    for offset, values in enumerate(rows, start=1):
        row = template + offset
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=row, column=col, value=value)
            copy_style(ws.cell(row=template, column=col), cell)
            set_wrap(cell)
        ws.row_dimensions[row].height = ws.row_dimensions[template].height
    last = template + len(rows)
    if ws.auto_filter.ref:
        first_col = ws.auto_filter.ref.split(':')[0]
        ws.auto_filter.ref = f'{first_col}:{openpyxl.utils.get_column_letter(ws.max_column)}{last}'
    return last


def find_row(ws, text, column=1):
    for row in range(1, ws.max_row + 1):
        value = ws.cell(row=row, column=column).value
        if isinstance(value, str) and text.lower() in value.lower():
            return row
    raise SystemExit(f'Tidak menemukan teks "{text}"')


def has_value(ws, text, column=2):
    for row in range(3, ws.max_row + 1):
        value = ws.cell(row=row, column=column).value
        if isinstance(value, str) and text.lower() in value.lower():
            return True
    return False


# --- Ringkasan ---------------------------------------------------------------
summary = wb['Ringkasan']
row = find_row(summary, 'Tanggal inventaris')
summary.cell(row=row, column=2, value='14 November 2026')
set_wrap(summary.cell(row=row, column=2))

# --- Fitur & Status ----------------------------------------------------------
features = wb['Fitur & Status']


def feature_row(text):
    for row in range(3, features.max_row + 1):
        name = features.cell(row=row, column=2).value
        if isinstance(name, str) and text.lower() in name.lower():
            return row
    raise SystemExit(f'Tidak menemukan fitur "{text}"')


updates = {
    'Pembayaran nyata (gateway)': ('Siap (nonaktif)',
        'Midtrans Snap + webhook sudah ada; aktif setelah MIDTRANS_SERVER_KEY diisi. '
        'Tanpa kunci, checkout COD tetap berjalan.'),
    'App Check / CAPTCHA': ('Selesai',
        'Firebase App Check (reCAPTCHA Enterprise) aktif; debug token untuk lokal.'),
    'Automated tests': ('Selesai',
        '120 uji Vitest lulus; 45 uji aturan Firestore otomatis dilewati tanpa emulator.'),
    'Kuota AI multi-instance': ('Selesai',
        'AI_QUOTA_BACKEND=firestore; penghitung transaksional, tidak reset saat restart.'),
}
for name, (status, note) in updates.items():
    row = feature_row(name)
    features.cell(row=row, column=3, value=status)
    features.cell(row=row, column=4, value=note)

if not has_value(features, 'Backup & restore Firestore'):
    append_rows(features, [
    ['24', 'Backup & restore Firestore',
     'Selesai',
     'npm run backup / backup:restore; retensi 14 berkas; backup harian lewat Task Scheduler.'],
    ['25', 'Logging terstruktur & pemantauan',
     'Selesai',
     'Log JSON satu baris, X-Request-Id, laporan error peramban, saran alert di README.'],
    ['26', 'Penyimpanan foto Cloudinary',
     'Siap (nonaktif)',
     'Adapter sudah ada; isi CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET agar foto permanen.'],
    ['27', 'Uji asap Playwright',
     'Sebagian',
     'Beranda, katalog, keranjang, KPR, dan 404 otomatis; alur akun/pembayaran masih manual.'],
    ])

# --- Backend - Endpoint ------------------------------------------------------
endpoints = wb['Backend - Endpoint']
endpoints.cell(
    row=3,
    column=5,
    value='Tidak ada.',
)
endpoints.cell(
    row=3,
    column=6,
    value='Status AI + runtime: status, versi, uptime, ordersServerEnabled, paymentsEnabled, '
          'storageDriver, appCheckRequired, quotaBackend.',
)
endpoints.cell(
    row=4,
    column=6,
    value='Simpan foto ke Cloudinary bila CLOUDINARY_* diisi, jika tidak ke uploads/<uid>/<uuid>.<ext>; '
          'kembalikan URL.',
)

if not has_value(endpoints, '/api/orders', column=3):
    append_rows(endpoints, [
    ['8', 'POST', '/api/orders', 'Bearer + App Check',
     'items[], paymentMethodId, voucher, alamat; katalog & stok dibaca ulang di server.',
     'Buat pesanan dalam transaksi: hitung subtotal/diskon/ongkir/total, potong stok, simpan sellerUids.',
     '201 {id}; 400/401/409/503'],
    ['9', 'POST', '/api/orders/import', 'Bearer + App Check',
     'Maksimal 50 pesanan lokal berstatus belum-dibayar.',
     'Impor pesanan tamu; setiap pesanan divalidasi ulang dari katalog dan stok saat ini.',
     '200 {imported, ids}; 400/401/503'],
    ['10', 'POST', '/api/payments/create', 'Bearer + App Check; rate limit 10/menit',
     'orderId milik pengguna; status belum-dibayar; bukan COD.',
     'Buat transaksi Midtrans Snap; simpan paymentProvider/paymentStatus/paymentRef/paymentUrl.',
     '201 {redirectUrl, token}; 400/401/404/409/502/503'],
    ['11', 'POST', '/api/payments/midtrans/webhook', 'Publik; rate limit 120/menit',
     'signature_key SHA512(order_id+status_code+gross_amount+serverKey); nominal cocok dengan total.',
     'Verifikasi notifikasi Midtrans lalu perbarui paymentStatus dan status pesanan lewat Admin SDK.',
     '200 {ok, status}; 400/401/404/503'],
    ['12', 'POST', '/api/client-errors', 'Publik; rate limit 20/menit',
     'Pesan, stack, dan path tanpa query string; maksimal 20 laporan per sesi.',
     'Catat error peramban ke log server untuk investigasi.',
     '204'],
    ])

# --- Rekomendasi -------------------------------------------------------------
recommendations = wb['Rekomendasi']
recommendations.cell(row=2, column=4, value='Status (14 Nov 2026)')
recommendations.cell(row=2, column=4).font = copy.copy(HEADER_FONT)
recommendations.cell(row=2, column=4).fill = copy.copy(HEADER_FILL)
recommendations.cell(row=2, column=4).alignment = copy.copy(recommendations.cell(row=2, column=1).alignment)
set_wrap(recommendations.cell(row=2, column=4))
recommendations.column_dimensions['D'].width = 46

status_by_key = {
    'Penyimpanan foto permanen': 'Siap (nonaktif): isi CLOUDINARY_* di .env',
    'Backup/export Firestore terjadwal': 'Selesai: npm run backup + task harian 02:00',
    'App Check / CAPTCHA': 'Selesai: reCAPTCHA Enterprise + APP_CHECK_REQUIRED=true',
    'Kuota AI persisten': 'Selesai: AI_QUOTA_BACKEND=firestore',
    'Pagination katalog & ulasan': 'Belum: masih limit tetap 200/500',
    'Automated test suite': 'Sebagian: 120 unit test Vitest; e2e Playwright terbatas',
    'Payment gateway': 'Siap (nonaktif): Midtrans, tinggal server key',
    'Kebijakan privasi & syarat layanan': 'Selesai: halaman /kebijakan-privasi dan /syarat-ketentuan',
    'Notifikasi push (FCM)': 'Belum',
    'Audit log admin': 'Belum',
    'Structured logging & monitoring': 'Selesai: log JSON, requestId, client error, saran alert',
}
for row in range(3, recommendations.max_row + 1):
    name = recommendations.cell(row=row, column=2).value
    if not name:
        continue
    status = status_by_key.get(str(name).strip())
    if status is None:
        for key, value in status_by_key.items():
            if key.lower() in str(name).lower():
                status = value
                break
    cell = recommendations.cell(row=row, column=4, value=status or '')
    copy_style(recommendations.cell(row=row, column=3), cell)
    set_wrap(cell)

recommendations.auto_filter.ref = f'A2:D{recommendations.max_row}'

# --- Berkas Penting ----------------------------------------------------------
files = wb['Berkas Penting']
if not has_value(files, 'server/backup-core.ts'):
    append_rows(files, [
    ['32', 'server/backup-core.ts', 'Encode/decode nilai Firestore (Timestamp, GeoPoint, Buffer) untuk backup.'],
    ['33', 'scripts/backup-firestore.ts', 'npm run backup: ekspor seluruh koleksi ke backups/*.json.'],
    ['34', 'scripts/restore-firestore.ts', 'npm run backup:restore: dry-run bawaan, tulis dengan --confirm.'],
    ['35', 'scripts/install-backup-task.ps1', 'Daftarkan/hapus backup harian di Windows Task Scheduler.'],
    ['36', 'tests/payments.test.ts', 'Uji integrasi pembuatan Snap dan webhook Midtrans.'],
    ['37', 'tests/backup-core.test.ts', 'Uji roundtrip nilai Firestore dan validasi manifest backup.'],
    ])

# --- Dependensi & Perintah ---------------------------------------------------
commands = wb['Dependensi & Perintah']
if not has_value(commands, 'npm run backup'):
    append_rows(commands, [
    ['20', 'npm run backup', 'tsx scripts/backup-firestore.ts', 'Backup Firestore ke JSON (opsional --only, --keep, --out).'],
    ['21', 'npm run backup:restore', 'tsx scripts/restore-firestore.ts', 'Pulihkan backup; dry-run kecuali diberi --confirm.'],
    ['22', 'npm run midtrans:simulate', 'node scripts/midtrans-simulate.mjs', 'Kirim notifikasi Midtrans palsu ke webhook lokal.'],
    ['23', 'npm run typecheck', 'tsc --noEmit', 'Pemeriksaan tipe TypeScript.'],
    ['24', 'npm test', 'vitest run', 'Uji unit (120 lulus; 45 aturan Firestore butuh emulator).'],
    ['25', 'npm run build', 'tsc + vite build + esbuild', 'Bangun dist/ dan server.js untuk produksi.'],
    ])

wb.save(PATH)
print('Inventaris diperbarui:', PATH)
