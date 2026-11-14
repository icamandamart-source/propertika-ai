import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminServices } from '../server/admin';
import { PaymentError, midtransSignature } from '../server/payment-core';
import { createSnapPayment, handleMidtransWebhook, midtransConfigured } from '../server/payments';

const SERVER_KEY = 'SB-Mid-server-test';
const APP_URL = 'https://propertika.test';

interface FakeDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface FakeWrite {
  id: string;
  data: Record<string, unknown>;
}

function fakeAdmin(initial: Record<string, Record<string, unknown>> = {}) {
  const docs = new Map<string, Record<string, unknown>>(Object.entries(initial));
  const writes: FakeWrite[] = [];
  const db = {
    doc: (path: string) => {
      const id = path.replace(/^orders\//, '');
      return {
        get: async (): Promise<FakeDocSnapshot> => {
          const data = docs.get(id);
          return { exists: Boolean(data), data: () => data };
        },
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          writes.push({ id, data });
          const current = docs.get(id) ?? {};
          docs.set(id, options?.merge ? { ...current, ...data } : data);
        },
      };
    },
  };
  return { admin: { db } as unknown as AdminServices, docs, writes };
}

function orderDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    buyerUid: 'uid-1',
    status: 'belum-dibayar',
    paymentMethodId: 'transfer-bca',
    total: 150_000,
    recipient: 'Budi Santoso',
    phone: '081234567890',
    address: 'Jl. Merdeka 10',
    city: 'Bandung',
    ...overrides,
  };
}

