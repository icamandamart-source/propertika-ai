import { Link } from 'react-router-dom';
import { Camera, Globe, Mail, MapPin, Phone, Play, ShieldCheck, Truck } from 'lucide-react';
import BrandLogo from './BrandLogo';

const COLUMNS = [
  {
    title: 'Tentang Propertika',
    links: [
      { label: 'Tentang Kami', to: '/tentang-kami' },
      { label: 'Blog Properti', to: '/properti' },
      { label: 'Syarat & Ketentuan', to: '/syarat-ketentuan' },
      { label: 'Kebijakan Privasi', to: '/kebijakan-privasi' },
    ],
  },
  {
    title: 'Bantuan',
    links: [
      { label: 'Pusat Bantuan', to: '/properti' },
      { label: 'Cara Berbelanja', to: '/keranjang' },
      { label: 'Cek Pesanan', to: '/pesanan' },
      { label: 'Hubungi Kami', to: '/properti' },
    ],
  },
  {
    title: 'Pembeli',
    links: [
      { label: 'Voucher Saya', to: '/voucher' },
      { label: 'Flash Sale', to: '/flash-sale' },
      { label: 'Favorit', to: '/favorit' },
      { label: 'Akun Saya', to: '/akun' },
    ],
  },
  {
    title: 'Penjual',
    links: [
      { label: 'Jadi Penjual', to: '/jadi-penjual' },
      { label: 'Dashboard Penjual', to: '/dashboard-seller' },
      { label: 'Portal Penjual', to: '/masuk-penjual' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white pb-20 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_2.6fr]">
          <div>
            <BrandLogo />
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
              Marketplace properti dan perabot rumah dengan pengalaman belanja modern. Temukan pilihan,
              wujudkan impian — dibantu AI untuk deskripsi, visualisasi ruangan, dan simulasi KPR.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-slate-500">
              <p className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-brand" />
                Jakarta, Indonesia
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-brand" />
                0812-3456-7890
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-brand" />
                halo@propertika.ai
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {[Globe, Camera, Play].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-xs text-slate-500 transition hover:text-brand-dark">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              Pembayaran Aman
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1">
              <Truck className="h-3.5 w-3.5 text-brand" />
              Gratis Ongkir
            </span>
            <span className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600">BCA</span>
            <span className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600">Mandiri</span>
            <span className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600">QRIS</span>
            <span className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-600">COD</span>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} PROPERTIKA AI. Temukan Pilihan, Wujudkan Impian.
          </p>
        </div>
      </div>
    </footer>
  );
}
