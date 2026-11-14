import type { Listing, Order, OrderItem, Voucher } from '../src/types.ts';
import {
  PAYMENT_METHODS,
  SHIPPING_METHODS,
  calculateTotals,
  effectivePrice,
  isFlashAvailable,
  stockOf,
  storeNameOf,
  voucherEligible,
} from '../src/lib/marketplace.ts';

const MAX_ITEMS = 50;
const MAX_QTY = 1_000;

export class OrderError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'OrderError';
    this.status = status;
  }
}

export interface OrderItemInput {
  listingId: string;
  qty: number;
  variation?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  recipient: string;
  phone: string;
  address: string;
  city: string;
  shippingMethodId: string;
  paymentMethodId: string;
  voucherCode?: string;
  note?: string;
}

export interface ImportOrderInput extends CreateOrderInput {
  id: string;
  code?: string;
  createdAt: string;
}

export interface StockUpdate {
  listing: Listing;
  qty: number;
  isFlash: boolean;
}

export interface BuildOrderInput extends CreateOrderInput {
  uid: string;
  buyerName: string;
  claimedVoucherCodes: string[];
  listings: Map<string, Listing>;
  vouchers: Voucher[];
  now?: Date;
  id?: string;
  code?: string;
  createdAt?: string;
}

export interface BuiltOrder {
  order: Order;
  stockUpdates: StockUpdate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanText(value: unknown, min: number, max: number, label: string): string {
  if (typeof value !== 'string') throw new OrderError(400, `${label} tidak valid.`);
  const text = value.trim();
  if (text.length < min || text.length > max) {
    throw new OrderError(400, `${label} harus ${min}-${max} karakter.`);
  }
  return text;
}

function optionalText(value: unknown, max: number, label: string): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new OrderError(400, `${label} tidak valid.`);
  const text = value.trim();
  if (text.length > max) throw new OrderError(400, `${label} maksimal ${max} karakter.`);
  return text || undefined;
}

function safeId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) {
    throw new OrderError(400, `${label} tidak valid.`);
  }
  return value;
}

function parseItems(raw: unknown): OrderItemInput[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_ITEMS) {
    throw new OrderError(400, 'Pesanan harus berisi 1-50 item.');
  }

  return raw.map((entry, index) => {
    if (!isRecord(entry)) throw new OrderError(400, `Item ke-${index + 1} tidak valid.`);
    const listingId = safeId(entry.listingId, `listingId item ke-${index + 1}`);
    const qty = Number(entry.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      throw new OrderError(400, `Jumlah item ke-${index + 1} tidak valid.`);
    }
    const variation = optionalText(entry.variation, 120, `Varian item ke-${index + 1}`);
    return { listingId, qty, variation };
  });
}

function knownShipping(id: string): boolean {
  return SHIPPING_METHODS.some((method) => method.id === id);
}

function knownPayment(id: string): boolean {
  return PAYMENT_METHODS.some((method) => method.id === id);
}

function shippingIdFromLabel(label: string): string | undefined {
  return SHIPPING_METHODS.find((method) => method.label === label)?.id;
}

function paymentIdFromLabel(label: string): string | undefined {
  return PAYMENT_METHODS.find((method) => method.label === label)?.id;
}

export function parseCreateOrderInput(body: unknown): CreateOrderInput {
  if (!isRecord(body)) throw new OrderError(400, 'Data pesanan tidak valid.');

  const shippingMethodId = String(body.shippingMethodId ?? '').trim();
  if (!knownShipping(shippingMethodId)) {
    throw new OrderError(400, 'Metode pengiriman tidak dikenali.');
  }
  const paymentMethodId = String(body.paymentMethodId ?? '').trim();
  if (!knownPayment(paymentMethodId)) {
    throw new OrderError(400, 'Metode pembayaran tidak dikenali.');
  }

  return {
    items: parseItems(body.items),
    recipient: cleanText(body.recipient, 1, 160, 'Nama penerima'),
    phone: cleanText(body.phone, 1, 40, 'Nomor telepon'),
    address: cleanText(body.address, 3, 500, 'Alamat'),
    city: cleanText(body.city, 1, 100, 'Kota'),
    shippingMethodId,
    paymentMethodId,
    voucherCode: optionalText(body.voucherCode, 80, 'Kode voucher')?.toUpperCase(),
    note: optionalText(body.note, 500, 'Catatan'),
  };
}

