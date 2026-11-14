import { Link } from 'react-router-dom';
import logoTemukanPilihan from '../assets/logo-temukan-pilihan-transparent.png';

export default function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Beranda HomiQue"
      className={`inline-flex shrink-0 items-center ${className}`}
    >
      <img
        src={logoTemukanPilihan}
        alt="HomiQue — Temukan Pilihan, Wujudkan Impian"
        className="h-9 w-auto object-contain sm:h-10"
      />
    </Link>
  );
}
