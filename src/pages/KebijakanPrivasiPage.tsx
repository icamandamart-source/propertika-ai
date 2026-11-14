import { Link } from 'react-router-dom';
import { ArrowLeft, Database, Eye, Lock, ShieldCheck, UserCheck } from 'lucide-react';

export default function KebijakanPrivasiPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-dark"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Kembali ke Beranda
      </Link>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Kebijakan Privasi</h1>
              <p className="mt-1 text-xs text-slate-500">
                Terakhir diperbarui: 12 November 2026 · Mengacu pada UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Lock className="h-4 w-4 text-emerald-800" />
              1. Komitmen Kami Terhadap Privasi Anda
            </h2>
            <p className="mt-2">
              <strong>PROPERTIKA AI</strong> berkomitmen penuh untuk melindungi privasi dan keamanan data pribadi seluruh pengguna platform kami. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, menyimpan, dan menjaga informasi pribadi Anda saat mengakses marketplace properti dan layanan AI kami.
            </p>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Database className="h-4 w-4 text-emerald-800" />
              2. Data Pribadi yang Kami Kumpulkan
            </h2>
            <p className="mt-2">Kami mengumpulkan informasi yang Anda berikan secara langsung saat menggunakan Platform:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Data Akun &amp; Identitas</strong>: Nama lengkap, alamat email, nomor telepon, dan foto profil yang diberikan saat registrasi melalui email maupun Google Sign-In.
              </li>
              <li>
                <strong>Data Transaksi &amp; Pengiriman</strong>: Alamat tujuan pengiriman, kota/kabupaten, kode pos, catatan pesanan, riwayat pembelian, dan status pembayaran.
              </li>
              <li>
                <strong>Data Lokasi &amp; Geocoding</strong>: Titik koordinat GPS (latitude dan longitude) bila Anda mengizinkan fitur &quot;Gunakan Lokasi Saya&quot; untuk menghitung jarak ke unit properti atau mengisi alamat otomatis.
              </li>
              <li>
                <strong>Data Gambar &amp; Media</strong>: Foto ruangan, tanah, atau rumah yang Anda unggah ke fitur AI Studio untuk keperluan pengolahan gambar atau pemasangan listing properti.
              </li>
              <li>
                <strong>Data Teknis</strong>: Alamat IP, jenis peramban, dan log interaksi sistem untuk tujuan pemantauan keamanan serta pencegahan penyalahgunaan kuota (*rate limiting*).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-4 w-4 text-emerald-800" />
              3. Tujuan Penggunaan Data
            </h2>
            <p className="mt-2">Data pribadi Anda digunakan untuk:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Menyediakan, memelihara, dan meningkatkan seluruh fitur di Platform Propertika AI.</li>
              <li>Memproses transaksi pemesanan produk dan pengiriman pesanan bersama pihak logistik terkait.</li>
              <li>Menghubungkan pembeli dengan pemilik/agen properti melalui pesan konsultasi (*inquiry*).</li>
              <li>Memproses permintaan komputasi AI (pembuatan deskripsi iklan, simulasi interior, renovasi, dan estimasi biaya perabot).</li>
              <li>Menegakkan keamanan, mencegah transaksi mencurigakan, dan mengelola kuota penggunaan harian API.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <UserCheck className="h-4 w-4 text-emerald-800" />
              4. Berbagi Data dengan Pihak Ketiga Tepercaya
            </h2>
            <p className="mt-2">
              Kami <strong>tidak pernah menjual atau menyewakan</strong> data pribadi Anda kepada pihak mana pun. Kami hanya membagikan data seperlunya kepada penyedia infrastruktur tepercaya:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Firebase (Google LLC)</strong>: Untuk autentikasi akun aman dan penyimpanan basis data Cloud Firestore.</li>
              <li><strong>Layanan Komputasi AI (Google Gemini &amp; Cloudflare Workers AI)</strong>: Untuk memproses prompt teks dan foto yang Anda minta di AI Studio secara aman tanpa melatih model publik dengan data pribadi Anda.</li>
              <li><strong>Penyedia Penyimpanan Cloud (Cloudinary)</strong>: Untuk menyimpan foto galeri properti yang diunggah pengguna agar dapat disajikan secara cepat dan andal.</li>
              <li><strong>Penyedia Jasa Logistik</strong>: Nama, alamat, dan nomor kontak penerima dibagikan kepada kurir yang ditunjuk guna pengantaran pesanan perabot.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-800" />
              5. Hak Pemilik Data Pribadi
            </h2>
            <p className="mt-2">
              Sesuai dengan Undang-Undang Pelindungan Data Pribadi (UU PDP), Anda memiliki hak penuh atas data pribadi Anda:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Hak Akses &amp; Perbaikan</strong>: Anda dapat meninjau dan mengubah profil, alamat, serta listing Anda kapan saja melalui Dashboard.</li>
              <li><strong>Hak Penghapusan</strong>: Anda dapat menggunakan tombol &quot;Kosongkan Data Akun&quot; di dashboard atau menghubungi kami untuk meminta penghapusan akun dan riwayat data secara permanen.</li>
              <li><strong>Pilihan Persetujuan</strong>: Anda berhak menolak akses lokasi atau upload foto kapan saja melalui pengaturan peramban perangkat Anda.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Lock className="h-4 w-4 text-emerald-800" />
              6. Keamanan &amp; Kontak Perlindungan Data
            </h2>
            <p className="mt-2">
              Kami menerapkan enkripsi HTTPS standar industri, verifikasi token identitas berbasis JWT, dan kontrol hak akses bertingkat (*security rules*) untuk melindungi data Anda dari akses tanpa hak.
            </p>
            <p className="mt-3">
              Apabila Anda memiliki pertanyaan, saran, atau ingin mengajukan hak terkait data pribadi Anda, hubungi Petugas Pelindungan Data (DPO) kami di:
            </p>
            <div className="mt-2 rounded-xl bg-slate-50 p-4 text-xs">
              <p className="font-semibold text-slate-800">Tim Perlindungan Data PROPERTIKA AI</p>
              <p className="mt-1 text-slate-600">Email: <a href="mailto:halo@propertika.ai" className="font-semibold text-brand underline">halo@propertika.ai</a></p>
              <p className="text-slate-600">Alamat: Jakarta, Indonesia</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
