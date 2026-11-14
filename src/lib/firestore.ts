import { loadFirebase } from '../firebase';
import type { Firestore } from 'firebase/firestore';
import type { AccountData, AuditLogEntry, Inquiry, Listing, Order, ProductReview, SharedPlatform } from '../types';
import { normalizeAuditEntry } from './audit-log';
import { uploadListingImages, uploadOrderImages } from './storage';
import { importOrdersOnServer } from './orders-api';

/**
 * Mode data Firestore. Aktifkan lewat `.env`:
 *   VITE_DATA_BACKEND=firestore
 *
 * Saat nonaktif, aplikasi tetap memakai localStorage seperti sebelumnya.
 */
export const firestoreEnabled = import.meta.env.VITE_DATA_BACKEND === 'firestore';

type Unsubscribe = () => void;

async function getDb(): Promise<Firestore | null> {
  if (!firestoreEnabled) return null;
  const bundle = await loadFirebase();
  return bundle?.db ?? null;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) output[key] = stripUndefined(item);
    }
    return output as T;
  }
  return value;
}

function isDataUrl(value: string | undefined): boolean {
  return Boolean(value && value.startsWith('data:'));
}

function safeImageUrl(value: string | undefined): string {
  return value && !isDataUrl(value) ? value : '';
}

function listingPayload(listing: Listing): Record<string, unknown> {
  return stripUndefined({
    ...listing,
    imageUrl: safeImageUrl(listing.imageUrl),
    images: (listing.images ?? []).map(safeImageUrl).filter(Boolean),
  }) as Record<string, unknown>;
}

function accountPayload(account: AccountData): Record<string, unknown> {
  return stripUndefined({
    role: account.role,
    seller: account.seller,
    profile: account.profile,
    cart: account.cart,
    addresses: account.addresses,
    claimedVoucherCodes: account.claimedVoucherCodes,
    favorites: account.favorites,
    updatedAt: new Date().toISOString(),
  }) as Record<string, unknown>;
}

function listingFromDoc(id: string, data: Record<string, unknown>): Listing {
  return { ...(data as unknown as Listing), id };
}

function accountFromDoc(data: Record<string, unknown>): Partial<AccountData> {
  return data as Partial<AccountData>;
}

/** Pantau katalog Firestore secara real-time (maksimal 200 dokumen). */
export async function subscribeListings(
  onData: (listings: Listing[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query } = await import('firebase/firestore');
  const q = query(collection(database, 'listings'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => listingFromDoc(item.id, item.data() as Record<string, unknown>)),
      );
    },
    (error) => onError?.(error),
  );
}

/** Simpan listing ke Firestore. Foto data URL diunggah lebih dulu ke Storage. */
export async function saveListing(listing: Listing): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const prepared = await uploadListingImages(listing);
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(database, 'listings', listing.id),
    { ...listingPayload(prepared), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteListing(id: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(database, 'listings', id));
}

/** Pantau dokumen akun milik pengguna yang sedang masuk. */
export async function subscribeAccount(
  uid: string,
  onData: (account: Partial<AccountData> | null, hasPendingWrites: boolean) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { doc, onSnapshot } = await import('firebase/firestore');
  return onSnapshot(
    doc(database, 'users', uid),
    (snapshot) => {
      onData(
        snapshot.exists() ? accountFromDoc(snapshot.data() as Record<string, unknown>) : null,
        snapshot.metadata.hasPendingWrites,
      );
    },
    (error) => onError?.(error),
  );
}

/** Simpan profil, keranjang, alamat, favorit, dan voucher milik akun. */
export async function saveAccount(uid: string, account: AccountData): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(database, 'users', uid), accountPayload(account), { merge: true });
}

/** Ambil akun sekali saja, dipakai saat login/migrasi. */
export async function loadAccount(uid: string): Promise<Partial<AccountData> | null> {
  const database = await getDb();
  if (!database) return null;

  const { doc, getDoc } = await import('firebase/firestore');
  const snapshot = await getDoc(doc(database, 'users', uid));
  return snapshot.exists() ? accountFromDoc(snapshot.data() as Record<string, unknown>) : null;
}

