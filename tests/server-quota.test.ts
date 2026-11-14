import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import {
  createFirestoreQuotaStore,
  MemoryQuotaStore,
  type QuotaLimits,
} from '../server/quota';
import { createRateLimiter } from '../server/rate-limit';

const LIMITS: QuotaLimits = {
  minuteLimit: 2,
  dayLimit: 4,
  windowMs: 60_000,
  dayMs: 24 * 60 * 60 * 1000,
};

interface FakeDoc {
  data: Record<string, unknown>;
}

function fakeFirestore(): { db: Firestore; docs: Map<string, Record<string, unknown>> } {
  const docs = new Map<string, Record<string, unknown>>();
  const db = {
    collection: () => ({
      doc: (id: string) => ({ id }),
    }),
    runTransaction: async (
      handler: (transaction: {
        get: (ref: { id: string }) => Promise<FakeDoc>;
        set: (ref: { id: string }, value: Record<string, unknown>) => void;
      }) => Promise<unknown>,
    ) => {
      const transaction = {
        get: async (ref: { id: string }) => {
          const data = docs.get(ref.id);
          return { exists: Boolean(data), data: () => data } as unknown as FakeDoc;
        },
        set: (ref: { id: string }, value: Record<string, unknown>) => {
          docs.set(ref.id, { ...(docs.get(ref.id) ?? {}), ...value });
        },
      };
      return handler(transaction);
    },
  } as unknown as Firestore;

  return { db, docs };
}

describe('MemoryQuotaStore', () => {
  it('mengizinkan sampai batas per menit lalu menolak', async () => {
    const store = new MemoryQuotaStore();
    const now = 1_000_000;

    expect((await store.consume('user-1', LIMITS, now)).allowed).toBe(true);
    expect((await store.consume('user-1', LIMITS, now + 1)).allowed).toBe(true);

    const denied = await store.consume('user-1', LIMITS, now + 2);
    expect(denied).toMatchObject({ allowed: false, scope: 'minute' });
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('mengizinkan lagi setelah jendela menit lewat', async () => {
    const store = new MemoryQuotaStore();
    const now = 1_000_000;
    await store.consume('user-1', LIMITS, now);
    await store.consume('user-1', LIMITS, now + 1);
    expect((await store.consume('user-1', LIMITS, now + 2)).allowed).toBe(false);

    expect((await store.consume('user-1', LIMITS, now + LIMITS.windowMs + 1)).allowed).toBe(true);
  });

  it('menolak setelah batas harian tercapai', async () => {
    const store = new MemoryQuotaStore();
    const now = 1_000_000;
    const longWindow: QuotaLimits = { ...LIMITS, minuteLimit: 100 };

    for (let index = 0; index < LIMITS.dayLimit; index += 1) {
      expect((await store.consume('user-1', longWindow, now + index)).allowed).toBe(true);
    }
    const denied = await store.consume('user-1', longWindow, now + LIMITS.dayLimit);
    expect(denied).toMatchObject({ allowed: false, scope: 'day' });
  });

  it('memisahkan penghitung antar akun', async () => {
    const store = new MemoryQuotaStore();
    const now = 1_000_000;
    await store.consume('user-1', LIMITS, now);
    await store.consume('user-1', LIMITS, now + 1);
    expect((await store.consume('user-1', LIMITS, now + 2)).allowed).toBe(false);
    expect((await store.consume('user-2', LIMITS, now + 3)).allowed).toBe(true);
  });
});

describe('createFirestoreQuotaStore', () => {
  it('menyimpan penghitung di dokumen dan menolak setelah batas', async () => {
    const { db, docs } = fakeFirestore();
    const store = createFirestoreQuotaStore(db);
    const now = 1_000_000;

    expect((await store.consume('user-1', LIMITS, now)).allowed).toBe(true);
    expect((await store.consume('user-1', LIMITS, now + 1)).allowed).toBe(true);
    expect((await store.consume('user-1', LIMITS, now + 2)).allowed).toBe(false);

    expect(docs.get('user-1')).toMatchObject({ minuteCount: 2, dayCount: 2 });
  });

  it('mengulang jendela menit dan tetap menyimpan hitungan harian', async () => {
    const { db, docs } = fakeFirestore();
    const store = createFirestoreQuotaStore(db);
    const now = 1_000_000;

    await store.consume('user-1', LIMITS, now);
    await store.consume('user-1', LIMITS, now + 1);
    expect((await store.consume('user-1', LIMITS, now + LIMITS.windowMs + 1)).allowed).toBe(true);

    expect(docs.get('user-1')).toMatchObject({ minuteCount: 1, dayCount: 3 });
  });
});

describe('createRateLimiter', () => {
  it('membatasi jumlah permintaan per kunci dan memberi Retry-After', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60_000 });
    const now = 5_000;

    expect(limiter.check('ip-1', now)).toMatchObject({ limited: false });
    expect(limiter.check('ip-1', now + 1)).toMatchObject({ limited: false });

    const denied = limiter.check('ip-1', now + 2);
    expect(denied.limited).toBe(true);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('mereset jendela dan memisahkan kunci', () => {
    const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const now = 5_000;

    expect(limiter.check('ip-1', now).limited).toBe(false);
    expect(limiter.check('ip-1', now + 1).limited).toBe(true);
    expect(limiter.check('ip-2', now + 1).limited).toBe(false);
    expect(limiter.check('ip-1', now + 1_001).limited).toBe(false);
  });
});