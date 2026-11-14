export interface RateLimitDecision {
  limited: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitDecision;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  maxEntries?: number;
}

/** Pembatas laju sederhana per kunci (mis. alamat IP) dengan jendela tetap. */
export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { maxRequests, windowMs, maxEntries = 10_000 } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key, now = Date.now()) {
      if (hits.size > maxEntries) {
        for (const [entryKey, entry] of hits) {
          if (entry.resetAt <= now) hits.delete(entryKey);
        }
      }

      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { limited: false, retryAfterSeconds: 0 };
      }

      entry.count += 1;
      if (entry.count <= maxRequests) {
        return { limited: false, retryAfterSeconds: 0 };
      }
      return {
        limited: true,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    },
  };
}