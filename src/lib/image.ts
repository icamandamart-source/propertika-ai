/** Utilitas gambar: placeholder SVG deterministik + kompresi upload sebelum disimpan. */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string,
  );
}

const GLYPHS: Record<string, string> = {
  Rumah: '<path d="M400 210 250 330v170h100v-95h100v95h100V330z"/>',
  Apartemen: '<path d="M300 195h200v305H300zm40 45h45v45h-45zm75 0h45v45h-45zm-75 75h45v45h-45zm75 0h45v45h-45zm-75 75h45v45h-45zm75 0h45v45h-45z"/>',
  Tanah: '<path d="M230 400h340v40H230zm40-40 130-95 130 95z"/><path d="M360 265v-45h30v25z"/>',
  Furniture: '<path d="M250 320h300v20H250zm20 20h40v90h-40zm220 0h40v90h-40zM270 260h260v60H270z"/>',
};

/**
 * Placeholder offline yang enak dilihat, dipakai saat listing belum punya foto
 * atau saat gambar dari jaringan gagal dimuat.
 */
export function placeholderImage(seed: string, label = 'PROPERTIKA', category = 'Rumah'): string {
  const h = hash(seed) % 360;
  const h2 = (h + 42) % 360;
  const glyph = GLYPHS[category] ?? GLYPHS.Rumah;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h},38%,26%)"/>
<stop offset="1" stop-color="hsl(${h2},44%,13%)"/>
</linearGradient>
<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse">
<path d="M40 0H0v40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
</pattern>
</defs>
<rect width="800" height="600" fill="url(#g)"/>
<rect width="800" height="600" fill="url(#p)"/>
<g fill="rgba(255,255,255,0.14)">${glyph}</g>
<text x="48" y="524" font-family="Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="30" font-weight="700" fill="rgba(255,255,255,0.72)" letter-spacing="3">${escapeXml(label.toUpperCase().slice(0, 34))}</text>
<text x="48" y="560" font-family="Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="19" fill="rgba(255,255,255,0.42)">Foto belum tersedia</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function listingImage(listing: { id: string; title: string; category: string; imageUrl?: string }): string {
  return listing.imageUrl?.trim() || placeholderImage(listing.id + listing.title, listing.title, listing.category);
}

/** Baca file sebagai data URL (dipakai untuk pratinjau & upload ke server). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsDataURL(file);
  });
}

const MAX_DIMENSION = 1280;

/**
 * Perkecil & kompres gambar supaya aman disimpan di localStorage (kuota ~5 MB).
 * Mengembalikan data URL JPEG.
 */
export async function compressImage(file: File, maxDimension = MAX_DIMENSION, quality = 0.72): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Format gambar tidak dikenali.'));
    image.src = src;
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
