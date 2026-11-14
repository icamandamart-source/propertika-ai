import { createHash, timingSafeEqual } from 'node:crypto';

/** Kesalahan pembayaran yang aman ditampilkan ke klien. */
export class PaymentError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentError';
    this.status = status;
  }
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'ignored';

export interface MidtransWebhookPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  max: number,
): string {
  const value = record[key];
  if (typeof value !== 'string') throw new PaymentError(400, `Field ${key} tidak valid.`);
  const text = value.trim();
  if (!text || text.length > max) throw new PaymentError(400, `Field ${key} tidak valid.`);
  return text;
}

function optionalString(record: Record<string, unknown>, key: string, max: number): string | undefined {
  const value = record[key];
  if (value == null) return undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= max ? text : undefined;
}

/** Signature Midtrans: SHA512(order_id + status_code + gross_amount + serverKey). */
export function midtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

/** Perbandingan waktu-konstan agar signature tidak bisa ditebak lewat timing. */
export function isValidMidtransSignature(payload: MidtransWebhookPayload, serverKey: string): boolean {
  if (!payload.signature_key || !serverKey) return false;
  const expected = midtransSignature(
    payload.order_id,
    payload.status_code,
    payload.gross_amount,
    serverKey,
  );
  const received = payload.signature_key.toLowerCase();
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function parseMidtransWebhook(body: unknown): MidtransWebhookPayload {
  if (!isRecord(body)) throw new PaymentError(400, 'Notifikasi pembayaran tidak valid.');

  const orderId = requiredString(body, 'order_id', 128);
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(orderId)) {
    throw new PaymentError(400, 'order_id tidak valid.');
  }

  const statusCode = requiredString(body, 'status_code', 8);
  const rawGross = body.gross_amount;
  const grossAmount =
    typeof rawGross === 'number' && Number.isFinite(rawGross)
      ? String(rawGross)
      : requiredString(body, 'gross_amount', 32);
  if (!/^\d+(\.\d{1,2})?$/.test(grossAmount)) {
    throw new PaymentError(400, 'gross_amount tidak valid.');
  }

  const signatureKey = requiredString(body, 'signature_key', 256);
  const transactionStatus = requiredString(body, 'transaction_status', 40);

  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: grossAmount,
    signature_key: signatureKey,
    transaction_status: transactionStatus,
    fraud_status: optionalString(body, 'fraud_status', 40),
    transaction_id: optionalString(body, 'transaction_id', 128),
    payment_type: optionalString(body, 'payment_type', 60),
  };
}

/** Petakan status transaksi Midtrans ke status pembayaran internal. */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): PaymentStatus {
  const status = transactionStatus.toLowerCase();
  const fraud = fraudStatus?.toLowerCase();

  if (status === 'settlement') return 'paid';
  if (status === 'capture') {
    if (fraud === 'deny') return 'failed';
    if (fraud === 'challenge') return 'pending';
    return 'paid';
  }
  if (status === 'pending' || status === 'authorize') return 'pending';
  if (status === 'deny' || status === 'cancel' || status === 'expire' || status === 'failure') {
    return 'failed';
  }
  return 'ignored';
}

/** Bandingkan nominal notifikasi dengan total pesanan tanpa terpengaruh desimal ".00". */
export function sameAmount(grossAmount: string, total: number): boolean {
  const value = Number(grossAmount);
  return Number.isFinite(value) && Math.round(value) === Math.round(total);
}
