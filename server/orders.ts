import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase-admin/firestore';
import type { AdminServices } from './admin.ts';
import { SEED_LISTINGS } from '../src/data/seed.ts';
import { SEED_VOUCHERS } from '../src/data/promos.ts';
import type { Listing, Order, Voucher } from '../src/types.ts';
import {
  OrderError,
  buildOrder,
  parseCreateOrderInput,
  parseImportOrders,
  type BuiltOrder,
  type CreateOrderInput,
  type ImportOrderInput,
} from './order-core.ts';

const seedListings = new Map(SEED_LISTINGS.map((listing) => [listing.id, listing]));

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

function isVoucher(value: unknown): value is Voucher {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === 'string' && typeof record.type === 'string' && typeof record.minSpend === 'number';
}

function platformVouchers(snapshot: DocumentSnapshot): Voucher[] {
  const raw = snapshot.data()?.vouchers;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isVoucher);
}

function applyOverride(listing: Listing, overrides: Record<string, unknown>): Listing {
  const override = overrides[listing.id];
  if (!override || typeof override !== 'object' || Array.isArray(override)) return listing;
  return { ...listing, ...(override as Partial<Listing>) };
}

function listingFromDoc(id: string, data: DocumentData | undefined): Listing | null {
  if (!data) return null;
  if (typeof data.title !== 'string' || typeof data.price !== 'number') return null;
  return { ...(data as unknown as Listing), id };
}

function buyerFromUser(snapshot: DocumentSnapshot, fallback: string): { name: string; claimed: string[] } {
  const data = snapshot.data() ?? {};
  const profile = data.profile && typeof data.profile === 'object' ? (data.profile as Record<string, unknown>) : {};
  const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : fallback;
  const claimed = Array.isArray(data.claimedVoucherCodes)
    ? data.claimedVoucherCodes.filter((code: unknown): code is string => typeof code === 'string')
    : [];
  return { name, claimed };
}

function orderPayload(built: BuiltOrder): Record<string, unknown> {
  const sellerUids = Array.from(
    new Set(built.order.items.map((item) => item.ownerId).filter(Boolean)),
  );
  return stripUndefined({
    ...built.order,
    sellerUids,
    updatedAt: FieldValue.serverTimestamp(),
  }) as Record<string, unknown>;
}

interface WritePlan {
  cloudRef: DocumentReference;
  cloudData: Record<string, unknown>;
}

async function runOrderTransaction(
  admin: AdminServices,
  uid: string,
  input: CreateOrderInput,
  meta?: { id: string; code?: string; createdAt: string },
): Promise<Order | null> {
  const db: Firestore = admin.db;
  const userRef = db.doc(`users/${uid}`);
  const platformRef = db.doc('platform/main');
  const orderRef = meta ? db.doc(`orders/${meta.id}`) : db.collection('orders').doc();
  const listingIds = Array.from(new Set(input.items.map((item) => item.listingId)));

  return db.runTransaction(async (transaction) => {
    const listingRefs = listingIds.map((id) => db.doc(`listings/${id}`));
    const [userSnap, platformSnap, orderSnap, ...listingSnaps] = await transaction.getAll(
      userRef,
      platformRef,
      orderRef,
      ...listingRefs,
    );

    if (meta && orderSnap.exists) return null;

    const platformData = platformSnap.data() ?? {};
    const overrides =
      platformData.listingOverrides && typeof platformData.listingOverrides === 'object'
        ? (platformData.listingOverrides as Record<string, unknown>)
        : {};
    const claimed = buyerFromUser(userSnap, input.recipient);
    const listings = new Map<string, Listing>();

    listingIds.forEach((id, index) => {
      const cloud = listingFromDoc(id, listingSnaps[index]?.data());
      const base = cloud ?? seedListings.get(id) ?? null;
      if (base) listings.set(id, applyOverride(base, overrides));
    });

    const built = buildOrder({
      ...input,
      uid,
      buyerName: claimed.name,
      claimedVoucherCodes: claimed.claimed,
      listings,
      vouchers: [...SEED_VOUCHERS, ...platformVouchers(platformSnap)],
      ...(meta
        ? { id: meta.id, code: meta.code, createdAt: meta.createdAt }
        : {}),
    });

    const nextOverrides = { ...overrides };
    const writes: WritePlan[] = [];
    let overrideChanged = false;
    for (const update of built.stockUpdates) {
      const current = update.listing;
      const stock = Math.max(0, (typeof current.stock === 'number' ? current.stock : 99) - update.qty);
      const sold = Math.max(0, (typeof current.sold === 'number' ? current.sold : 0) + update.qty);
      const flashStock =
        update.isFlash && typeof current.flashStock === 'number'
          ? Math.max(0, current.flashStock - update.qty)
          : undefined;
      const patch: Record<string, unknown> = { stock, sold };
      if (flashStock !== undefined) patch.flashStock = flashStock;

      const existingOverride = overrides[current.id];
      const overrideHasStock =
        Boolean(existingOverride && typeof existingOverride === 'object') &&
        ('stock' in (existingOverride as Record<string, unknown>) ||
          'flashStock' in (existingOverride as Record<string, unknown>));
      const isSeed = seedListings.has(current.id);
      if (isSeed || overrideHasStock) {
        nextOverrides[current.id] = {
          ...(existingOverride && typeof existingOverride === 'object' ? existingOverride : {}),
          ...patch,
        };
        overrideChanged = true;
      }

      if (!isSeed) {
        writes.push({
          cloudRef: db.doc(`listings/${current.id}`),
          cloudData: { ...patch, updatedAt: FieldValue.serverTimestamp() },
        });
      }
    }

    transaction.set(orderRef, orderPayload(built));
    if (overrideChanged) {
      transaction.set(platformRef, { listingOverrides: nextOverrides }, { merge: true });
    }
    for (const write of writes) {
      transaction.update(write.cloudRef, write.cloudData);
    }
    return built.order;
  });
}

export async function createServerOrder(
  admin: AdminServices,
  uid: string,
  body: unknown,
): Promise<Order> {
  const input = parseCreateOrderInput(body);
  const order = await runOrderTransaction(admin, uid, input);
  if (!order) throw new OrderError(409, 'Pesanan sudah ada.');
  return order;
}

export async function importServerOrders(
  admin: AdminServices,
  uid: string,
  body: unknown,
): Promise<string[]> {
  const inputs: ImportOrderInput[] = parseImportOrders(body);
  const imported: string[] = [];
  for (const input of inputs) {
    try {
      const order = await runOrderTransaction(admin, uid, input, {
        id: input.id,
        code: input.code,
        createdAt: input.createdAt,
      });
      if (order) imported.push(order.id);
    } catch (error) {
      if (!(error instanceof OrderError)) throw error;
    }
  }
  return imported;
}