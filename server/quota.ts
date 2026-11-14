import type { Firestore } from 'firebase-admin/firestore';

export interface QuotaLimits {
  minuteLimit: number;
  dayLimit: number;
  windowMs: number;
  dayMs: number;
}

export interface QuotaDecision {
  allowed: boolean;
  /** Detik sampai kuota yang menolak tersedia lagi. 0 bila diizinkan. */
  retryAfterSeconds: number;
  scope?: 'minute' | 'day';
}

export interface QuotaStore {
  consume(uid: string, limits: QuotaLimits, now?: number): Promise<QuotaDecision>;
}

interface Usage {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const ALLOWED: QuotaDecision = { allowed: true, retryAfterSeconds: 0 };

function decide(usage: Usage, limits: QuotaLimits, now: number): QuotaDecision {
  if (usage.dayCount >= limits.dayLimit) {
    return {
      allowed: false,
      scope: 'day',
      retryAfterSeconds: Math.max(1, Math.ceil((usage.dayResetAt - now) / 1000)),
    };
  }
  if (usage.minuteCount >= limits.minuteLimit) {
    return {
      allowed: false,
      scope: 'minute',
      retryAfterSeconds: Math.max(1, Math.ceil((usage.minuteResetAt - now) / 1000)),
    };
  }
  usage.minuteCount += 1;
  usage.dayCount += 1;
  return ALLOWED;
}

function resetWindows(usage: Usage, limits: QuotaLimits, now: number): void {
  if (usage.minuteResetAt <= now) {
    usage.minuteCount = 0;
    usage.minuteResetAt = now + limits.windowMs;
  }
  if (usage.dayResetAt <= now) {
    usage.dayCount = 0;
    usage.dayResetAt = now + limits.dayMs;
  }
}

/** Penyimpanan kuota in-memory; cukup untuk satu instance dan ter-reset saat restart. */
export class MemoryQuotaStore implements QuotaStore {
  private readonly usage = new Map<string, Usage>();
  private sweepAt = 0;

  async consume(uid: string, limits: QuotaLimits, now = Date.now()): Promise<QuotaDecision> {
    if (this.usage.size > 10_000 || now > this.sweepAt) {
      this.sweepAt = now + limits.dayMs;
      for (const [key, entry] of this.usage) {
        if (entry.dayResetAt <= now) this.usage.delete(key);
      }
    }

    let usage = this.usage.get(uid);
    if (!usage) {
      usage = {
        minuteCount: 0,
        minuteResetAt: now + limits.windowMs,
        dayCount: 0,
        dayResetAt: now + limits.dayMs,
      };
      this.usage.set(uid, usage);
    }

    resetWindows(usage, limits, now);
    return decide(usage, limits, now);
  }
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Penyimpanan kuota di Firestore. Transaksi membuat penghitung aman dipakai
 * beberapa instance server sekaligus (tidak reset saat restart).
 */
export function createFirestoreQuotaStore(db: Firestore): QuotaStore {
  const collection = db.collection('aiUsage');

  return {
    async consume(uid, limits, now = Date.now()) {
      const ref = collection.doc(uid);

      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const data = snapshot.exists ? snapshot.data() : undefined;
        const usage: Usage = {
          minuteCount: toNumber(data?.minuteCount, 0),
          minuteResetAt: toNumber(data?.minuteResetAt, now + limits.windowMs),
          dayCount: toNumber(data?.dayCount, 0),
          dayResetAt: toNumber(data?.dayResetAt, now + limits.dayMs),
        };

        resetWindows(usage, limits, now);

        if (usage.dayCount >= limits.dayLimit) {
          return {
            allowed: false,
            scope: 'day',
            retryAfterSeconds: Math.max(1, Math.ceil((usage.dayResetAt - now) / 1000)),
          } satisfies QuotaDecision;
        }
        if (usage.minuteCount >= limits.minuteLimit) {
          return {
            allowed: false,
            scope: 'minute',
            retryAfterSeconds: Math.max(1, Math.ceil((usage.minuteResetAt - now) / 1000)),
          } satisfies QuotaDecision;
        }

        usage.minuteCount += 1;
        usage.dayCount += 1;
        transaction.set(
          ref,
          {
            minuteCount: usage.minuteCount,
            minuteResetAt: usage.minuteResetAt,
            dayCount: usage.dayCount,
            dayResetAt: usage.dayResetAt,
            updatedAt: now,
          },
          { merge: true },
        );
        return ALLOWED;
      });
    },
  };
}