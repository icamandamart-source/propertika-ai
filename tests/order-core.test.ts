import { describe, expect, it } from 'vitest';
import {
  OrderError,
  buildOrder,
  parseCreateOrderInput,
  parseImportOrders,
} from '../server/order-core';
import type { Listing, Voucher } from '../src/types';
import { makeListing, makeVoucher } from './helpers';

function listingMap(...listings: Listing[]): Map<string, Listing> {
  return new Map(listings.map((listing) => [listing.id, listing]));
}

function expectOrderError(fn: () => unknown, status: number): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(OrderError);
    expect((error as OrderError).status).toBe(status);
    return;
  }
  throw new Error('Seharusnya melempar OrderError.');
}

describe('parseCreateOrderInput', () => {
  const validBody = {
    items: [{ listingId: 'listing-1', qty: 2, variation: '  Unit A  ' }],
    recipient: '  Budi  ',
    phone: ' 081200000000 ',
    address: '  Jl. Uji No. 1  ',
    city: ' Jakarta ',
    shippingMethodId: 'reg',
    paymentMethodId: 'transfer-bca',
    voucherCode: ' hemat10 ',
    note: '  Titip di pos  ',
  };

  it('membersihkan spasi dan menormalkan kode voucher', () => {
    const input = parseCreateOrderInput(validBody);
    expect(input).toMatchObject({
      recipient: 'Budi',
      phone: '081200000000',
      address: 'Jl. Uji No. 1',
      city: 'Jakarta',
      voucherCode: 'HEMAT10',
      note: 'Titip di pos',
    });
    expect(input.items[0]).toEqual({ listingId: 'listing-1', qty: 2, variation: 'Unit A' });
  });

  it('menolak metode kirim atau bayar yang tidak dikenal', () => {
    expectOrderError(
      () => parseCreateOrderInput({ ...validBody, shippingMethodId: 'teleport' }),
      400,
    );
    expectOrderError(
      () => parseCreateOrderInput({ ...validBody, paymentMethodId: 'gratis' }),
      400,
    );
  });

  it('menolak keranjang kosong, jumlah tidak bulat, dan data wajib yang kosong', () => {
    expectOrderError(() => parseCreateOrderInput({ ...validBody, items: [] }), 400);
    expectOrderError(
      () => parseCreateOrderInput({ ...validBody, items: [{ listingId: 'x', qty: 1.5 }] }),
      400,
    );
    expectOrderError(() => parseCreateOrderInput({ ...validBody, recipient: '   ' }), 400);
    expectOrderError(
      () => parseCreateOrderInput({ ...validBody, items: [{ listingId: '../x', qty: 1 }] }),
      400,
    );
  });
});

describe('buildOrder', () => {
  const listing = makeListing({ id: 'listing-1', price: 100_000, stock: 5 });
  const voucher: Voucher = makeVoucher({ code: 'UJI10', percent: 10, minSpend: 100_000 });

  function build(overrides: Partial<Parameters<typeof buildOrder>[0]> = {}) {
    return buildOrder({
      items: [{ listingId: 'listing-1', qty: 2 }],
      recipient: 'Budi',
      phone: '081200000000',
      address: 'Jl. Uji No. 1',
      city: 'Jakarta',
      shippingMethodId: 'reg',
      paymentMethodId: 'transfer-bca',
      uid: 'user-1',
      buyerName: 'Budi',
      claimedVoucherCodes: [],
      listings: listingMap(listing),
      vouchers: [voucher],
      now: new Date('2026-11-13T00:00:00.000Z'),
      ...overrides,
    });
  }

  it('menghitung total dari harga katalog dan voucher yang diklaim', () => {
    const built = build({ voucherCode: 'uji10', claimedVoucherCodes: ['UJI10'] });
    expect(built.order).toMatchObject({
      subtotal: 200_000,
      discount: 20_000,
      shipping: 12_000,
      total: 192_000,
      voucherCode: 'UJI10',
      status: 'belum-dibayar',
      buyerUid: 'user-1',
    });
    expect(built.stockUpdates).toEqual([{ listing, qty: 2, isFlash: false }]);
  });

  it('memakai harga flash selama stok flash tersedia', () => {
    const flash = makeListing({
      id: 'listing-2',
      price: 500_000,
      flashSale: true,
      flashPrice: 400_000,
      flashStock: 3,
    });
    const built = build({
      items: [{ listingId: 'listing-2', qty: 3 }],
      listings: listingMap(flash),
    });
    expect(built.order.items[0]).toMatchObject({ price: 400_000, isFlash: true });
    expect(built.order.subtotal).toBe(1_200_000);
  });

  it('menolak voucher yang belum diklaim atau belum memenuhi minimal belanja', () => {
    expectOrderError(() => build({ voucherCode: 'UJI10' }), 403);
    expectOrderError(
      () =>
        build({
          items: [{ listingId: 'listing-1', qty: 1 }],
          voucherCode: 'UJI10',
          claimedVoucherCodes: ['UJI10'],
          vouchers: [makeVoucher({ code: 'UJI10', minSpend: 500_000 })],
        }),
      400,
    );
  });

  it('menolak produk yang hilang dan stok yang tidak cukup, termasuk item duplikat', () => {
    expectOrderError(() => build({ listings: listingMap() }), 400);
    expectOrderError(() => build({ items: [{ listingId: 'listing-1', qty: 6 }] }), 409);
    expectOrderError(
      () =>
        build({
          items: [
            { listingId: 'listing-1', qty: 3 },
            { listingId: 'listing-1', qty: 3 },
          ],
        }),
      409,
    );
  });
});

describe('parseImportOrders', () => {
  const legacyOrder = {
    id: 'order-1',
    status: 'belum-dibayar',
    shippingMethod: 'Reguler',
    paymentMethod: 'Transfer Bank BCA',
    createdAt: '2026-11-01T00:00:00.000Z',
    items: [{ listingId: 'listing-1', qty: 1 }],
    recipient: 'Budi',
    phone: '081200000000',
    address: 'Jl. Uji No. 1',
    city: 'Jakarta',
  };

  it('menerima pesanan lama dan memetakan label metode ke ID', () => {
    const [input] = parseImportOrders({ orders: [legacyOrder] });
    expect(input).toMatchObject({
      id: 'order-1',
      shippingMethodId: 'reg',
      paymentMethodId: 'transfer-bca',
      createdAt: '2026-11-01T00:00:00.000Z',
    });
  });

  it('menolak pesanan yang sudah dibayar dan daftar kosong', () => {
    expectOrderError(
      () => parseImportOrders({ orders: [{ ...legacyOrder, status: 'dikemas' }] }),
      400,
    );
    expectOrderError(() => parseImportOrders({ orders: [] }), 400);
  });
});
