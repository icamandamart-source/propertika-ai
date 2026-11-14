import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import {
  createErrorHandler,
  createLogger,
  httpErrorStatus,
  requestLogger,
  resolveLogLevel,
  resolveRequestId,
  sanitizeFields,
} from '../server/log';

function capture() {
  const lines: string[] = [];
  const logger = createLogger({ level: 'debug', service: 'test', sink: (line) => lines.push(line) });
  return { lines, logger };
}

describe('logger', () => {
  it('menulis satu baris JSON dan menghormati level minimum', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'info', service: 'test', sink: (line) => lines.push(line) });

    logger.debug('debug_event');
    expect(lines).toHaveLength(0);

    logger.info('request_ok', { userId: 'u1', durationMs: 12.5 });
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.level).toBe('info');
    expect(entry.service).toBe('test');
    expect(entry.event).toBe('request_ok');
    expect(entry.userId).toBe('u1');
    expect(entry.durationMs).toBe(12.5);
    expect(typeof entry.time).toBe('string');
  });

  it('menyamarkan token/kunci dan merapikan Error', () => {
    const { lines, logger } = capture();
    logger.error('failed', {
      authorization: 'Bearer rahasia',
      nested: { apiKey: 'abc', idToken: 'xyz', safe: 'ok' },
      error: new Error('boom'),
    });

    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.authorization).toBe('[redacted]');
    expect((entry.nested as Record<string, unknown>).apiKey).toBe('[redacted]');
    expect((entry.nested as Record<string, unknown>).idToken).toBe('[redacted]');
    expect((entry.nested as Record<string, unknown>).safe).toBe('ok');
    expect((entry.error as Record<string, unknown>).message).toBe('boom');
  });

  it('membatasi panjang string, jumlah item array, dan melewati nilai kosong', () => {
    const sanitized = sanitizeFields({
      long: 'x'.repeat(1_500),
      items: Array.from({ length: 30 }, (_, index) => index),
      kosong: undefined,
    });
    expect((sanitized.long as string).length).toBe(1_001);
    expect(sanitized.items as unknown[]).toHaveLength(20);
    expect(JSON.stringify(sanitized)).not.toContain('kosong');
  });

  it('membaca LOG_LEVEL dan kembali ke info bila tidak dikenal', () => {
    expect(resolveLogLevel('DEBUG')).toBe('debug');
    expect(resolveLogLevel('silent')).toBe('silent');
    expect(resolveLogLevel('verbose')).toBe('info');
    expect(resolveLogLevel(undefined)).toBe('info');
  });
});

describe('request id', () => {
  it('memakai header yang valid', () => {
    expect(resolveRequestId('abc-123_xyz.9')).toBe('abc-123_xyz.9');
    expect(resolveRequestId(['trace-12345678'])).toBe('trace-12345678');
  });

  it('membuat UUID bila header kosong atau tidak wajar', () => {
    expect(resolveRequestId(undefined)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(resolveRequestId('bad id!')).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId('pendek')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('request logger middleware', () => {
  it('mengirim X-Request-Id dan mencatat status/durasi', () => {
    const { lines, logger } = capture();
    const headers: Record<string, string> = {};
    const req = {
      headers: { 'x-request-id': 'abcdefgh-1234' },
      method: 'GET',
      path: '/api/contoh',
    } as unknown as Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      writableEnded: true,
      locals: {} as Record<string, unknown>,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
    }) as unknown as Response;

    requestLogger(logger)(req, res, () => {});
    res.emit('finish');

    expect(headers['x-request-id']).toBe('abcdefgh-1234');
    expect(res.locals.requestId).toBe('abcdefgh-1234');
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.event).toBe('http_request');
    expect(entry.requestId).toBe('abcdefgh-1234');
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/api/contoh');
    expect(entry.status).toBe(200);
    expect(typeof entry.durationMs).toBe('number');
  });

  it('menurunkan log health/aset menjadi debug', () => {
    const { lines, logger } = capture();
    const req = { headers: {}, method: 'GET', path: '/api/health' } as unknown as Request;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      writableEnded: true,
      locals: {},
      setHeader: () => {},
    }) as unknown as Response;

    requestLogger(logger)(req, res, () => {});
    res.emit('finish');
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.level).toBe('debug');
    expect(entry.event).toBe('http_request');
  });
});

describe('http error handling', () => {
  it('memetakan status error yang umum', () => {
    expect(httpErrorStatus({ status: 418 })).toBe(418);
    expect(httpErrorStatus({ statusCode: 401 })).toBe(401);
    expect(httpErrorStatus({ type: 'entity.too.large' })).toBe(413);
    expect(httpErrorStatus({ type: 'entity.parse.failed' })).toBe(400);
    expect(httpErrorStatus(new Error('boom'))).toBe(500);
  });

  it('membalas pesan aman dan menyertakan requestId untuk API', () => {
    const { lines, logger } = capture();
    const req = { method: 'POST', path: '/api/contoh' } as unknown as Request;
    const body: Record<string, unknown> = {};
    const res = {} as Response & { statusCode: number };
    res.headersSent = false;
    res.statusCode = 200;
    res.locals = { requestId: 'req-12345678' };
    res.status = ((code: number) => {
      res.statusCode = code;
      return res;
    }) as Response['status'];
    res.json = ((payload: Record<string, unknown>) => {
      Object.assign(body, payload);
      return res;
    }) as Response['json'];
    res.type = (() => res) as Response['type'];
    res.send = (() => res) as Response['send'];

    createErrorHandler(logger)(new Error('rahasia internal'), req, res, (() => {}) as NextFunction);

    expect(res.statusCode).toBe(500);
    expect(body.error).toBe('Terjadi kesalahan pada server.');
    expect(body.requestId).toBe('req-12345678');
    const entry = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(entry.event).toBe('unhandled_error');
    expect((entry.error as Record<string, unknown>).message).toBe('rahasia internal');
  });
});