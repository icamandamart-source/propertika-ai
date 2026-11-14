import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  cartTotals,
  discountPercent,
  effectivePrice,
  formatSold,
  getStoreNames,
  hydrateCart,
  isFlashAvailable,
  isVoucherExpired,
  mergeCarts,
  originalPriceOf,
  shippingCost,
  stockOf,
  storeNameOf,
  unique,
  voucherEligible,
} from '../src/lib/marketplace';
import type { CartItem } from '../src/types';
import { makeListing, makeVoucher } from './helpers';

describe('harga listing', () => {
  it('memakai harga flash sale hanya saat flash masih tersedia', () => {
    const listing = makeListing({ flashSale: true, flashPrice: 750_000, flashStock: 2 });
    expect(isFlashAvailable(listing)).toBe(true);
    expect(effectivePrice(listing)).toBe(750_000);

    expect(isFlashAvailable(makeListing({ flashSale: true, flashPrice: 0 }))).toBe(false);
    expect(isFlashAvailable(makeListing({ flashSale: true, flashPrice: 750_000, flashStock: 0 }))).toBe(false);
    expect(effectivePrice(makeListing({ flashSale: true, flashPrice: 750_000, flashStock: 0 }))).toBe(1_000_000);
  });

  it('menghitung harga asli dan persentase diskon', () => {
    const listing = makeListing({ price: 800_000, originalPrice: 1_000_000 });
    expect(originalPriceOf(listing)).toBe(1_000_000);
    expect(discountPercent(listing)).toBe(20);

    const flash = makeListing({ price: 1_000_000, flashSale: true, flashPrice: 750_000, flashStock: 1 });
    expect(originalPriceOf(flash)).toBe(1_000_000);
    expect(discountPercent(flash)).toBe(25);

    expect(originalPriceOf(makeListing())).toBeNull();
    expect(discountPercent(makeListing())).toBe(0);
  });

  it('membatasi persentase diskon pada 0 sampai 100', () => {
    const listing = makeListing({ price: 100_000, originalPrice: 100_000 });
    expect(discountPercent(listing)).toBe(0);
  });
});

describe('stok dan toko', () => {
  it('memilih stok flash sale lebih dulu, lalu stok biasa, lalu 99', () => {
    expect(stockOf(makeListing({ stock: 5 }))).toBe(5);
    expect(stockOf(makeListing({ flashSale: true, flashPrice: 900_000, flashStock: 2, stock: 5 }))).toBe(2);
    expect(stockOf(makeListing({ stock: undefined }))).toBe(99);
    expect(stockOf(makeListing({ flashSale: true, flashPrice: 900_000, flashStock: undefined, stock: 7 }))).toBe(7);
  });

  it('memakai nama toko, lalu nama pemilik, lalu nama bawaan', () => {
    expect(storeNameOf(makeListing({ storeName: ' Toko A ' }))).toBe('Toko A');
    expect(storeNameOf(makeListing({ storeName: '', ownerName: 'Budi' }))).toBe('Budi');
    expect(storeNameOf(makeListing({ storeName: '', ownerName: '' }))).toBe('Toko Propertika');
  });

  it('mengambil daftar nama toko unik dan terurut', () => {
    const listings = [
      makeListing({ id: 'a', storeName: 'Zeta' }),
      makeListing({ id: 'b', storeName: 'Alpha' }),
      makeListing({ id: 'c', storeName: 'Zeta' }),
    ];
    expect(getStoreNames(listings)).toEqual(['Alpha', 'Zeta']);
    expect(unique(['x', 'y', 'x'])).toEqual(['x', 'y']);
  });

  it('meringkas jumlah terjual', () => {
    expect(formatSold(0)).toBe('Belum terjual');
    expect(formatSold(12)).toBe('12 terjual');
    expect(formatSold(1_500)).toBe('1,5 rb terjual');
    expect(formatSold(2_000)).toBe('2 rb terjual');
    expect(formatSold(1_200_000)).toBe('1,2 jt terjual');
  });
});

