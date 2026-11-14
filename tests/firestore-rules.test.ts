// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const describeRules = emulatorAvailable ? describe : describe.skip;

const NOW = new Date().toISOString();
const SELLER_ID = 'seller';
const BUYER_ID = 'buyer';
const ADMIN_ID = 'admin';

const listing = (overrides: Record<string, unknown> = {}) => ({
  id: 'listing-1',
  title: 'Rumah Bagus',
  category: 'Rumah',
  purpose: 'Dijual',
  price: 500_000_000,
  location: 'Jakarta Selatan',
  city: 'Jakarta',
  bedrooms: 3,
  bathrooms: 2,
  landArea: 120,
  buildingArea: 100,
  description: 'Rumah nyaman dekat pusat kota.',
  features: ['Garasi'],
  imageUrl: 'https://example.com/rumah.jpg',
  images: [],
  ownerId: SELLER_ID,
  ownerName: 'Penjual',
  contactPhone: '08123456789',
  createdAt: NOW,
  ...overrides,
});

const account = (overrides: Record<string, unknown> = {}) => ({
  role: 'buyer',
  profile: { name: 'Pembeli', email: 'buyer@example.com', phone: '0812' },
  cart: [],
  addresses: [],
  claimedVoucherCodes: [],
  favorites: [],
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  code: 'ORD-1',
  items: [
    {
      listingId: 'listing-1',
      title: 'Rumah Bagus',
      imageUrl: '',
      price: 100,
      qty: 1,
      ownerId: SELLER_ID,
      ownerName: 'Penjual',
      category: 'Rumah',
    },
  ],
  listingIds: ['listing-1'],
  subtotal: 100,
  discount: 0,
  shipping: 0,
  cashback: 0,
  total: 100,
  status: 'belum-dibayar',
  recipient: 'Pembeli',
  phone: '0812',
  address: 'Jl. Contoh 1',
  city: 'Jakarta',
  shippingMethod: 'Reguler',
  paymentMethod: 'Transfer',
  paymentMethodId: 'cod',
  buyerUid: BUYER_ID,
  buyerName: 'Pembeli',
  sellerUids: [SELLER_ID],
  createdAt: NOW,
  ...overrides,
});

const inquiry = (overrides: Record<string, unknown> = {}) => ({
  id: 'inquiry-1',
  listingId: 'listing-1',
  listingTitle: 'Rumah Bagus',
  name: 'Pembeli',
  phone: '0812',
  message: 'Apakah masih tersedia?',
  createdAt: NOW,
  fromUid: BUYER_ID,
  toUid: SELLER_ID,
  ...overrides,
});

const review = (overrides: Record<string, unknown> = {}) => ({
  id: 'review-1',
  listingId: 'listing-1',
  orderId: 'order-1',
  name: 'Pembeli',
  rating: 5,
  comment: 'Rumahnya bagus.',
  createdAt: NOW,
  authorUid: BUYER_ID,
  ...overrides,
});

