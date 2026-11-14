import { postJson, readApiError } from './api-client';

export type PaymentStartResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

/** Minta tautan pembayaran Midtrans untuk pesanan milik pengguna. */
export async function startOrderPayment(orderId: string): Promise<PaymentStartResult> {
  try {
    const response = await postJson('/api/payments/create', { orderId });
    if (!response.ok) {
      return { ok: false, error: await readApiError(response, 'Pembayaran gagal dimulai') };
    }
    const payload = (await response.json()) as { redirectUrl?: unknown };
    if (typeof payload.redirectUrl !== 'string' || !payload.redirectUrl) {
      return { ok: false, error: 'Server tidak mengembalikan tautan pembayaran.' };
    }
    return { ok: true, redirectUrl: payload.redirectUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Pembayaran gagal dimulai.',
    };
  }
}
