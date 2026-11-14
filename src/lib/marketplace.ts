import type {
  CartItem,
  Listing,
  OrderStatus,
  ShippingMethod,
  Voucher,
} from '../types';

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'reg', label: 'Reguler', eta: '2–4 hari', price: 12_000, description: 'JNE / SiCepat REG' },
  { id: 'yes', label: 'Next Day', eta: 'Besok tiba', price: 22_000, description: 'Pengiriman prioritas' },
  { id: 'instant', label: 'Instan', eta: '2–4 jam', price: 30_000, description: 'Khusus Jabodetabek' },
  { id: 'cargo', label: 'Kargo', eta: '4–7 hari', price: 45_000, description: 'Untuk barang besar' },
];

export const PAYMENT_METHODS = [
  { id: 'transfer-bca', label: 'Transfer Bank BCA', detail: 'Virtual Account · verifikasi otomatis' },
  { id: 'transfer-mandiri', label: 'Transfer Bank Mandiri', detail: 'Virtual Account · verifikasi otomatis' },
  { id: 'ewallet', label: 'E-Wallet', detail: 'GoPay, OVO, DANA, ShopeePay' },
  { id: 'qris', label: 'QRIS', detail: 'Scan sekali, semua bank' },
  { id: 'cod', label: 'COD / Bayar di Tempat', detail: 'Bayar saat paket diterima' },
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'belum-dibayar': 'Belum Dibayar',
  dikemas: 'Dikemas',
  dikirim: 'Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  'belum-dibayar': 'bg-amber-100 text-amber-700',
  dikemas: 'bg-blue-100 text-blue-700',
  dikirim: 'bg-brand-soft text-brand-dark',
  selesai: 'bg-emerald-100 text-emerald-700',
  dibatalkan: 'bg-slate-100 text-slate-600',
};

export const ORDER_STATUS_PROGRESS: Record<OrderStatus, number> = {
  'belum-dibayar': 1,
  dikemas: 2,
  dikirim: 3,
  selesai: 4,
  dibatalkan: 0,
};

export function isValidListing(listing: Listing | undefined | null): listing is Listing {
  return Boolean(listing);
}

export function isFlashAvailable(listing: Listing): boolean {
  if (!listing.flashSale || typeof listing.flashPrice !== 'number' || listing.flashPrice <= 0) return false;
  if (typeof listing.flashStock === 'number' && listing.flashStock <= 0) return false;
  return true;
}

export function effectivePrice(listing: Listing): number {
  if (isFlashAvailable(listing)) return listing.flashPrice as number;
  return listing.price;
}

export function originalPriceOf(listing: Listing): number | null {
  const current = effectivePrice(listing);
  if (listing.originalPrice && listing.originalPrice > current) return listing.originalPrice;
  if (current < listing.price && listing.price > 0) return listing.price;
  return null;
}

export function discountPercent(listing: Listing): number {
  const original = originalPriceOf(listing);
  if (!original) return 0;
  const current = effectivePrice(listing);
  return Math.max(0, Math.round(((original - current) / original) * 100));
}

export function formatSold(value: number | undefined): string {
  if (!value || value <= 0) return 'Belum terjual';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} jt terjual`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '').replace('.', ',')} rb terjual`;
  return `${value} terjual`;
}

export function storeNameOf(listing: Listing): string {
  return listing.storeName?.trim() || listing.ownerName || 'Toko Propertika';
}

export function stockOf(listing: Listing): number {
  if (isFlashAvailable(listing) && typeof listing.flashStock === 'number') return listing.flashStock;
  return typeof listing.stock === 'number' ? listing.stock : 99;
}

export function isVoucherExpired(voucher: Voucher, now = new Date()): boolean {
  const end = new Date(`${voucher.expiry}T23:59:59`);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() < now.getTime();
}

export function voucherEligible(voucher: Voucher, subtotal: number): boolean {
  return !isVoucherExpired(voucher) && subtotal >= voucher.minSpend;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  cashback: number;
  total: number;
}

export function shippingCost(methodId: string, subtotal: number): number {
  const method = SHIPPING_METHODS.find((item) => item.id === methodId) ?? SHIPPING_METHODS[0];
  if (method.id === 'reg' && subtotal >= 5_000_000) return 0;
  return method.price;
}

export function calculateTotals(
  subtotal: number,
  methodId: string,
  voucher: Voucher | null | undefined,
): CheckoutTotals {
  const baseShipping = shippingCost(methodId, subtotal);
  let discount = 0;
  let shipping = baseShipping;
  let cashback = 0;

  if (voucher && voucherEligible(voucher, subtotal)) {
    if (voucher.type === 'diskon') {
      discount = voucher.percent
        ? Math.min(Math.round((subtotal * voucher.percent) / 100), voucher.maxDiscount ?? Number.POSITIVE_INFINITY)
        : Math.min(voucher.amount || 0, subtotal);
    } else if (voucher.type === 'ongkir') {
      const reduction = Math.min(voucher.amount || 0, baseShipping);
      shipping = Math.max(0, baseShipping - reduction);
    } else if (voucher.type === 'cashback') {
      cashback = voucher.percent
        ? Math.min(Math.round((subtotal * voucher.percent) / 100), voucher.maxDiscount ?? Number.POSITIVE_INFINITY)
        : voucher.amount || 0;
    }
  }

  const total = Math.max(0, subtotal - discount + shipping);
  return { subtotal, discount, shipping, cashback, total };
}

export interface CartLine extends CartItem {
  listing: Listing;
  unitPrice: number;
  lineTotal: number;
}

export function hydrateCart(cart: CartItem[], listings: Listing[]): CartLine[] {
  return cart
    .map((item) => {
      const listing = listings.find((entry) => entry.id === item.listingId);
      if (!listing) return null;
      const unitPrice = effectivePrice(listing);
      return { ...item, listing, unitPrice, lineTotal: unitPrice * item.qty };
    })
    .filter((item): item is CartLine => Boolean(item));
}

export function cartTotals(lines: CartLine[]): { count: number; subtotal: number } {
  return lines.reduce(
    (acc, line) => {
      if (!line.selected) return acc;
      return { count: acc.count + line.qty, subtotal: acc.subtotal + line.lineTotal };
    },
    { count: 0, subtotal: 0 },
  );
}

export function mergeCarts(base: CartItem[], incoming: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...base, ...incoming]) {
    const existing = map.get(item.id);
    if (existing) {
      map.set(item.id, { ...existing, qty: existing.qty + item.qty, selected: existing.selected || item.selected });
    } else {
      map.set(item.id, { ...item });
    }
  }
  return Array.from(map.values());
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function getStoreNames(listings: Listing[]): string[] {
  return unique(listings.map(storeNameOf)).sort((a, b) => a.localeCompare(b));
}