function webhookBody(
  overrides: Record<string, unknown> = {},
  serverKey = SERVER_KEY,
): Record<string, unknown> {
  const base = {
    order_id: 'order-1',
    status_code: '200',
    gross_amount: '150000.00',
    transaction_status: 'settlement',
    fraud_status: 'accept',
    transaction_id: 'trx-1',
    payment_type: 'bank_transfer',
    ...overrides,
  };
  return {
    ...base,
    signature_key: midtransSignature(
      String(base.order_id),
      String(base.status_code),
      String(base.gross_amount),
      serverKey,
    ),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
  process.env.APP_URL = APP_URL;
  delete process.env.MIDTRANS_IS_PRODUCTION;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  delete process.env.MIDTRANS_SERVER_KEY;
  delete process.env.APP_URL;
  delete process.env.MIDTRANS_IS_PRODUCTION;
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('midtransConfigured', () => {
  it('aktif hanya bila server key terisi', () => {
    expect(midtransConfigured()).toBe(true);
    process.env.MIDTRANS_SERVER_KEY = '   ';
    expect(midtransConfigured()).toBe(false);
  });
});

describe('createSnapPayment', () => {
  it('menolak saat server key belum diisi', async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    const { admin } = fakeAdmin();
    await expect(createSnapPayment(admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 503,
    });
  });

  it('menolak ID pesanan yang tidak valid', async () => {
    const { admin } = fakeAdmin();
    await expect(createSnapPayment(admin, 'uid-1', 'order satu')).rejects.toBeInstanceOf(
      PaymentError,
    );
    await expect(createSnapPayment(admin, 'uid-1', 42)).rejects.toMatchObject({ status: 400 });
  });

  it('menyembunyikan pesanan yang bukan milik pengguna', async () => {
    const { admin } = fakeAdmin({ 'order-1': orderDoc() });
    await expect(createSnapPayment(admin, 'uid-lain', 'order-1')).rejects.toMatchObject({
      status: 404,
    });
    await expect(createSnapPayment(admin, 'uid-1', 'order-tidak-ada')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('menolak pesanan COD atau yang sudah diproses', async () => {
    const cod = fakeAdmin({ 'order-1': orderDoc({ paymentMethodId: 'cod' }) });
    await expect(createSnapPayment(cod.admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 400,
    });

    const processed = fakeAdmin({ 'order-1': orderDoc({ status: 'dikemas' }) });
    await expect(createSnapPayment(processed.admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('membuat transaksi Snap dan menyimpan referensi pembayaran', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'snap-token-123',
          redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-123',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const { admin, writes } = fakeAdmin({ 'order-1': orderDoc() });

    const result = await createSnapPayment(admin, 'uid-1', 'order-1');

    expect(result.token).toBe('snap-token-123');
    expect(result.redirectUrl).toContain('snap-token-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://app.sandbox.midtrans.com/snap/v1/transactions');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from(`${SERVER_KEY}:`).toString('base64')}`,
    );

    const payload = JSON.parse(String(init.body)) as {
      transaction_details: { order_id: string; gross_amount: number };
      callbacks: { finish: string };
      customer_details: { first_name: string; phone?: string };
    };
    expect(payload.transaction_details).toEqual({ order_id: 'order-1', gross_amount: 150_000 });
    expect(payload.callbacks.finish).toBe(`${APP_URL}/pesanan/order-1`);
    expect(payload.customer_details.first_name).toBe('Budi Santoso');
    expect(payload.customer_details.phone).toBe('081234567890');

    expect(writes).toHaveLength(1);
    expect(writes[0].data).toMatchObject({
      paymentProvider: 'midtrans',
      paymentStatus: 'pending',
      paymentRef: 'snap-token-123',
      paymentUrl: 'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-123',
    });
  });

  it('memakai endpoint produksi bila MIDTRANS_IS_PRODUCTION=true', async () => {
    process.env.MIDTRANS_IS_PRODUCTION = 'true';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ token: 't', redirect_url: 'https://app.midtrans.com/x' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { admin } = fakeAdmin({ 'order-1': orderDoc() });

    await createSnapPayment(admin, 'uid-1', 'order-1');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://app.midtrans.com/snap/v1/transactions');
  });

  it('meneruskan pesan penolakan Midtrans dan respons yang tidak lengkap', async () => {
    const { admin } = fakeAdmin({ 'order-1': orderDoc() });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error_messages: ['gross_amount tidak valid'] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(createSnapPayment(admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('gross_amount tidak valid'),
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'hanya-token' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(createSnapPayment(admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 502,
    });
  });

  it('membalas 502 saat Midtrans tidak bisa dihubungi', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { admin } = fakeAdmin({ 'order-1': orderDoc() });
    await expect(createSnapPayment(admin, 'uid-1', 'order-1')).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe('handleMidtransWebhook', () => {
  it('menolak saat server key belum diisi', async () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    const { admin } = fakeAdmin();
    await expect(handleMidtransWebhook(admin, webhookBody())).rejects.toMatchObject({
      status: 503,
    });
  });

  it('menolak signature yang salah', async () => {
    const { admin, writes } = fakeAdmin({ 'order-1': orderDoc() });
    await expect(
      handleMidtransWebhook(admin, webhookBody({}, 'SB-Mid-server-lain')),
    ).rejects.toMatchObject({ status: 401 });
    expect(writes).toHaveLength(0);
  });

  it('menolak pesanan yang tidak ada atau nominal yang tidak cocok', async () => {
    const missing = fakeAdmin();
    await expect(handleMidtransWebhook(missing.admin, webhookBody())).rejects.toMatchObject({
      status: 404,
    });

    const { admin, writes } = fakeAdmin({ 'order-1': orderDoc() });
    await expect(
      handleMidtransWebhook(admin, webhookBody({ gross_amount: '150001.00' })),
    ).rejects.toMatchObject({ status: 400 });
    expect(writes).toHaveLength(0);
  });

  it('menandai lunas dan memindahkan pesanan ke dikemas saat settlement', async () => {
    const { admin, docs } = fakeAdmin({ 'order-1': orderDoc() });
    const result = await handleMidtransWebhook(admin, webhookBody());

    expect(result).toEqual({ orderId: 'order-1', status: 'paid' });
    const saved = docs.get('order-1') ?? {};
    expect(saved).toMatchObject({
      paymentProvider: 'midtrans',
      paymentStatus: 'paid',
      status: 'dikemas',
      paymentRef: 'trx-1',
      paymentType: 'bank_transfer',
    });
    expect('paymentUrl' in saved).toBe(true);
  });

  it('tidak menurunkan status pesanan yang sudah lanjut', async () => {
    const { admin, docs } = fakeAdmin({ 'order-1': orderDoc({ status: 'dikirim' }) });
    await handleMidtransWebhook(admin, webhookBody());
    expect(docs.get('order-1')?.status).toBe('dikirim');
    expect(docs.get('order-1')?.paymentStatus).toBe('paid');
  });

  it('menahan pending dan menandai gagal untuk deny/expire', async () => {
    const pending = fakeAdmin({ 'order-1': orderDoc() });
    const pendingResult = await handleMidtransWebhook(
      pending.admin,
      webhookBody({ transaction_status: 'pending' }),
    );
    expect(pendingResult.status).toBe('pending');
    expect(pending.docs.get('order-1')).toMatchObject({
      paymentStatus: 'pending',
      status: 'belum-dibayar',
    });

    const expired = fakeAdmin({ 'order-1': orderDoc() });
    const expiredResult = await handleMidtransWebhook(
      expired.admin,
      webhookBody({ transaction_status: 'expire' }),
    );
    expect(expiredResult.status).toBe('failed');
    expect(expired.docs.get('order-1')).toMatchObject({
      paymentStatus: 'failed',
      status: 'belum-dibayar',
    });
  });

  it('mengabaikan status yang tidak relevan tanpa menulis apa pun', async () => {
    const { admin, writes } = fakeAdmin({ 'order-1': orderDoc() });
    const result = await handleMidtransWebhook(
      admin,
      webhookBody({ transaction_status: 'refund' }),
    );
    expect(result.status).toBe('ignored');
    expect(writes).toHaveLength(0);
  });
});
