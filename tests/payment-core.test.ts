import { describe, expect, it } from 'vitest';
import {
  PaymentError,
  isValidMidtransSignature,
  mapMidtransStatus,
  midtransSignature,
  parseMidtransWebhook,
  sameAmount,
} from '../server/payment-core';

const SERVER_KEY = 'SB-Mid-server-test';
const SIGNATURE =
  '9d27b1a2ca3a46f1e075aa00632fb495d6916efd3d103834d042a4600a72db185f6d0992b55f55d5febe9023b5db560ebd0301d2991df23117df0b97d9be9fe0';

const validBody = {
  order_id: 'order-1',
  status_code: '200',
  gross_amount: '100000.00',
  signature_key: SIGNATURE,
  transaction_status: 'settlement',
  fraud_status: 'accept',
  transaction_id: 'trx-1',
  payment_type: 'bank_transfer',
};

describe('midtransSignature', () => {
  it('menghitung SHA512(order_id + status_code + gross_amount + serverKey)', () => {
    expect(midtransSignature('order-1', '200', '100000.00', SERVER_KEY)).toBe(SIGNATURE);
  });
});

describe('isValidMidtransSignature', () => {
  it('menerima signature yang cocok', () => {
    expect(isValidMidtransSignature(parseMidtransWebhook(validBody), SERVER_KEY)).toBe(true);
  });

  it('menolak nominal, server key, atau signature yang diubah', () => {
    expect(
      isValidMidtransSignature(
        { ...parseMidtransWebhook(validBody), gross_amount: '100000.01' },
        SERVER_KEY,
      ),
    ).toBe(false);
    expect(isValidMidtransSignature(parseMidtransWebhook(validBody), 'SB-Mid-server-lain')).toBe(
      false,
    );
    expect(
      isValidMidtransSignature(
        { ...parseMidtransWebhook(validBody), signature_key: SIGNATURE.replace('a', 'b') },
        SERVER_KEY,
      ),
    ).toBe(false);
  });
});

describe('parseMidtransWebhook', () => {
  it('menormalkan payload valid', () => {
    const payload = parseMidtransWebhook(validBody);
    expect(payload.order_id).toBe('order-1');
    expect(payload.gross_amount).toBe('100000.00');
    expect(payload.fraud_status).toBe('accept');
    expect(payload.transaction_id).toBe('trx-1');
  });

  it('menerima gross_amount berupa angka', () => {
    expect(parseMidtransWebhook({ ...validBody, gross_amount: 100000 }).gross_amount).toBe(
      '100000',
    );
  });

  it('menolak payload yang tidak lengkap atau tidak valid', () => {
    expect(() => parseMidtransWebhook(null)).toThrow(PaymentError);
    expect(() => parseMidtransWebhook({ ...validBody, order_id: '' })).toThrow(PaymentError);
    expect(() => parseMidtransWebhook({ ...validBody, order_id: 'order satu' })).toThrow(
      PaymentError,
    );
    expect(() => parseMidtransWebhook({ ...validBody, gross_amount: '100000.123' })).toThrow(
      PaymentError,
    );
    expect(() => parseMidtransWebhook({ ...validBody, signature_key: 12 })).toThrow(PaymentError);
    expect(() => parseMidtransWebhook({ ...validBody, transaction_status: '' })).toThrow(
      PaymentError,
    );
  });
});

describe('mapMidtransStatus', () => {
  it('memetakan settlement dan capture menjadi paid', () => {
    expect(mapMidtransStatus('settlement')).toBe('paid');
    expect(mapMidtransStatus('capture', 'accept')).toBe('paid');
  });

  it('menahan capture challenge sebagai pending', () => {
    expect(mapMidtransStatus('capture', 'challenge')).toBe('pending');
    expect(mapMidtransStatus('pending')).toBe('pending');
  });

  it('menandai transaksi gagal/kedaluwarsa sebagai failed', () => {
    expect(mapMidtransStatus('capture', 'deny')).toBe('failed');
    expect(mapMidtransStatus('deny')).toBe('failed');
    expect(mapMidtransStatus('cancel')).toBe('failed');
    expect(mapMidtransStatus('expire')).toBe('failed');
    expect(mapMidtransStatus('failure')).toBe('failed');
  });

  it('mengabaikan status yang tidak mengubah pesanan', () => {
    expect(mapMidtransStatus('refund')).toBe('ignored');
    expect(mapMidtransStatus('')).toBe('ignored');
  });
});

describe('sameAmount', () => {
  it('mengabaikan desimal .00 pada notifikasi', () => {
    expect(sameAmount('100000.00', 100000)).toBe(true);
    expect(sameAmount('100000', 100000)).toBe(true);
    expect(sameAmount('100000.50', 100000)).toBe(false);
    expect(sameAmount('bukan-angka', 100000)).toBe(false);
  });
});
