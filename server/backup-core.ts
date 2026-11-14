import { Buffer } from 'node:buffer';
import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';

/**
 * Inti backup/restore Firestore: mengubah nilai Firestore menjadi JSON yang
 * aman ditulis ke disk, lalu mengembalikannya saat restore. Fungsi di sini
 * murni (tanpa I/O) supaya mudah diuji.
 */

export const BACKUP_FORMAT = 'propertika-firestore-backup';
export const BACKUP_VERSION = 1;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface BackupDocument {
  id: string;
  data: Record<string, JsonValue>;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  projectId: string;
  databaseId: string;
  createdAt: string;
  counts: Record<string, number>;
  documents: Record<string, BackupDocument[]>;
}

const TYPE_KEY = '$type';
const TYPE_TIMESTAMP = 'timestamp';
const TYPE_DATE = 'date';
const TYPE_GEOPOINT = 'geopoint';
const TYPE_REFERENCE = 'reference';
const TYPE_BYTES = 'bytes';

function special(type: string, value: Record<string, JsonValue>): JsonValue {
  return { [TYPE_KEY]: type, value } as JsonValue;
}

/** Ubah satu nilai Firestore (Timestamp, GeoPoint, Buffer, dll.) ke JSON. */
export function encodeValue(input: unknown): JsonValue {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return input;
  }
  if (input instanceof Date) {
    return special(TYPE_DATE, { iso: input.toISOString() });
  }
  if (input instanceof Timestamp) {
    return special(TYPE_TIMESTAMP, {
      seconds: input.seconds,
      nanoseconds: input.nanoseconds,
    });
  }
  if (input instanceof GeoPoint) {
    return special(TYPE_GEOPOINT, {
      latitude: input.latitude,
      longitude: input.longitude,
    });
  }
  if (input instanceof DocumentReference) {
    return special(TYPE_REFERENCE, { path: input.path });
  }
  if (Buffer.isBuffer(input)) {
    return special(TYPE_BYTES, { base64: input.toString('base64') });
  }
  if (input instanceof Uint8Array) {
    return special(TYPE_BYTES, { base64: Buffer.from(input).toString('base64') });
  }
  if (Array.isArray(input)) {
    return input.map(encodeValue);
  }
  if (typeof input === 'object') {
    const output: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (value === undefined) continue;
      output[key] = encodeValue(value);
    }
    return output;
  }
  return String(input);
}

export interface DecodeContext {
  /** Pembuat referensi dokumen; dipakai saat restore ke Firestore. */
  documentReference?: (path: string) => DocumentReference;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Nilai bertipe khusus harus berupa objek.');
  }
  return value as Record<string, JsonValue>;
}

function asString(record: Record<string, JsonValue>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`Field "${key}" pada nilai khusus tidak valid.`);
  return value;
}

function asNumber(record: Record<string, JsonValue>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Field "${key}" pada nilai khusus tidak valid.`);
  }
  return value;
}

/** Kembalikan JSON hasil encode menjadi nilai Firestore. */
export function decodeValue(input: JsonValue, context: DecodeContext = {}): unknown {
  if (input === null) return null;
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => decodeValue(item, context));

  const record = input as Record<string, JsonValue>;
  if (TYPE_KEY in record) {
    const type = record[TYPE_KEY];
    const value = asRecord(record.value ?? null);
    switch (type) {
      case TYPE_TIMESTAMP:
        return new Timestamp(asNumber(value, 'seconds'), asNumber(value, 'nanoseconds'));
      case TYPE_DATE:
        return new Date(asString(value, 'iso'));
      case TYPE_GEOPOINT:
        return new GeoPoint(asNumber(value, 'latitude'), asNumber(value, 'longitude'));
      case TYPE_REFERENCE: {
        const path = asString(value, 'path');
        if (!context.documentReference) {
          throw new Error(`Tidak bisa memulihkan referensi "${path}" tanpa koneksi Firestore.`);
        }
        return context.documentReference(path);
      }
      case TYPE_BYTES:
        return Buffer.from(asString(value, 'base64'), 'base64');
      default:
        throw new Error(`Tipe nilai khusus tidak dikenal: ${String(type)}`);
    }
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    output[key] = decodeValue(item, context);
  }
  return output;
}

export function encodeDocument(data: Record<string, unknown>): Record<string, JsonValue> {
  return encodeValue(data) as Record<string, JsonValue>;
}

export function decodeDocument(
  data: Record<string, JsonValue>,
  context: DecodeContext = {},
): Record<string, unknown> {
  return decodeValue(data, context) as Record<string, unknown>;
}

/** Nama berkas backup, aman untuk Windows (tanpa titik dua). */
export function backupFileName(date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `firestore-${stamp}.json`;
}

export function buildManifest(input: {
  projectId: string;
  databaseId: string;
  createdAt: Date;
  documents: Record<string, BackupDocument[]>;
}): BackupManifest {
  const counts: Record<string, number> = {};
  for (const [name, docs] of Object.entries(input.documents)) counts[name] = docs.length;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    projectId: input.projectId,
    databaseId: input.databaseId,
    createdAt: input.createdAt.toISOString(),
    counts,
    documents: input.documents,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Validasi berkas backup sebelum dipakai restore. */
export function parseManifest(raw: unknown): BackupManifest {
  if (!isObject(raw)) throw new Error('Berkas backup bukan objek JSON.');
  if (raw.format !== BACKUP_FORMAT) {
    throw new Error('Berkas ini bukan backup Propertika AI.');
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new Error(`Versi backup ${String(raw.version)} tidak didukung (butuh ${BACKUP_VERSION}).`);
  }
  if (typeof raw.projectId !== 'string' || !raw.projectId) {
    throw new Error('Backup tidak mencantumkan projectId.');
  }
  if (typeof raw.databaseId !== 'string') {
    throw new Error('Backup tidak mencantumkan databaseId.');
  }
  if (typeof raw.createdAt !== 'string' || Number.isNaN(Date.parse(raw.createdAt))) {
    throw new Error('Backup tidak mencantumkan createdAt yang valid.');
  }
  if (!isObject(raw.documents)) throw new Error('Backup tidak memuat daftar dokumen.');

  const documents: Record<string, BackupDocument[]> = {};
  for (const [collection, docs] of Object.entries(raw.documents)) {
    if (!Array.isArray(docs)) throw new Error(`Koleksi "${collection}" tidak berisi array.`);
    documents[collection] = docs.map((item, index) => {
      if (!isObject(item) || typeof item.id !== 'string' || !item.id || !isObject(item.data)) {
        throw new Error(`Dokumen ke-${index + 1} pada koleksi "${collection}" tidak valid.`);
      }
      return { id: item.id, data: item.data as Record<string, JsonValue> };
    });
  }

  const counts: Record<string, number> = {};
  for (const [collection, docs] of Object.entries(documents)) counts[collection] = docs.length;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    projectId: raw.projectId,
    databaseId: raw.databaseId,
    createdAt: raw.createdAt,
    counts,
    documents,
  };
}

export function totalDocuments(manifest: BackupManifest): number {
  return Object.values(manifest.counts).reduce((sum, count) => sum + count, 0);
}
