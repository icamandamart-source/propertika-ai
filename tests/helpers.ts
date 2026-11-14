import type { Listing, Voucher } from '../src/types';

export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    title: 'Rumah Uji',
    category: 'Rumah',
    purpose: 'Dijual',
    price: 1_000_000,
    location: 'Jakarta',
    city: 'Jakarta',
    bedrooms: 3,
    bathrooms: 2,
    landArea: 120,
    buildingArea: 90,
    description: 'Listing untuk pengujian.',
    features: [],
    imageUrl: '',
    ownerId: 'owner-1',
    ownerName: 'Penjual Uji',
    contactPhone: '081200000000',
    createdAt: '2026-01-01T00:00:00.000Z',
    stock: 10,
    ...overrides,
  };
}

export function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 'voucher-1',
    code: 'UJI10',
    title: 'Voucher Uji',
    type: 'diskon',
    amount: 0,
    percent: 10,
    maxDiscount: 50_000,
    minSpend: 100_000,
    description: '',
    expiry: '2099-12-31',
    ...overrides,
  };
}