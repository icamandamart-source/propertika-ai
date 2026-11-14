#!/usr/bin/env node
/**
 * Simulator notifikasi Midtrans untuk pengujian lokal.
 *
 * Menghitung signature SHA512(order_id + status_code + gross_amount + serverKey)
 * persis seperti Midtrans, lalu mengirimnya ke webhook lokal. Jadi alur
 * pembayaran bisa diuji tanpa tunnel publik atau transaksi sungguhan.
 *
 * Contoh:
 *   node scripts/midtrans-simulate.mjs --order order-1 --total 150000
 *   node scripts/midtrans-simulate.mjs --order order-1 --total 150000 --status expire
 *   node scripts/midtrans-simulate.mjs --health
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : true;
}

function fail(message) {
  console.error(`\n[GAGAL] ${message}\n`);
  process.exit(1);
}

const baseUrl = String(arg('url', process.env.APP_URL || 'http://localhost:3000')).replace(/\/+$/, '');

async function health() {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const body = await response.json();
    console.log(`HTTP ${response.status} ${baseUrl}/api/health`);
    console.log(JSON.stringify(body, null, 2));
    if (!body.paymentsEnabled) {
      console.log('\n[CATATAN] paymentsEnabled=false: isi MIDTRANS_SERVER_KEY di .env lalu restart server.');
    }
  } catch (error) {
    fail(`Server tidak bisa dihubungi di ${baseUrl}. Jalankan "npm run dev" dulu. (${error.message})`);
  }
}

if (arg('health', false) === true) {
  await health();
  process.exit(0);
}

const serverKey = (arg('server-key', process.env.MIDTRANS_SERVER_KEY || '') || '').trim();
if (!serverKey) {
  fail('MIDTRANS_SERVER_KEY kosong. Isi Server Key Sandbox di .env (Dashboard Midtrans > Settings > Access Keys).');
}

const orderId = String(arg('order', ''));
if (!/^[A-Za-z0-9._-]{1,128}$/.test(orderId)) {
  fail('Wajib --order <id pesanan>, hanya huruf/angka/titik/garis bawah/strip. Lihat /pesanan di aplikasi.');
}

const total = Number(arg('total', '0'));
if (!Number.isFinite(total) || total <= 0) {
  fail('Wajib --total <nominal> sama dengan total pesanan, misalnya --total 150000.');
}

const status = String(arg('status', 'settlement'));
const statusCodes = {
  settlement: '200',
  capture: '200',
  pending: '201',
  deny: '202',
  cancel: '202',
  expire: '407',
  failure: '202',
  refund: '200',
  authorize: '201',
};
const statusCode = statusCodes[status] ?? '200';
const grossAmount = total.toFixed(2);

const signature = createHash('sha512')
  .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
  .digest('hex');

const payload = {
  transaction_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
  transaction_status: status,
  transaction_id: `sim-${Date.now()}`,
  status_message: `Simulasi ${status}`,
  status_code: statusCode,
  signature_key: signature,
  payment_type: 'bank_transfer',
  order_id: orderId,
  merchant_id: 'G000000000',
  gross_amount: grossAmount,
  fraud_status: status === 'capture' ? 'accept' : undefined,
  currency: 'IDR',
};

console.log(`POST ${baseUrl}/api/payments/midtrans/webhook`);
console.log(`order=${orderId} gross=${grossAmount} status=${status} (${statusCode})`);

if (arg('dry-run', false) === true) {
  console.log('\nPayload (tidak dikirim):');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

try {
  const response = await fetch(`${baseUrl}/api/payments/midtrans/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  console.log(`\nHTTP ${response.status}`);
  console.log(text || '(tanpa body)');
  if (!response.ok) {
    console.log('\n[CATATAN] 401 = signature/server key tidak cocok. 400 = nominal tidak sama dengan total pesanan.');
  } else {
    console.log('\nSelesai. Cek dokumen orders/' + orderId + ' di Firestore.');
  }
} catch (error) {
  fail(`Gagal mengirim simulasi: ${error.message}`);
}
