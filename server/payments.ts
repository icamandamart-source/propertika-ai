import { FieldValue } from 'firebase-admin/firestore';
import type { AdminServices } from './admin.ts';
import {
  PaymentError,
  isValidMidtransSignature,
  mapMidtransStatus,
  parseMidtransWebhook,
  sameAmount,
  type PaymentStatus,
} from './payment-core.ts';

const ORDER_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export interface SnapPayment {
  redirectUrl: string;
  token: string;
}

export interface MidtransWebhookResult {
  orderId: string;
  status: PaymentStatus;
}

export function midtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY?.trim());
}

function midtransServerKey(): string {
  return process.env.MIDTRANS_SERVER_KEY?.trim() ?? '';
}

function midtransSnapUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

function appBaseUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `http://localhost:${process.env.PORT?.trim() || '3000'}`;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function shortened(value: unknown, max: number): string | undefined {
  const text = asText(value, '');
  return text ? text.slice(0, max) : undefined;
}

function providerMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const messages = (payload as Record<string, unknown>).error_messages;
  if (!Array.isArray(messages)) return '';
  return messages.filter((item) => typeof item === 'string').join('; ').slice(0, 200);
}

/**
 * Buat transaksi Midtrans Snap untuk pesanan milik pengguna, lalu simpan
 * referensi pembayaran di dokumen pesanan. Kredensial dibaca dari env server.
 */
export async function createSnapPayment(
  admin: AdminServices,
  uid: string,
  orderId: unknown,
): Promise<SnapPayment> {
  const serverKey = midtransServerKey();
  if (!serverKey) {
    throw new PaymentError(503, 'Pembayaran online belum dikonfigurasi. Gunakan COD atau hubungi admin.');
  }
  if (typeof orderId !== 'string' || !ORDER_ID_PATTERN.test(orderId)) {
    throw new PaymentError(400, 'Pesanan tidak valid.');
  }

  const ref = admin.db.doc(`orders/${orderId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new PaymentError(404, 'Pesanan tidak ditemukan.');
  const order = snapshot.data() ?? {};
  if (order.buyerUid !== uid) throw new PaymentError(404, 'Pesanan tidak ditemukan.');
  if (order.paymentMethodId === 'cod') {
    throw new PaymentError(400, 'Pesanan COD tidak memerlukan pembayaran online.');
  }
  if (order.status !== 'belum-dibayar') {
    throw new PaymentError(409, 'Pesanan ini sudah diproses dan tidak menunggu pembayaran.');
  }

  const total = typeof order.total === 'number' ? order.total : Number(order.total);
  if (!Number.isFinite(total) || total <= 0) {
    throw new PaymentError(409, 'Total pesanan tidak valid untuk pembayaran.');
  }

  const recipient = asText(order.recipient, asText(order.buyerName, 'Pembeli'));
  const phone = shortened(order.phone, 20);
  const address = shortened(order.address, 200);
  const city = shortened(order.city, 50);
  const finishUrl = `${appBaseUrl()}/pesanan/${orderId}`;

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Math.round(total),
    },
    customer_details: {
      first_name: recipient.slice(0, 50),
      phone,
      billing_address: {
        first_name: recipient.slice(0, 50),
        phone,
        address,
        city,
      },
      shipping_address: {
        first_name: recipient.slice(0, 50),
        phone,
        address,
        city,
      },
    },
    callbacks: {
      finish: finishUrl,
      error: finishUrl,
      pending: finishUrl,
    },
    expiry: { unit: 'hours', duration: 24 },
  };

  let response: Response;
  try {
    response = await fetch(midtransSnapUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaymentError(502, 'Gagal menghubungi Midtrans. Coba lagi beberapa saat lagi.');
  }

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = providerMessage(result);
    throw new PaymentError(
      502,
      detail ? `Midtrans menolak pembayaran: ${detail}` : 'Midtrans menolak permintaan pembayaran.',
    );
  }

  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  const token = typeof record.token === 'string' ? record.token : '';
  const redirectUrl = typeof record.redirect_url === 'string' ? record.redirect_url : '';
  if (!token || !redirectUrl) {
    throw new PaymentError(502, 'Respons Midtrans tidak lengkap. Coba lagi.');
  }

  await ref.set(
    {
      paymentProvider: 'midtrans',
      paymentStatus: 'pending',
      paymentRef: token,
      paymentUrl: redirectUrl,
      paymentCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { redirectUrl, token };
}

/**
 * Tangani notifikasi Midtrans. Signature diverifikasi lebih dulu, lalu status
 * pesanan diperbarui lewat Admin SDK sehingga pembeli tidak bisa memalsukan
 * status pembayaran.
 */
export async function handleMidtransWebhook(
  admin: AdminServices,
  body: unknown,
): Promise<MidtransWebhookResult> {
  const serverKey = midtransServerKey();
  if (!serverKey) {
    throw new PaymentError(503, 'Pembayaran online belum dikonfigurasi.');
  }

  const payload = parseMidtransWebhook(body);
  if (!isValidMidtransSignature(payload, serverKey)) {
    throw new PaymentError(401, 'Signature notifikasi pembayaran tidak valid.');
  }

  const ref = admin.db.doc(`orders/${payload.order_id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new PaymentError(404, 'Pesanan tidak ditemukan.');

  const order = snapshot.data() ?? {};
  const total = typeof order.total === 'number' ? order.total : Number(order.total);
  if (!Number.isFinite(total) || !sameAmount(payload.gross_amount, total)) {
    throw new PaymentError(400, 'Nominal pembayaran tidak cocok dengan pesanan.');
  }

  const status = mapMidtransStatus(payload.transaction_status, payload.fraud_status);
  if (status === 'ignored') return { orderId: payload.order_id, status };

  const update: Record<string, unknown> = {
    paymentProvider: 'midtrans',
    paymentStatus: status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (payload.transaction_id) update.paymentRef = payload.transaction_id;
  if (payload.payment_type) update.paymentType = payload.payment_type;
  if (status === 'paid') {
    update.paidAt = FieldValue.serverTimestamp();
    update.paymentUrl = FieldValue.delete();
    if (order.status === 'belum-dibayar') update.status = 'dikemas';
  }

  await ref.set(update, { merge: true });
  return { orderId: payload.order_id, status };
}
