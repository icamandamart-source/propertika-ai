const MAX_REPORTS_PER_SESSION = 20;
const DEDUPE_MS = 10_000;
const RECENT_LIMIT = 50;

let sent = 0;
const recent = new Map<string, number>();

function clip(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function stripQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const query = value.indexOf('?');
  return query === -1 ? value : value.slice(0, query);
}

/**
 * Kirim ringkasan error ke server agar bisa ditelusuri di log.
 * Sengaja tidak mengirim token, email, isi formulir, atau query string.
 */
export function reportClientError(input: { message: string; source?: string; stack?: string }): void {
  if (typeof window === 'undefined' || sent >= MAX_REPORTS_PER_SESSION) return;

  const message = clip(input.message?.trim(), 500);
  if (!message) return;

  const now = Date.now();
  const key = `${message}|${input.source ?? ''}`;
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;

  recent.set(key, now);
  if (recent.size > RECENT_LIMIT) {
    for (const [entry, time] of recent) {
      if (now - time > DEDUPE_MS) recent.delete(entry);
    }
  }
  sent += 1;

  const body = JSON.stringify({
    message,
    source: clip(stripQuery(input.source), 300),
    stack: clip(input.stack, 4_000),
    path: window.location.pathname.slice(0, 300),
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/client-errors', blob)) return;
    }
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Kegagalan pelaporan tidak boleh mengganggu aplikasi.
    });
  } catch {
    // Abaikan; pelaporan error bersifat best-effort.
  }
}