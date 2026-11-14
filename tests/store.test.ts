import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Inquiry } from '../src/types';
import { makeListing } from './helpers';

vi.mock('../src/lib/firestore', () => ({
  firestoreEnabled: false,
  deleteInquiry: vi.fn(async () => {}),
  deleteListing: vi.fn(async () => {}),
  isAdminUser: vi.fn(async () => false),
  migrateListings: vi.fn(async () => 0),
  migrateOrders: vi.fn(async () => 0),
  saveAccount: vi.fn(async () => {}),
  saveInquiry: vi.fn(async () => {}),
  saveListing: vi.fn(async () => {}),
  saveOrder: vi.fn(async () => {}),
  savePlatform: vi.fn(async () => {}),
  saveReview: vi.fn(async () => {}),
  subscribeAccount: vi.fn(() => () => {}),
  subscribeAllOrders: vi.fn(() => () => {}),
  subscribeBuyerOrders: vi.fn(() => () => {}),
  subscribeInquiries: vi.fn(() => () => {}),
  subscribeListings: vi.fn(() => () => {}),
  subscribePlatform: vi.fn(() => () => {}),
  subscribeReviews: vi.fn(() => () => {}),
  subscribeSellerOrders: vi.fn(() => () => {}),
  updateInquiryRead: vi.fn(async () => {}),
  updateOrderStatus: vi.fn(async () => {}),
}));

const USER = { uid: 'user-1', email: 'budi@example.com', displayName: 'Budi' };

const ADDRESS: Address = {
  id: 'addr-1',
  label: 'Rumah',
  recipient: 'Budi',
  phone: '081200000000',
  detail: 'Jl. Uji No. 1',
  city: 'Jakarta Selatan',
  isDefault: true,
};

async function loadStore() {
  const module = await import('../src/lib/store');
  return module.store;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

describe('keranjang tamu', () => {
  it('menambahkan produk dan menyimpannya ke localStorage', async () => {
    const store = await loadStore();
    const lineId = store.addToCart('seed-7', 2);
    expect(lineId).toBe('seed-7');

    const view = store.getSnapshot();
    expect(view.cart).toHaveLength(1);
    expect(view.cart[0]).toMatchObject({ listingId: 'seed-7', qty: 2, selected: true });
    expect(view.cartCount).toBe(2);
    expect(window.localStorage.getItem('propertika:v1')).toContain('seed-7');
  });

  it('membatasi jumlah sesuai stok dan menggabungkan baris yang sama', async () => {
    const store = await loadStore();
    store.addToCart('seed-4', 5);
    expect(store.getSnapshot().cart[0].qty).toBe(2);
    store.addToCart('seed-4', 5);
    expect(store.getSnapshot().cart[0].qty).toBe(2);
  });

  it('memisahkan baris berdasarkan varian', async () => {
    const store = await loadStore();
    expect(store.addToCart('seed-7', 1, 'Natural')).toBe('seed-7::Natural');
    expect(store.addToCart('seed-7', 1, 'Abu')).toBe('seed-7::Abu');
    expect(store.getSnapshot().cart).toHaveLength(2);
  });

  it('menolak produk yang tidak ada', async () => {
    const store = await loadStore();
    expect(store.addToCart('tidak-ada')).toBeNull();
    expect(store.getSnapshot().toast).toMatchObject({ tone: 'error' });
  });

  it('mengubah jumlah, memilih, dan menghapus baris', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 2);
    store.updateCartQty('seed-7', 100);
    expect(store.getSnapshot().cart[0].qty).toBe(6);
    store.updateCartQty('seed-7', 0);
    expect(store.getSnapshot().cart[0].qty).toBe(1);

    store.toggleAllCart(false);
    expect(store.getSnapshot().cart[0].selected).toBe(false);
    store.selectOnlyCartLine('seed-7');
    expect(store.getSnapshot().cart[0].selected).toBe(true);

    store.toggleCartItem('seed-7');
    expect(store.getSnapshot().cart[0].selected).toBe(false);
    store.removeSelectedCartItems();
    expect(store.getSnapshot().cart).toHaveLength(1);

    store.removeCartItem('seed-7');
    expect(store.getSnapshot().cart).toHaveLength(0);
  });

  it('mempertahankan keranjang setelah modul dimuat ulang', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 3);

    vi.resetModules();
    const { store: reloaded } = await import('../src/lib/store');
    expect(reloaded.getSnapshot().cart[0]).toMatchObject({ listingId: 'seed-7', qty: 3 });
  });
});

