import type { Address, Order } from '../types';
import { postJson, readApiError } from './api-client';

export interface ServerOrderItem {
  listingId: string;
  qty: number;
  variation?: string;
}

export interface ServerOrderRequest {
  items: ServerOrderItem[];
  address: Address;
  shippingMethodId: string;
  paymentMethodId: string;
  voucherCode?: string;
  note?: string;
}

type OrderResponse = { order?: Order; error?: string };

export async function createOrderOnServer(
  input: ServerOrderRequest,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const response = await postJson('/api/orders', {
    items: input.items,
    recipient: input.address.recipient,
    phone: input.address.phone,
    address: input.address.detail,
    city: input.address.city,
    shippingMethodId: input.shippingMethodId,
    paymentMethodId: input.paymentMethodId,
    voucherCode: input.voucherCode,
    note: input.note,
  });
  if (!response.ok) return { ok: false, error: await readApiError(response, 'Pembuatan pesanan gagal') };

  const payload = (await response.json()) as OrderResponse;
  if (!payload.order) return { ok: false, error: 'Server tidak mengembalikan data pesanan.' };
  return { ok: true, order: payload.order };
}

/**
 * Kirim pesanan tamu agar dibuat ulang oleh server. Hanya pesanan berstatus awal
 * yang dikirim; server memvalidasi ulang katalog, voucher, dan stok.
 */
export async function importOrdersOnServer(orders: Order[]): Promise<number> {
  const owned = orders.filter((order) => order.status === 'belum-dibayar').slice(0, 50);
  if (owned.length === 0) return 0;

  const response = await postJson('/api/orders/import', { orders: owned });
  if (!response.ok) throw new Error(await readApiError(response, 'Sinkronisasi pesanan gagal'));
  const payload = (await response.json()) as { imported?: number };
  return typeof payload.imported === 'number' ? payload.imported : 0;
}