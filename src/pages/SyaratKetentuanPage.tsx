import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, Shield, AlertCircle } from 'lucide-react';

export default function SyaratKetentuanPage() {
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
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
              <Scale className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Syarat &amp; Ketentuan Layanan</h1>
              <p className="mt-1 text-xs text-slate-500">
                Terakhir diperbarui: 12 November 2026 · Berlaku untuk seluruh pengguna PROPERTIKA AI
              </p>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="h-4 w-4 text-brand" />
              1. Ketentuan Umum &amp; Definisi
            </h2>
            <p className="mt-2">
              Selamat datang di <strong>PROPERTIKA AI</strong> (&quot;Platform&quot;). Dokumen ini mengatur syarat dan ketentuan penggunaan platform marketplace properti, perabot hunian, serta alat bantu visualisasi kecerdasan buatan (AI) yang kami sediakan. Dengan mendaftar, mengakses, atau bertransaksi di Platform kami, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh isi Syarat &amp; Ketentuan ini.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Pengguna</strong> adalah setiap individu atau badan hukum yang mengakses Platform, baik sebagai Pengunjung, Pembeli, maupun Penjual.</li>
              <li><strong>Penjual</strong> adalah agen properti, pengembang, pemilik perorangan, atau penyedia perabot terverifikasi yang memasang listing barang atau properti di Platform.</li>
              <li><strong>Listing</strong> adalah informasi penawaran unit properti (jual/sewa) atau perabot hunian yang dimuat di katalog Platform.</li>
              <li><strong>AI Studio</strong> adalah rangkaian fitur simulasi berbasis kecerdasan buatan mencakup penulisan deskripsi otomatis, <em>room makeover</em>, renovasi, simulasi lahan, dan estimasi Rencana Anggaran Biaya (RAB).</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Shield className="h-4 w-4 text-brand" />
              2. Akun dan Keamanan
            </h2>
            <p className="mt-2">
              Untuk menikmati fitur penuh seperti menyimpan favorit, membuat pesanan, mengajukan konsultasi, dan mengakses AI Studio, Anda diwajibkan mendaftar akun dengan alamat email aktif atau akun Google.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Anda bertanggung jawab penuh menjaga kerahasiaan kata sandi dan aktivitas yang dilakukan melalui akun Anda.</li>
              <li>Informasi profil yang Anda berikan wajib akurat, sah, dan dapat dipertanggungjawabkan secara hukum.</li>
              <li>Kami berhak menangguhkan atau menghapus akun yang terindikasi melakukan penipuan, manipulasi data, atau pelanggaran hukum yang berlaku di Republik Indonesia.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Scale className="h-4 w-4 text-brand" />
              3. Ketentuan Iklan &amp; Listing Penjual
            </h2>
            <p className="mt-2">
              Penjual wajib memastikan bahwa unit properti atau produk perabot yang diiklankan memenuhi standar etika dan hukum:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Properti yang ditawarkan memiliki keabsahan hak atas tanah/bangunan (SHM, SHGB, Strata Title, atau surat keterangan yang sah) dan tidak sedang dalam sengketa hukum.</li>
              <li>Foto yang diunggah adalah foto asli atau representasi sah yang dimiliki hak ciptanya oleh Penjual.</li>
              <li>Dilarang mencantumkan informasi harga manipulatif, spesifikasi fiktif, atau kontak palsu.</li>
              <li>Platform berhak menurunkan atau memodifikasi tampilan listing yang dilaporkan melanggar hak pihak lain atau tidak sesuai fakta.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              4. Batasan Tanggung Jawab Fitur AI &amp; Simulasi
            </h2>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
              <p className="font-semibold">Penting mengenai hasil visualisasi dan estimasi:</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Fitur AI Studio (termasuk visualisasi ruangan, renovasi, penempatan furnitur, dan estimasi RAB) serta Kalkulator KPR disediakan semata-mata sebagai <strong>alat bantu ilustrasi, referensi awal, dan stimulasi ide kreatif</strong>.
              </p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Hasil gambar AI adalah sintesis algoritmik dan tidak dapat dijadikan jaminan mutlak atas hasil akhir konstruksi fisik di lapangan.</li>
              <li>Estimasi harga perabot atau material dalam Rencana Anggaran Biaya (RAB) adalah taksiran umum dan dapat berbeda dengan harga riil di toko/kontraktor setempat.</li>
              <li>Perhitungan suku bunga dan cicilan pada Kalkulator KPR dapat berbeda dengan persetujuan kredit resmi dari pihak perbankan penyedia KPR.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Shield className="h-4 w-4 text-brand" />
              5. Transaksi, Pembayaran, dan Pengiriman
            </h2>
            <p className="mt-2">
              Untuk transaksi pembelian produk perabot atau aksesoris hunian melalui keranjang belanja:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Pembeli wajib melengkapi alamat pengiriman yang jelas dan melakukan pembayaran sesuai invoice yang diterbitkan.</li>
              <li>Penjual bertanggung jawab memproses, mengemas, dan menyerahkan paket kepada kurir logistik sesuai metode pengiriman yang dipilih.</li>
              <li>Klaim kerusakan barang wajib disertai bukti video unboxing tanpa jeda dalam kurun waktu 1x24 jam sejak paket dinyatakan tiba oleh kurir.</li>
            </ul>
          </section>

          <section>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <FileText className="h-4 w-4 text-brand" />
              6. Hukum yang Mengatur &amp; Kontak
            </h2>
            <p className="mt-2">
              Syarat &amp; Ketentuan ini diatur dan ditafsirkan sesuai dengan hukum yang berlaku di <strong>Negara Kesatuan Republik Indonesia</strong>. Segala perselisihan yang timbul akan diupayakan untuk diselesaikan secara musyawarah untuk mufakat.
            </p>
            <p className="mt-3">
              Jika Anda memiliki pertanyaan mengenai Syarat &amp; Ketentuan ini, silakan hubungi tim kami melalui email: <a href="mailto:halo@propertika.ai" className="font-semibold text-brand underline">halo@propertika.ai</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