describeRules('firestore.rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'demo-propertika-rules',
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: Number(new URL(`http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`).port),
      },
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  afterEach(async () => {
    await env.clearFirestore();
  });

  async function seedAdmin() {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`admins/${ADMIN_ID}`).set({ email: 'admin@example.com' });
    });
  }

  async function seed(path: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(path).set(data);
    });
  }

  const asSeller = () => env.authenticatedContext(SELLER_ID).firestore();
  const asBuyer = () => env.authenticatedContext(BUYER_ID).firestore();
  const asAdmin = () => env.authenticatedContext(ADMIN_ID).firestore();
  const asAnon = () => env.unauthenticatedContext().firestore();

  describe('users', () => {
    it('pemilik dapat membuat dan membaca profilnya', async () => {
      await assertSucceeds(asBuyer().doc(`users/${BUYER_ID}`).set(account()));
      await assertSucceeds(asBuyer().doc(`users/${BUYER_ID}`).get());
    });

    it('pengguna lain dan anonim tidak dapat membaca profil', async () => {
      await seed(`users/${BUYER_ID}`, account());
      await assertFails(asSeller().doc(`users/${BUYER_ID}`).get());
      await assertFails(asAnon().doc(`users/${BUYER_ID}`).get());
    });

    it('pengguna lain tidak dapat menulis profil', async () => {
      await seed(`users/${BUYER_ID}`, account());
      await assertFails(asSeller().doc(`users/${BUYER_ID}`).update({ role: 'seller' }));
    });

    it('peran admin tidak dapat dipilih sendiri', async () => {
      await assertFails(asBuyer().doc(`users/${BUYER_ID}`).set(account({ role: 'admin' })));
    });

    it('pemilik boleh menjadi penjual', async () => {
      await assertSucceeds(asBuyer().doc(`users/${BUYER_ID}`).set(account({ role: 'seller' })));
    });

    it('admin dapat membaca dan menulis profil pengguna', async () => {
      await seedAdmin();
      await seed(`users/${BUYER_ID}`, account());
      await assertSucceeds(asAdmin().doc(`users/${BUYER_ID}`).get());
      await assertSucceeds(asAdmin().doc(`users/${BUYER_ID}`).update({ role: 'seller' }));
    });
  });

  describe('listings', () => {
    it('anonim dapat membaca katalog', async () => {
      await seed('listings/listing-1', listing());
      await assertSucceeds(asAnon().doc('listings/listing-1').get());
    });

    it('penjual dapat membuat listing miliknya', async () => {
      await assertSucceeds(asSeller().doc('listings/listing-1').set(listing()));
    });

    it('tidak bisa membuat listing atas nama orang lain', async () => {
      await assertFails(asBuyer().doc('listings/listing-1').set(listing()));
    });

    it('listing tanpa harga atau judul valid ditolak', async () => {
      const withoutPrice: Record<string, unknown> = listing();
      delete withoutPrice.price;
      await assertFails(asSeller().doc('listings/listing-1').set(withoutPrice));
      await assertFails(asSeller().doc('listings/listing-2').set(listing({ title: 'x' })));
    });

    it('anonim tidak dapat membuat listing', async () => {
      await assertFails(asAnon().doc('listings/listing-1').set(listing()));
    });

    it('pemilik dapat memperbarui judul dan harga', async () => {
      await seed('listings/listing-1', listing());
      await assertSucceeds(
        asSeller().doc('listings/listing-1').update({ title: 'Rumah Baru', price: 450_000_000 }),
      );
    });

    it('pemilik tidak dapat memindahkan kepemilikan atau memalsukan rating', async () => {
      await seed('listings/listing-1', listing());
      await assertFails(asSeller().doc('listings/listing-1').update({ ownerId: BUYER_ID }));
      await assertFails(asSeller().doc('listings/listing-1').update({ rating: 5, reviewCount: 99 }));
    });

    it('pengguna lain tidak dapat mengubah atau menghapus listing', async () => {
      await seed('listings/listing-1', listing());
      await assertFails(asBuyer().doc('listings/listing-1').update({ title: 'Diambil alih' }));
      await assertFails(asBuyer().doc('listings/listing-1').delete());
    });

    it('admin dapat mengubah dan menghapus listing', async () => {
      await seedAdmin();
      await seed('listings/listing-1', listing());
      await assertSucceeds(asAdmin().doc('listings/listing-1').update({ title: 'Ditinjau admin' }));
      await assertSucceeds(asAdmin().doc('listings/listing-1').delete());
    });
  });

  describe('inquiries', () => {
    it('pengirim dapat membuat pesan dan membacanya', async () => {
      await assertSucceeds(asBuyer().doc('inquiries/inquiry-1').set(inquiry()));
      await assertSucceeds(asBuyer().doc('inquiries/inquiry-1').get());
    });

    it('tidak bisa mengaku sebagai pengirim lain atau mengirim pesan kosong', async () => {
      await assertFails(asBuyer().doc('inquiries/inquiry-1').set(inquiry({ fromUid: SELLER_ID })));
      await assertFails(asBuyer().doc('inquiries/inquiry-2').set(inquiry({ message: '' })));
    });

    it('penerima dapat membaca dan menandai sudah dibaca', async () => {
      await seed('inquiries/inquiry-1', inquiry());
      await assertSucceeds(asSeller().doc('inquiries/inquiry-1').get());
      await assertSucceeds(asSeller().doc('inquiries/inquiry-1').update({ read: true }));
    });

    it('penerima tidak dapat mengubah isi pesan', async () => {
      await seed('inquiries/inquiry-1', inquiry());
      await assertFails(asSeller().doc('inquiries/inquiry-1').update({ message: 'Diubah' }));
    });

    it('pengirim tidak dapat menandai pesan dibaca', async () => {
      await seed('inquiries/inquiry-1', inquiry());
      await assertFails(asBuyer().doc('inquiries/inquiry-1').update({ read: true }));
    });

    it('pengguna lain dan anonim tidak dapat membaca pesan', async () => {
      await seed('inquiries/inquiry-1', inquiry());
      await assertFails(
        env.authenticatedContext('other').firestore().doc('inquiries/inquiry-1').get(),
      );
      await assertFails(asAnon().doc('inquiries/inquiry-1').get());
    });

    it('pengirim dapat menghapus pesannya, pengguna lain tidak', async () => {
      await seed('inquiries/inquiry-1', inquiry());
      await assertFails(
        env.authenticatedContext('other').firestore().doc('inquiries/inquiry-1').delete(),
      );
      await assertSucceeds(asBuyer().doc('inquiries/inquiry-1').delete());
    });
  });

  describe('orders', () => {
    it('klien tidak dapat membuat pesanan langsung; server memakai Admin SDK', async () => {
      await seedAdmin();
      await assertFails(asBuyer().doc('orders/order-1').set(order()));
      await assertFails(asSeller().doc('orders/order-2').set(order({ buyerUid: SELLER_ID })));
      await assertFails(asAdmin().doc('orders/order-3').set(order()));
    });

    it('hanya pembeli, penjual terkait, dan admin yang dapat membaca', async () => {
      await seedAdmin();
      await seed('orders/order-1', order());
      await assertSucceeds(asBuyer().doc('orders/order-1').get());
      await assertSucceeds(asSeller().doc('orders/order-1').get());
      await assertSucceeds(asAdmin().doc('orders/order-1').get());
      await assertFails(
        env.authenticatedContext('other').firestore().doc('orders/order-1').get(),
      );
      await assertFails(asAnon().doc('orders/order-1').get());
    });

    it('pembeli dapat membatalkan atau menandai dibayar', async () => {
      await seed('orders/order-1', order());
      await assertSucceeds(
        asBuyer().doc('orders/order-1').update({ status: 'dikemas', paidAt: NOW }),
      );
    });

    it('pembeli tidak dapat menandai pesanan online sebagai dibayar', async () => {
      await seed('orders/order-1', order({ paymentMethodId: 'transfer-bca' }));
      await assertFails(
        asBuyer().doc('orders/order-1').update({ status: 'dikemas', paidAt: NOW }),
      );
    });

    it('penjual tidak dapat menandai pesanan online sebagai dibayar', async () => {
      await seed('orders/order-1', order({ paymentMethodId: 'transfer-bca' }));
      await assertFails(asSeller().doc('orders/order-1').update({ status: 'dikemas', paidAt: NOW }));
    });

    it('pembeli tidak dapat menambahkan completedAt saat membayar', async () => {
      await seed('orders/order-1', order());
      await assertFails(
        asBuyer()
          .doc('orders/order-1')
          .update({ status: 'dikemas', paidAt: NOW, completedAt: NOW }),
      );
    });

    it('pembeli menandai selesai hanya dari status dikirim', async () => {
      await seed('orders/order-1', order({ status: 'dikirim' }));
      await assertSucceeds(
        asBuyer().doc('orders/order-1').update({ status: 'selesai', completedAt: NOW }),
      );
      await seed('orders/order-2', order({ id: 'order-2', status: 'dikemas' }));
      await assertFails(
        asBuyer().doc('orders/order-2').update({ status: 'selesai', completedAt: NOW }),
      );
    });

    it('penjual dapat memproses pesanan sesuai alur', async () => {
      await seed('orders/order-1', order({ status: 'dikemas' }));
      await assertSucceeds(asSeller().doc('orders/order-1').update({ status: 'dikirim' }));
    });

    it('penjual tidak dapat melompati status atau mengubah total', async () => {
      await seed('orders/order-1', order({ status: 'dikemas' }));
      await assertFails(asSeller().doc('orders/order-1').update({ status: 'selesai' }));
      await assertFails(asBuyer().doc('orders/order-1').update({ total: 1 }));
    });

    it('anonim juga tidak dapat membuat pesanan', async () => {
      await assertFails(asAnon().doc('orders/order-1').set(order({ buyerUid: 'guest' })));
    });
  });

  describe('reviews', () => {
    it('anonim dapat membaca ulasan', async () => {
      await seed('reviews/review-1', review());
      await assertSucceeds(asAnon().doc('reviews/review-1').get());
    });

    it('penulis dapat membuat dan memperbarui ulasan', async () => {
      await seed('listings/listing-1', listing());
      await seed('orders/order-1', order({ status: 'selesai' }));
      await assertSucceeds(asBuyer().doc('reviews/review-1').set(review()));
      await assertSucceeds(asBuyer().doc('reviews/review-1').update({ rating: 4 }));
    });

    it('ulasan tanpa pesanan selesai atau dari listing yang tidak dibeli ditolak', async () => {
      await seed('listings/listing-1', listing());
      await seed('orders/order-1', order({ status: 'dikemas' }));
      await assertFails(asBuyer().doc('reviews/review-1').set(review()));

      await seed('orders/order-1', order({ status: 'selesai', listingIds: ['listing-lain'] }));
      await assertFails(asBuyer().doc('reviews/review-1').set(review()));

      await seed('orders/order-1', order({ status: 'selesai', buyerUid: 'other' }));
      await assertFails(asBuyer().doc('reviews/review-1').set(review()));
    });

    it('pemilik listing tidak dapat mengulas produknya sendiri', async () => {
      await seed('listings/listing-1', listing());
      await seed('orders/order-1', order({ status: 'selesai', buyerUid: SELLER_ID }));
      await assertFails(
        asSeller().doc('reviews/review-1').set(review({ authorUid: SELLER_ID })),
      );
    });

    it('ulasan palsu atau rating di luar 1-5 ditolak', async () => {
      await assertFails(asBuyer().doc('reviews/review-1').set(review({ authorUid: SELLER_ID })));
      await assertFails(asBuyer().doc('reviews/review-2').set(review({ rating: 6 })));
      await assertFails(
        asBuyer().doc('reviews/review-3').set(review({ comment: 'x'.repeat(1001) })),
      );
    });

    it('penulis tidak dapat memindahkan ulasan ke listing lain', async () => {
      await seed('reviews/review-1', review());
      await assertFails(
        asBuyer().doc('reviews/review-1').update({ listingId: 'listing-2' }),
      );
    });

    it('pengguna lain tidak dapat mengubah atau menghapus ulasan', async () => {
      await seed('reviews/review-1', review());
      await assertFails(asSeller().doc('reviews/review-1').update({ rating: 1 }));
      await assertFails(asSeller().doc('reviews/review-1').delete());
    });

    it('admin dapat menghapus ulasan', async () => {
      await seedAdmin();
      await seed('reviews/review-1', review());
      await assertSucceeds(asAdmin().doc('reviews/review-1').delete());
    });
  });

  describe('admin, platform, dan koleksi tertutup', () => {
    it('pengguna biasa tidak dapat menulis dokumen admin', async () => {
      await assertFails(asBuyer().doc(`admins/${BUYER_ID}`).set({ email: 'x@example.com' }));
    });

    it('admin dapat menulis dokumen admin', async () => {
      await seedAdmin();
      await assertSucceeds(
        asAdmin().doc('admins/second-admin').set({ email: 'second@example.com' }),
      );
    });

    it('platform dapat dibaca publik tetapi hanya ditulis admin', async () => {
      await seed('platform/main', { vouchers: [] });
      await assertSucceeds(asAnon().doc('platform/main').get());
      await assertFails(asBuyer().doc('platform/main').update({ vouchers: [] }));
      await seedAdmin();
      await assertSucceeds(asAdmin().doc('platform/main').update({ vouchers: [] }));
    });

    it('koleksi aiUsage hanya untuk Admin SDK', async () => {
      await assertFails(asBuyer().doc('aiUsage/some-uid').get());
      await assertFails(asBuyer().doc('aiUsage/some-uid').set({ count: 1 }));
    });

    it('koleksi tak dikenal ditolak', async () => {
      await assertFails(asBuyer().doc('unknown/doc-1').set({ hello: 'world' }));
    });
  });
});