describe('akun dan favorit', () => {
  it('mewajibkan masuk untuk menyimpan favorit', async () => {
    const store = await loadStore();
    store.toggleFavorite('seed-1');
    expect(store.getSnapshot().favorites).toEqual([]);
    expect(store.getSnapshot().toast).toMatchObject({ tone: 'info' });
  });

  it('memindahkan keranjang tamu ke akun saat masuk', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 2);
    store.claimVoucher('HEMAT10');
    store.setActiveUser(USER);

    const view = store.getSnapshot();
    expect(view.isSignedIn).toBe(true);
    expect(view.uid).toBe(USER.uid);
    expect(view.cart[0]).toMatchObject({ listingId: 'seed-7', qty: 2 });
    expect(view.claimedVoucherCodes).toContain('HEMAT10');

    store.toggleFavorite('seed-1');
    expect(store.getSnapshot().favorites).toEqual(['seed-1']);

    store.setActiveUser(null);
    expect(store.getSnapshot().isSignedIn).toBe(false);
    expect(store.getSnapshot().favorites).toEqual([]);
  });
});

describe('alamat', () => {
  it('menjadikan alamat pertama sebagai utama dan mempromosikan sisanya', async () => {
    const store = await loadStore();
    store.saveAddress(ADDRESS);
    expect(store.getSnapshot().addresses[0].isDefault).toBe(true);

    const second: Address = { ...ADDRESS, id: 'addr-2', label: 'Kantor', isDefault: false };
    store.saveAddress(second);
    expect(store.getSnapshot().addresses).toHaveLength(2);
    expect(store.getSnapshot().addresses.find((item) => item.id === 'addr-2')?.isDefault).toBe(false);

    store.setDefaultAddress('addr-2');
    expect(store.getSnapshot().addresses.find((item) => item.id === 'addr-2')?.isDefault).toBe(true);

    store.removeAddress('addr-2');
    expect(store.getSnapshot().addresses).toEqual([{ ...ADDRESS, isDefault: true }]);
  });
});

describe('checkout', () => {
  it('menolak checkout dengan keranjang kosong', async () => {
    const store = await loadStore();
    const result = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'transfer-bca',
    });
    expect(result).toMatchObject({ ok: false });
  });

  it('membuat pesanan tamu, mengurangi stok, dan mengosongkan keranjang', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 1);

    const result = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'transfer-bca',
      note: '  Titip di pos  ',
    });
    expect(result.ok).toBe(true);

    const view = store.getSnapshot();
    expect(view.cart).toHaveLength(0);
    expect(view.orders).toHaveLength(1);
    expect(view.orders[0]).toMatchObject({
      status: 'belum-dibayar',
      subtotal: 3_790_000,
      discount: 0,
      shipping: 12_000,
      total: 3_802_000,
      shippingMethod: 'Reguler',
      paymentMethod: 'Transfer Bank BCA',
      note: 'Titip di pos',
      buyerName: 'Budi',
    });

    const listing = view.listings.find((item) => item.id === 'seed-7');
    expect(listing?.stock).toBe(11);
    expect(listing?.flashStock).toBe(5);
    expect(listing?.sold).toBe(185);
  });

  it('memakai voucher yang sudah diklaim', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 1);
    store.claimVoucher('HEMAT10');

    const result = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'qris',
      voucherCode: 'hemat10',
    });
    expect(result.ok).toBe(true);

    const order = store.getSnapshot().orders[0];
    expect(order).toMatchObject({
      discount: 150_000,
      shipping: 12_000,
      total: 3_652_000,
      voucherCode: 'HEMAT10',
      paymentMethod: 'QRIS',
    });
  });

  it('menolak voucher yang belum diklaim atau belum memenuhi minimal belanja', async () => {
    const store = await loadStore();
    store.addToCart('seed-10', 1);

    const belumKlaim = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'ewallet',
      voucherCode: 'NEWUSER',
    });
    expect(belumKlaim.error).toContain('Klaim voucher');

    store.claimVoucher('JEPARA50');
    const belumCukup = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'ewallet',
      voucherCode: 'JEPARA50',
    });
    expect(belumCukup.error).toContain('tidak berlaku');
  });

  it('mengembalikan stok saat pesanan dibatalkan satu kali', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 2);
    const result = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'cod',
    });

    const orderId = result.orderId;
    expect(orderId).toBeTruthy();
    store.cancelOrder(orderId!);

    let view = store.getSnapshot();
    expect(view.orders[0].status).toBe('dibatalkan');
    expect(view.listings.find((item) => item.id === 'seed-7')?.stock).toBe(12);
    expect(view.listings.find((item) => item.id === 'seed-7')?.flashStock).toBe(6);
    expect(view.listings.find((item) => item.id === 'seed-7')?.sold).toBe(184);

    store.cancelOrder(orderId!);
    view = store.getSnapshot();
    expect(view.listings.find((item) => item.id === 'seed-7')?.stock).toBe(12);
    expect(view.listings.find((item) => item.id === 'seed-7')?.flashStock).toBe(6);
    expect(view.listings.find((item) => item.id === 'seed-7')?.sold).toBe(184);
  });
});

