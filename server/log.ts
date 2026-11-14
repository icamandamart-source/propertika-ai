import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ConfiguredLevel = LogLevel | 'silent';
export type LogFields = Record<string, unknown>;

const LEVEL_WEIGHT: Record<ConfiguredLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const SENSITIVE_KEY = /(authorization|password|passwd|secret|token|cookie|api[_-]?key)/i;
const MAX_STRING = 1_000;
const MAX_STACK = 2_000;
const MAX_DEPTH = 3;
const MAX_ARRAY = 20;
const MAX_KEYS = 40;

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  service?: string;
  level?: ConfiguredLevel;
  base?: LogFields;
  sink?: (line: string) => void;
}

/** Baca LOG_LEVEL; nilai tidak dikenal kembali ke `info`. */
export function resolveLogLevel(value: string | undefined = process.env.LOG_LEVEL): ConfiguredLevel {
  const normalized = (value ?? '').trim().toLowerCase();
  if (
    normalized === 'debug' ||
    normalized === 'info' ||
    normalized === 'warn' ||
    normalized === 'error' ||
    normalized === 'silent'
  ) {
    return normalized;
  }
  return 'info';
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: truncate(error.message, MAX_STRING),
    ...(error.stack ? { stack: truncate(error.stack, MAX_STACK) } : {}),
  };
}

/** Ubah nilai menjadi bentuk aman untuk log: tanpa token, dibatasi ukurannya. */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return truncate(value, MAX_STRING);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Error) return sanitizeError(value);
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[max-depth]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      const safe = SENSITIVE_KEY.test(key) ? '[redacted]' : sanitizeValue(item, depth + 1);
      if (safe !== undefined) output[key] = safe;
    }
    return output;
  }
  return String(value);
}

export function sanitizeFields(fields: LogFields | undefined): LogFields {
  if (!fields) return {};
  return sanitizeValue(fields) as LogFields;
}

/** Buat logger JSON baris-per-baris. `sink` bisa diganti saat pengujian. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const service = options.service ?? 'propertika-ai';
  const threshold = LEVEL_WEIGHT[options.level ?? resolveLogLevel()];
  const base = options.base ?? {};
  const sink = options.sink ?? ((line: string) => process.stdout.write(line));

  const emit = (level: LogLevel, event: string, fields?: LogFields) => {
    if (LEVEL_WEIGHT[level] < threshold) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      service,
      ...sanitizeFields({ ...base, ...fields }),
      event,
    };
    try {
      sink(`${JSON.stringify(entry)}\n`);
    } catch {
      // Logging tidak boleh menjatuhkan permintaan.
    }
  };

  return {
    debug: (event, fields) => emit('debug', event, fields),
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
    child: (fields) => createLogger({ service, level: options.level, base: { ...base, ...fields }, sink }),
  };
}

/** Terima X-Request-Id yang wajar, atau buat UUID baru. */
export function resolveRequestId(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim();
  if (trimmed && /^[A-Za-z0-9._:-]{8,80}$/.test(trimmed)) return trimmed;
  return randomUUID();
}

function isQuietPath(pathname: string): boolean {
  return (
    pathname === '/api/health' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/uploads/')
  );
}

/** Middleware: beri ID permintaan, ukur durasi, lalu catat satu baris log. */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startedAt = process.hrtime.bigint();
    let logged = false;

    const write = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      const durationMs =
        Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10;
      const status = res.statusCode;
      const level: LogLevel = aborted
        ? 'warn'
        : status >= 500
          ? 'error'
          : status >= 400
            ? 'warn'
            : isQuietPath(req.path)
              ? 'debug'
              : 'info';
      logger[level]('http_request', {
        requestId,
        method: req.method,
        path: req.path,
        status,
        durationMs,
        ...(aborted ? { aborted: true } : {}),
      });
    };

    res.once('finish', () => write(false));
    res.once('close', () => {
      if (!res.writableEnded) write(true);
    });
    next();
  };
}

/** Status HTTP untuk error yang dilempar middleware Express. */
export function httpErrorStatus(error: unknown): number {
  const candidate = error as { status?: unknown; statusCode?: unknown; type?: unknown } | null;
  const status =
    typeof candidate?.status === 'number'
      ? candidate.status
      : typeof candidate?.statusCode === 'number'
        ? candidate.statusCode
        : 0;
  if (status >= 400 && status <= 599) return status;
  if (candidate?.type === 'entity.too.large') return 413;
  if (candidate?.type === 'entity.parse.failed') return 400;
  return 500;
}

/** Error handler terakhir: log detail di server, balas pesan aman ke klien. */
export function createErrorHandler(logger: Logger) {
  return (error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const status = httpErrorStatus(error);
    const requestId =
      typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
    logger.error('unhandled_error', {
      requestId,
      method: req.method,
      path: req.path,
      status,
      error,
    });

    const message =
      status === 413
        ? 'Permintaan terlalu besar.'
        : status === 400
          ? 'Format permintaan tidak valid.'
          : 'Terjadi kesalahan pada server.';
    if (req.path.startsWith('/api/')) {
      res.status(status).json({ error: message, ...(requestId ? { requestId } : {}) });
    } else {
      res.status(status).type('text/plain').send(message);
    }
  };
}