/* --------------------------------- Pesan ---------------------------------- */

function inquiryPayload(inquiry: Inquiry): Record<string, unknown> {
  return stripUndefined({ ...inquiry }) as unknown as Record<string, unknown>;
}

/** Simpan pesan baru ke koleksi top-level `inquiries`. */
export async function saveInquiry(inquiry: Inquiry): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(database, 'inquiries', inquiry.id),
    { ...inquiryPayload(inquiry), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateInquiryRead(id: string, read: boolean): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(database, 'inquiries', id), { read, updatedAt: serverTimestamp() });
}

export async function deleteInquiry(id: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(database, 'inquiries', id));
}

/** Pantau pesan masuk untuk pemilik akun (toUid == uid). */
export async function subscribeInquiries(
  uid: string,
  onData: (inquiries: Inquiry[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query, where } = await import('firebase/firestore');
  const q = query(collection(database, 'inquiries'), where('toUid', '==', uid), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({ ...(item.data() as Inquiry), id: item.id })));
    },
    (error) => onError?.(error),
  );
}

/* ------------------------------- Pengaturan ------------------------------- */

/** Pengaturan promo dan katalog yang dibaca semua orang, ditulis admin. */
export async function subscribePlatform(
  onData: (platform: SharedPlatform | null) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { doc, onSnapshot } = await import('firebase/firestore');
  return onSnapshot(
    doc(database, 'platform', 'main'),
    (snapshot) => {
      onData(snapshot.exists() ? (snapshot.data() as SharedPlatform) : null);
    },
    (error) => onError?.(error),
  );
}

/** Tulis ulang seluruh pengaturan; dipakai agar penghapusan ikut tersimpan. */
export async function savePlatform(platform: SharedPlatform): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(doc(database, 'platform', 'main'), {
    ...(stripUndefined(platform) as unknown as Record<string, unknown>),
    updatedAt: serverTimestamp(),
  });
}

/* ------------------------------ Log aktivitas ----------------------------- */

/**
 * Tulis satu catatan audit. Dokumen memakai ID yang sudah dibuat klien agar
 * penulisan bersifat create (rules menolak update/delete).
 */
export async function appendAuditLog(entry: AuditLogEntry): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(database, 'auditLogs', entry.id),
    stripUndefined({ ...entry }) as unknown as Record<string, unknown>,
  );
}

/** Pantau catatan audit terbaru; hanya admin yang diizinkan rules. */
export async function subscribeAuditLogs(
  onData: (entries: AuditLogEntry[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, orderBy, query } = await import('firebase/firestore');
  const q = query(collection(database, 'auditLogs'), orderBy('createdAt', 'desc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs
        .map((item) => normalizeAuditEntry({ ...item.data(), id: item.id }))
        .filter((item): item is AuditLogEntry => Boolean(item));
      onData(entries);
    },
    (error) => onError?.(error),
  );
}

/* --------------------------------- Ulasan --------------------------------- */
function reviewPayload(review: ProductReview): Record<string, unknown> {
  return stripUndefined({ ...review }) as unknown as Record<string, unknown>;
}

/** Simpan ulasan ke koleksi `reviews` (pembaca publik, penulis = akun masuk). */
export async function saveReview(review: ProductReview): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(database, 'reviews', review.id),
    { ...reviewPayload(review), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Pantau ulasan publik terbaru (maksimal 500 dokumen). */
export async function subscribeReviews(
  onData: (reviews: ProductReview[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query } = await import('firebase/firestore');
  return onSnapshot(
    query(collection(database, 'reviews'), limit(500)),
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({ ...(item.data() as ProductReview), id: item.id })));
    },
    (error) => onError?.(error),
  );
}

function sellerUidsOf(order: Order): string[] {
  return Array.from(new Set(order.items.map((item) => item.ownerId).filter(Boolean)));
}

function listingIdsOf(order: Order): string[] {
  return Array.from(new Set(order.items.map((item) => item.listingId).filter(Boolean)));
}

