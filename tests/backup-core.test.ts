import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  buildManifest,
  decodeValue,
  encodeDocument,
  encodeValue,
  parseManifest,
  totalDocuments,
} from '../server/backup-core';

describe('encodeValue / decodeValue', () => {
  it('mempertahankan nilai JSON biasa', () => {
    const input = {
      title: 'Rumah Bandung',
      price: 1500000,
      active: true,
      note: null,
      tags: ['rumah', 'investasi'],
      nested: { city: 'Bandung', area: 120 },
    };
    expect(decodeValue(encodeValue(input))).toEqual(input);
  });

  it('mengubah Timestamp tanpa kehilangan presisi', () => {
    const timestamp = new Timestamp(1_763_000_000, 123_456_789);
    const encoded = encodeValue(timestamp);
    expect(encoded).toEqual({
      $type: 'timestamp',
      value: { seconds: 1_763_000_000, nanoseconds: 123_456_789 },
    });
    const decoded = decodeValue(encoded) as Timestamp;
    expect(decoded).toBeInstanceOf(Timestamp);
    expect(decoded.seconds).toBe(timestamp.seconds);
    expect(decoded.nanoseconds).toBe(timestamp.nanoseconds);
  });

  it('mengubah Date, GeoPoint, dan Buffer', () => {
    const date = new Date('2026-11-14T06:00:00.000Z');
    expect(decodeValue(encodeValue(date))).toEqual(date);

    const point = new GeoPoint(-6.2, 106.816666);
    const decodedPoint = decodeValue(encodeValue(point)) as GeoPoint;
    expect(decodedPoint.latitude).toBe(-6.2);
    expect(decodedPoint.longitude).toBe(106.816666);

    const bytes = Buffer.from('propertika', 'utf8');
    const decodedBytes = decodeValue(encodeValue(bytes)) as Buffer;
    expect(Buffer.isBuffer(decodedBytes)).toBe(true);
    expect(decodedBytes.toString('utf8')).toBe('propertika');
  });

  it('memulihkan referensi dokumen lewat konteks', () => {
    const encoded = { $type: 'reference', value: { path: 'orders/order-1' } };
    expect(() => decodeValue(encoded)).toThrow(/tanpa koneksi Firestore/);
    expect(decodeValue(encoded, { documentReference: (path) => path as never })).toBe(
      'orders/order-1',
    );
  });

  it('membuang nilai undefined dan menolak tipe khusus yang rusak', () => {
    expect(encodeDocument({ a: 1, b: undefined })).toEqual({ a: 1 });
    expect(() => decodeValue({ $type: 'timestamp', value: { seconds: 'x', nanoseconds: 0 } })).toThrow(
      /detik|seconds/,
    );
    expect(() => decodeValue({ $type: 'tidak-ada', value: {} })).toThrow(/tidak dikenal/);
  });
});

describe('backupFileName', () => {
  it('aman dipakai di Windows', () => {
    const name = backupFileName(new Date('2026-11-14T06:30:00.123Z'));
    expect(name).toBe('firestore-2026-11-14T06-30-00-123Z.json');
    expect(name).not.toContain(':');
  });
});

describe('manifest', () => {
  const manifest = buildManifest({
    projectId: 'homique-d18f8',
    databaseId: '(default)',
    createdAt: new Date('2026-11-14T06:30:00.000Z'),
    documents: {
      orders: [{ id: 'order-1', data: encodeDocument({ total: 1000 }) }],
      listings: [
        { id: 'listing-1', data: encodeDocument({ title: 'Rumah' }) },
        { id: 'listing-2', data: encodeDocument({ title: 'Tanah' }) },
      ],
      users: [],
    },
  });

  it('mencatat jumlah per koleksi', () => {
    expect(manifest.format).toBe(BACKUP_FORMAT);
    expect(manifest.version).toBe(BACKUP_VERSION);
    expect(manifest.counts).toEqual({ orders: 1, listings: 2, users: 0 });
    expect(totalDocuments(manifest)).toBe(3);
  });

  it('lolos validasi setelah diserialisasi', () => {
    const parsed = parseManifest(JSON.parse(JSON.stringify(manifest)));
    expect(parsed.counts).toEqual(manifest.counts);
    expect(parsed.documents.orders[0].data).toEqual({ total: 1000 });
  });

  it('menolak berkas yang bukan backup atau rusak', () => {
    expect(() => parseManifest(null)).toThrow(/bukan objek/);
    expect(() => parseManifest({ format: 'lain' })).toThrow(/bukan backup/);
    expect(() => parseManifest({ ...manifest, version: 99 })).toThrow(/tidak didukung/);
    expect(() => parseManifest({ ...manifest, projectId: '' })).toThrow(/projectId/);
    expect(() => parseManifest({ ...manifest, documents: [] })).toThrow(/daftar dokumen/);
    expect(() =>
      parseManifest({ ...manifest, documents: { orders: [{ id: '', data: {} }] } }),
    ).toThrow(/tidak valid/);
  });
});
