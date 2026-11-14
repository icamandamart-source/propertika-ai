import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Heart, Sparkles, Users } from 'lucide-react';

const VALUES = [
  {
    icon: Building2,
    title: 'Properti untuk Semua',
    desc: 'Kami percaya setiap orang berhak mendapatkan hunian impian. Platform kami memudahkan pencarian rumah, tanah, apartemen, dan perabot dari satu tempat.',
  },
  {
    icon: Sparkles,
    title: 'Teknologi AI yang Membantu',
    desc: 'Kami menghadirkan kekuatan kecerdasan buatan — mulai dari penulisan deskripsi iklan otomatis hingga visualisasi renovasi — agar transaksi properti lebih cepat dan mudah.',
  },
  {
    icon: Heart,
    title: 'Kepercayaan Nomor Satu',
    desc: 'Setiap listing diverifikasi dan kami berkomitmen menjaga keamanan data pribadi seluruh pengguna sesuai regulasi Pelindungan Data Pribadi Indonesia.',
  },
  {
    icon: Users,
    title: 'Komunitas Penjual Berkualitas',
    desc: 'Kami menghubungkan agen properti, pengembang, dan pemilik perorangan dengan calon pembeli yang tepat — membangun ekosistem marketplace yang sehat dan saling menguntungkan.',
  },
];

export default function TentangKamiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-brand-dark"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Kembali ke Beranda
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 p-8 text-white sm:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-black sm:text-4xl">Tentang PROPERTIKA AI</h1>
          <p className="mt-4 text-base leading-relaxed text-emerald-100">
            Marketplace properti dan perabot hunian berbahasa Indonesia, dilengkapi alat bantu kecerdasan buatan untuk mempercepat proses jual-beli dan sewa properti.
          </p>
          <p className="mt-2 text-sm text-emerald-200">
            Didirikan 2026 · Berbasis di Jakarta, Indonesia
          </p>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-12 -right-4 h-64 w-64 rounded-full bg-white/5" />
      </div>

      {/* Visi & Misi */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Visi Kami</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Menjadi platform marketplace properti paling terpercaya dan terjangkau di Indonesia — tempat di mana setiap keputusan pembelian properti ditopang oleh data yang akurat dan teknologi yang manusiawi.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Misi Kami</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Membangun jembatan antara penjual properti dengan pembeli yang tepat melalui teknologi AI, pengalaman pencarian yang intuitif, dan layanan transaksi yang aman dan transparan.
          </p>
        </div>
      </div>

      {/* Nilai-Nilai */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-slate-900">Nilai-Nilai Kami</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {VALUES.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-dark">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-2xl border border-brand-soft bg-brand-soft/30 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">Siap Mulai?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Jual properti Anda, temukan hunian impian, atau coba fitur AI Studio kami secara gratis.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            to="/properti"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Lihat Properti
          </Link>
          <Link
            to="/ai-studio"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand-dark"
          >
            <Sparkles className="h-4 w-4" />
            Coba AI Studio
          </Link>
        </div>
      </div>
    </div>
  );
}