function orderPayload(order: Order): Record<string, unknown> {
  return stripUndefined({
    ...order,
    listingIds: listingIdsOf(order),
    items: order.items.map((item) => ({
      ...item,
      imageUrl: safeImageUrl(item.imageUrl),
    })),
    sellerUids: sellerUidsOf(order),
  }) as Record<string, unknown>;
}

export async function saveOrder(order: Order): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const prepared = await uploadOrderImages(order);
  const { doc, serverTimestamp, setDoc } = await import('firebase/firestore');
  await setDoc(
    doc(database, 'orders', order.id),
    { ...orderPayload(prepared), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore');
  const payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
  if (status === 'dikemas') payload.paidAt = new Date().toISOString();
  if (status === 'selesai') payload.completedAt = new Date().toISOString();
  await updateDoc(doc(database, 'orders', orderId), payload);
}

/** True bila uid punya dokumen di koleksi `admins`. */
export async function isAdminUser(uid: string): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  const { doc, getDoc } = await import('firebase/firestore');
  const snapshot = await getDoc(doc(database, 'admins', uid));
  return snapshot.exists();
}

/** Semua pesanan untuk admin. Query hanya berhasil bila rules mengizinkan admin. */
export async function subscribeAllOrders(
  onData: (orders: Order[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query } = await import('firebase/firestore');
  return onSnapshot(
    query(collection(database, 'orders'), limit(200)),
    (snapshot) => {
      onData(snapshot.docs.map((item) => ({ ...(item.data() as Order), id: item.id })));
    },
    (error) => onError?.(error),
  );
}

/** Pesanan pembeli. */
export async function subscribeBuyerOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query, where } = await import('firebase/firestore');
  const q = query(
    collection(database, 'orders'),
    where('buyerUid', '==', uid),
    limit(100),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => ({ ...(item.data() as Order), id: item.id })),
      );
    },
    (error) => onError?.(error),
  );
}

/** Pesanan yang memuat produk penjual. */
export async function subscribeSellerOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError?: (error: unknown) => void,
): Promise<Unsubscribe> {
  const database = await getDb();
  if (!database) return () => {};

  const { collection, limit, onSnapshot, query, where } = await import('firebase/firestore');
  const q = query(
    collection(database, 'orders'),
    where('sellerUids', 'array-contains', uid),
    limit(100),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => ({ ...(item.data() as Order), id: item.id })),
      );
    },
    (error) => onError?.(error),
  );
}

/**
 * Unggah pesanan lokal yang belum ada di Firestore. Sejak pembuatan pesanan
 * dipindah ke server, impor juga lewat endpoint server agar total dan stok
 * dihitung ulang, bukan lewat tulisan client yang kini diblokir rules.
 */
export async function migrateOrders(uid: string, orders: Order[]): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  const owned = orders
    .filter((order) => order.buyerUid === uid && order.status === 'belum-dibayar')
    .slice(0, 50);
  if (owned.length === 0) return 0;

  return importOrdersOnServer(owned);
}

/** Unggah listing lokal milik uid yang belum ada di Firestore. */
export async function migrateListings(uid: string, listings: Listing[]): Promise<number> {
  const database = await getDb();
  if (!database) return 0;

  const owned = listings.filter((listing) => listing.ownerId === uid);
  if (owned.length === 0) return 0;

  const { doc, getDoc, serverTimestamp, writeBatch } = await import('firebase/firestore');

  // Lewati listing yang sudah ada di cloud supaya foto tidak diunggah ulang
  // setiap kali pengguna masuk.
  const missing: Listing[] = [];
  for (const listing of owned) {
    const snapshot = await getDoc(doc(database, 'listings', listing.id));
    if (!snapshot.exists()) missing.push(listing);
  }
  if (missing.length === 0) return 0;

  const prepared = await Promise.all(missing.map((listing) => uploadListingImages(listing)));

  for (let start = 0; start < prepared.length; start += 500) {
    const batch = writeBatch(database);
    for (const listing of prepared.slice(start, start + 500)) {
      batch.set(
        doc(database, 'listings', listing.id),
        { ...listingPayload(listing), updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
  }
  return prepared.length;
}