describe('voucher', () => {
  it('mendeteksi voucher kedaluwarsa dan tanggal tidak valid', () => {
    expect(isVoucherExpired(makeVoucher({ expiry: '2020-01-01' }), new Date('2026-01-01'))).toBe(true);
    expect(isVoucherExpired(makeVoucher({ expiry: '2026-12-31' }), new Date('2026-01-01'))).toBe(false);
    expect(isVoucherExpired(makeVoucher({ expiry: 'bukan-tanggal' }))).toBe(false);
  });

  it('memeriksa minimal belanja', () => {
    const voucher = makeVoucher({ minSpend: 500_000 });
    expect(voucherEligible(voucher, 500_000)).toBe(true);
    expect(voucherEligible(voucher, 499_999)).toBe(false);
    expect(voucherEligible(makeVoucher({ expiry: '2020-01-01', minSpend: 0 }), 1_000_000)).toBe(false);
  });
});

describe('ongkos kirim dan total checkout', () => {
  it('membebaskan ongkir reguler untuk belanja minimal 5 juta', () => {
    expect(shippingCost('reg', 5_000_000)).toBe(0);
    expect(shippingCost('reg', 4_999_999)).toBe(12_000);
    expect(shippingCost('yes', 6_000_000)).toBe(22_000);
    expect(shippingCost('instant', 10_000_000)).toBe(30_000);
    expect(shippingCost('cargo', 10_000_000)).toBe(45_000);
    expect(shippingCost('tidak-dikenal', 1_000_000)).toBe(12_000);
  });

  it('menghitung total tanpa voucher', () => {
    expect(calculateTotals(1_000_000, 'reg', null)).toEqual({
      subtotal: 1_000_000,
      discount: 0,
      shipping: 12_000,
      cashback: 0,
      total: 1_012_000,
    });
  });

  it('membatasi diskon persen dengan maxDiscount', () => {
    const totals = calculateTotals(1_000_000, 'reg', makeVoucher({ percent: 10, maxDiscount: 50_000 }));
    expect(totals.discount).toBe(50_000);
    expect(totals.total).toBe(962_000);
  });

  it('membatasi diskon nominal agar tidak melebihi subtotal', () => {
    const totals = calculateTotals(80_000, 'reg', makeVoucher({ type: 'diskon', amount: 100_000, percent: undefined, minSpend: 0 }));
    expect(totals.discount).toBe(80_000);
    expect(totals.total).toBe(12_000);
  });

  it('memotong ongkir tanpa membuatnya negatif', () => {
    const gratis = calculateTotals(1_000_000, 'reg', makeVoucher({ type: 'ongkir', amount: 25_000 }));
    expect(gratis.shipping).toBe(0);

    const sisa = calculateTotals(1_000_000, 'yes', makeVoucher({ type: 'ongkir', amount: 10_000 }));
    expect(sisa.shipping).toBe(12_000);
  });

  it('menambahkan cashback tanpa mengubah total', () => {
    const totals = calculateTotals(1_000_000, 'reg', makeVoucher({ type: 'cashback', percent: 5, maxDiscount: 30_000 }));
    expect(totals.cashback).toBe(30_000);
    expect(totals.total).toBe(1_012_000);
  });

  it('mengabaikan voucher yang belum memenuhi syarat', () => {
    const totals = calculateTotals(100_000, 'reg', makeVoucher({ minSpend: 500_000 }));
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(112_000);
  });
});

describe('keranjang', () => {
  const listing = makeListing({ id: 'a', price: 100_000 });
  const cart: CartItem[] = [
    { id: 'a', listingId: 'a', qty: 2, selected: true, addedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', listingId: 'b', qty: 1, selected: false, addedAt: '2026-01-01T00:00:00.000Z' },
  ];

  it('menghubungkan keranjang dengan listing dan menghitung total per baris', () => {
    const lines = hydrateCart(cart, [listing]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ listingId: 'a', unitPrice: 100_000, lineTotal: 200_000 });
  });

  it('menjumlahkan hanya baris yang dipilih', () => {
    const lines = hydrateCart(cart, [listing]);
    expect(cartTotals(lines)).toEqual({ count: 2, subtotal: 200_000 });
    expect(cartTotals(hydrateCart([cart[1]], [makeListing({ id: 'b', price: 50_000 })]))).toEqual({
      count: 0,
      subtotal: 0,
    });
  });

  it('menggabungkan baris keranjang dengan id yang sama', () => {
    const merged = mergeCarts(
      [{ id: 'a', listingId: 'a', qty: 2, selected: false, addedAt: '2026-01-01T00:00:00.000Z' }],
      [{ id: 'a', listingId: 'a', qty: 3, selected: true, addedAt: '2026-01-02T00:00:00.000Z' }],
    );
    expect(merged).toEqual([
      { id: 'a', listingId: 'a', qty: 5, selected: true, addedAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });
});