const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

/** Rp 1.500.000.000 */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0';
  return idr.format(Math.round(value)).replace(/\s/g, ' ');
}

/** Rp 1,5 M / Rp 800 Jt / Rp 500 Rb — untuk kartu yang butuh teks ringkas. */
export function formatRupiahShort(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Hubungi penjual';
  const trim = (n: number) => n.toFixed(n < 10 ? 1 : 0).replace('.', ',').replace(/,0$/, '');
  if (value >= 1_000_000_000_000) return `Rp ${trim(value / 1_000_000_000_000)} T`;
  if (value >= 1_000_000_000) return `Rp ${trim(value / 1_000_000_000)} M`;
  if (value >= 1_000_000) return `Rp ${trim(value / 1_000_000)} Jt`;
  if (value >= 1_000) return `Rp ${trim(value / 1_000)} Rb`;
  return `Rp ${value}`;
}

/** 120 m² */
export function formatArea(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-';
  return `${new Intl.NumberFormat('id-ID').format(value)} m²`;
}

/** 6 Nov 2026 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Ringkasan spesifikasi untuk kartu listing. */
export function formatSpecs(listing: {
  category: string;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  buildingArea: number;
}): string {
  const parts: string[] = [];
  if (listing.category === 'Tanah') {
    if (listing.landArea > 0) parts.push(`LT ${formatArea(listing.landArea)}`);
    return parts.join(' · ') || 'Luas belum diisi';
  }
  if (listing.category === 'Furniture') {
    return listing.buildingArea > 0 ? `Dimensi ${formatArea(listing.buildingArea)}` : 'Furniture';
  }
  if (listing.bedrooms > 0) parts.push(`${listing.bedrooms} KT`);
  if (listing.bathrooms > 0) parts.push(`${listing.bathrooms} KM`);
  if (listing.buildingArea > 0) parts.push(`LB ${formatArea(listing.buildingArea)}`);
  if (listing.landArea > 0) parts.push(`LT ${formatArea(listing.landArea)}`);
  return parts.join(' · ') || 'Spesifikasi belum diisi';
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Format ribuan untuk input teks harga: 1500000000 -> "1.500.000.000" */
export function formatNumberInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Intl.NumberFormat('id-ID').format(value);
}

/** "1.500.000.000" -> 1500000000 */
export function parseNumberInput(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}