describe('status pesanan', () => {
  it('mengubah status pesanan mengikuti alur pembayaran dan penyelesaian', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 1);
    const { orderId } = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'yes',
      paymentMethodId: 'transfer-mandiri',
    });

    store.payOrder(orderId!);
    let order = store.getSnapshot().orders[0];
    expect(order.status).toBe('dikemas');
    expect(order.paidAt).toBeTruthy();

    store.updateOrderStatus(orderId!, 'dikirim');
    expect(store.getSnapshot().orders[0].status).toBe('dikirim');

    store.confirmOrderReceived(orderId!);
    order = store.getSnapshot().orders[0];
    expect(order.status).toBe('selesai');
    expect(order.completedAt).toBeTruthy();
  });
});

describe('listing penjual', () => {
  it('hanya mengizinkan akun penjual memasang listing', async () => {
    const store = await loadStore();
    store.setActiveUser(USER);

    const listing = makeListing({ id: 'mine-1', ownerId: USER.uid, ownerName: USER.displayName });
    store.upsertListing(listing);
    expect(store.getSnapshot().listings.some((item) => item.id === 'mine-1')).toBe(false);
    expect(store.getSnapshot().toast).toMatchObject({ tone: 'error' });

    store.saveSellerRegistration({
      businessName: 'Toko Budi',
      sellerType: 'Perorangan',
      phone: '081200000000',
      city: 'Jakarta',
      address: 'Jl. Uji',
      npwp: '',
      description: '',
    });
    expect(store.getSnapshot().role).toBe('seller');

    store.upsertListing(listing);
    expect(store.getSnapshot().listings.some((item) => item.id === 'mine-1')).toBe(true);

    store.removeListing('mine-1');
    expect(store.getSnapshot().listings.some((item) => item.id === 'mine-1')).toBe(false);
  });
});

describe('pesan masuk', () => {
  const inquiry: Inquiry = {
    id: 'inq-1',
    listingId: 'seed-1',
    listingTitle: 'Rumah Modern Minimalis di Bintaro',
    name: 'Budi',
    phone: '081200000000',
    message: 'Apakah masih tersedia?',
    createdAt: '2026-11-12T00:00:00.000Z',
  };

  it('menambah, menandai dibaca, dan menghapus pesan', async () => {
    const store = await loadStore();
    store.setActiveUser(USER);

    store.addInquiry(inquiry, USER.uid, false);
    expect(store.getSnapshot().inquiries).toHaveLength(1);
    expect(store.getSnapshot().unreadInquiriesCount).toBe(1);

    store.markInquiryAsRead('inq-1');
    expect(store.getSnapshot().unreadInquiriesCount).toBe(0);

    store.removeInquiry('inq-1');
    expect(store.getSnapshot().inquiries).toHaveLength(0);
  });
});

describe('ulasan', () => {
  it('hanya menyimpan ulasan dari pesanan selesai dan membatasi rating 1 sampai 5', async () => {
    const store = await loadStore();
    store.addToCart('seed-7', 1);
    const { orderId } = await store.checkout({
      address: ADDRESS,
      shippingMethodId: 'reg',
      paymentMethodId: 'transfer-bca',
    });
    expect(orderId).toBeTruthy();

    expect(await store.addReview('order-palsu', 'seed-7', 5, 'Palsu')).toBe(false);
    expect(await store.addReview(orderId!, 'seed-7', 5, 'Belum selesai')).toBe(false);

    store.payOrder(orderId!);
    store.updateOrderStatus(orderId!, 'dikirim');
    store.confirmOrderReceived(orderId!);

    const before = store.getSnapshot().reviews.length;
    expect(await store.addReview(orderId!, 'seed-7', 9, '  Sangat bagus  ')).toBe(true);
    expect(await store.addReview(orderId!, 'seed-7', 0, 'Kurang')).toBe(true);

    const view = store.getSnapshot();
    expect(view.reviews).toHaveLength(before + 1);
    const review = view.reviews.find((item) => item.orderId === orderId);
    expect(review).toMatchObject({
      listingId: 'seed-7',
      rating: 1,
      comment: 'Kurang',
    });
  });
});