export function parseImportOrders(body: unknown): ImportOrderInput[] {
  if (!isRecord(body) || !Array.isArray(body.orders)) {
    throw new OrderError(400, 'Daftar pesanan tidak valid.');
  }
  if (body.orders.length < 1 || body.orders.length > MAX_ITEMS) {
    throw new OrderError(400, 'Maksimal 50 pesanan dapat diimpor sekaligus.');
  }

  return body.orders.map((raw, index) => {
    if (!isRecord(raw)) throw new OrderError(400, `Pesanan ke-${index + 1} tidak valid.`);
    if (raw.status !== 'belum-dibayar') {
      throw new OrderError(400, `Pesanan ke-${index + 1} bukan pesanan yang belum dibayar.`);
    }

    const shippingMethodId =
      typeof raw.shippingMethodId === 'string' && knownShipping(raw.shippingMethodId)
        ? raw.shippingMethodId
        : shippingIdFromLabel(String(raw.shippingMethod ?? ''));
    if (!shippingMethodId) throw new OrderError(400, 'Metode pengiriman pesanan lama tidak dikenali.');

    const paymentMethodId =
      typeof raw.paymentMethodId === 'string' && knownPayment(raw.paymentMethodId)
        ? raw.paymentMethodId
        : paymentIdFromLabel(String(raw.paymentMethod ?? ''));
    if (!paymentMethodId) throw new OrderError(400, 'Metode pembayaran pesanan lama tidak dikenali.');

    const rawCreatedAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';
    const createdAt = Number.isNaN(new Date(rawCreatedAt).getTime())
      ? new Date().toISOString()
      : rawCreatedAt;
    const rawCode = typeof raw.code === 'string' ? raw.code.trim() : '';

    return {
      id: safeId(raw.id, `ID pesanan ke-${index + 1}`),
      code: rawCode.length > 0 && rawCode.length <= 80 ? rawCode : undefined,
      createdAt,
      items: parseItems(raw.items),
      recipient: cleanText(raw.recipient, 1, 160, 'Nama penerima'),
      phone: cleanText(raw.phone, 1, 40, 'Nomor telepon'),
      address: cleanText(raw.address, 3, 500, 'Alamat'),
      city: cleanText(raw.city, 1, 100, 'Kota'),
      shippingMethodId,
      paymentMethodId,
      voucherCode: optionalText(raw.voucherCode, 80, 'Kode voucher')?.toUpperCase(),
      note: optionalText(raw.note, 500, 'Catatan'),
    };
  });
}

function randomCode(now: Date): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${date}-${suffix}`;
}

function publicImageUrl(value: string | undefined): string {
  if (!value || value.startsWith('data:')) return '';
  return value;
}

export function buildOrder(input: BuildOrderInput): BuiltOrder {
  const now = input.now ?? new Date();
  const qtyByListing = new Map<string, number>();
  for (const item of input.items) {
    qtyByListing.set(item.listingId, (qtyByListing.get(item.listingId) ?? 0) + item.qty);
  }

  const items: OrderItem[] = [];
  const stockUpdates: StockUpdate[] = [];
  let subtotal = 0;

  for (const item of input.items) {
    const listing = input.listings.get(item.listingId);
    if (!listing) throw new OrderError(400, 'Salah satu produk tidak ditemukan atau sudah dihapus.');

    const totalQty = qtyByListing.get(item.listingId) ?? 0;
    if (totalQty > stockOf(listing)) {
      throw new OrderError(409, `Stok ${listing.title} tidak mencukupi.`);
    }

    const isFlash = isFlashAvailable(listing);
    const unitPrice = effectivePrice(listing);
    subtotal += unitPrice * item.qty;
    items.push({
      listingId: listing.id,
      title: listing.title,
      imageUrl: publicImageUrl(listing.imageUrl),
      price: unitPrice,
      qty: item.qty,
      variation: item.variation,
      isFlash,
      ownerId: listing.ownerId,
      ownerName: storeNameOf(listing),
      category: listing.category,
    });
    if (!stockUpdates.some((update) => update.listing.id === listing.id)) {
      stockUpdates.push({ listing, qty: totalQty, isFlash });
    }
  }

  let voucher: Voucher | undefined;
  if (input.voucherCode) {
    const code = input.voucherCode.toUpperCase();
    voucher = input.vouchers.find((item) => item.code.toUpperCase() === code);
    if (!voucher || !voucherEligible(voucher, subtotal)) {
      throw new OrderError(400, 'Voucher tidak berlaku untuk transaksi ini.');
    }
    if (!input.claimedVoucherCodes.includes(voucher.code)) {
      throw new OrderError(403, 'Klaim voucher di pusat voucher sebelum memakainya.');
    }
  }

  const totals = calculateTotals(subtotal, input.shippingMethodId, voucher);
  const shippingLabel =
    SHIPPING_METHODS.find((method) => method.id === input.shippingMethodId)?.label ?? 'Reguler';
  const paymentLabel =
    PAYMENT_METHODS.find((method) => method.id === input.paymentMethodId)?.label ??
    PAYMENT_METHODS[0].label;

  const order: Order = {
    id: input.id ?? `order-${crypto.randomUUID()}`,
    code: input.code ?? randomCode(now),
    items,
    listingIds: Array.from(new Set(items.map((item) => item.listingId))),
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    cashback: totals.cashback,
    voucherCode: voucher?.code,
    total: totals.total,
    status: 'belum-dibayar',
    recipient: input.recipient,
    phone: input.phone,
    address: input.address,
    city: input.city,
    shippingMethod: shippingLabel,
    shippingMethodId: input.shippingMethodId,
    paymentMethod: paymentLabel,
    paymentMethodId: input.paymentMethodId,
    note: input.note,
    buyerUid: input.uid,
    buyerName: input.buyerName || input.recipient || 'Pembeli',
    createdAt: input.createdAt ?? now.toISOString(),
  };

  return { order, stockUpdates };
}