import { useEffect, useState } from 'react';
import { placeholderImage } from '../lib/image';

interface Props {
  src?: string;
  alt: string;
  category?: string;
  seed?: string;
  className?: string;
}

/** <img> yang otomatis jatuh ke placeholder lokal bila gambar gagal dimuat. */
export default function SafeImage({ src, alt, category = 'Rumah', seed, className }: Props) {
  const fallback = placeholderImage(seed || alt, alt, category);
  const [current, setCurrent] = useState(src?.trim() || fallback);

  useEffect(() => {
    setCurrent(src?.trim() || fallback);
  }, [src, fallback]);

  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setCurrent(fallback)}
    />
  );
}
