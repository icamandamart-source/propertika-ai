#!/usr/bin/env tsx
/**
 * Backup seluruh koleksi Firestore ke satu berkas JSON di folder backups/.
 *
 * Memakai kredensial Firebase Admin yang sama dengan server
 * (FIREBASE_SERVICE_ACCOUNT atau GOOGLE_APPLICATION_CREDENTIALS), jadi tidak
 * perlu gcloud atau billing tambahan.
 *
 * Contoh:
 *   npm run backup
 *   npm run backup -- --out backups/sebelum-rilis.json
 *   npm run backup -- --only listings,orders
 */
import 'dotenv/config';
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getAdmin } from '../server/admin.ts';
import {
  backupFileName,
  buildManifest,
  encodeDocument,
  type BackupDocument,
  totalDocuments,
} from '../server/backup-core.ts';

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const only = (argValue('only') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const admin = await getAdmin();
if (!admin) {
  console.error(
    '[backup] Firebase Admin tidak aktif. Isi FIREBASE_SERVICE_ACCOUNT atau GOOGLE_APPLICATION_CREDENTIALS di .env.',
  );
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_PROJECT_ID?.trim() ||
  process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
  admin.app.options.projectId ||
  'unknown';
const databaseId = process.env.VITE_FIREBASE_FIRESTORE_DB?.trim() || '(default)';

const collections = (await admin.db.listCollections())
  .map((item) => item.id)
  .filter((name) => (only.length ? only.includes(name) : true))
  .sort();

if (collections.length === 0) {
  console.error(
    only.length
      ? `[backup] Tidak ada koleksi yang cocok dengan --only ${only.join(',')}.`
      : '[backup] Tidak ada koleksi di Firestore.',
  );
  process.exit(1);
}

const documents: Record<string, BackupDocument[]> = {};

for (const name of collections) {
  const snapshot = await admin.db.collection(name).get();
  documents[name] = snapshot.docs
    .map((doc) => ({ id: doc.id, data: encodeDocument(doc.data()) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  console.log(`  ${name.padEnd(12)} ${String(documents[name].length).padStart(5)} dokumen`);
}

const createdAt = new Date();
const manifest = buildManifest({ projectId, databaseId, createdAt, documents });
const output = resolve(
  process.cwd(),
  argValue('out') ?? `backups/${backupFileName(createdAt)}`,
);
mkdirSync(dirname(output), { recursive: true });
const json = JSON.stringify(manifest, null, 2);
writeFileSync(output, `${json}\n`, 'utf8');

const kilobytes = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);
console.log(
  `\n[backup] ${totalDocuments(manifest)} dokumen dari ${collections.length} koleksi disimpan ke:\n  ${output} (${kilobytes} KB)`,
);

// Simpan hanya `--keep` berkas terbaru (bawaan 14) agar folder tidak membengkak.
const keep = Number(argValue('keep') ?? '14');
if (Number.isFinite(keep) && keep > 0) {
  const folder = dirname(output);
  const candidates = readdirSync(folder)
    .filter((name) => /^firestore-.*\.json$/.test(name))
    .map((name) => ({ name, time: statSync(join(folder, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const item of candidates.slice(keep)) {
    unlinkSync(join(folder, item.name));
    console.log(`[backup] hapus backup lama: ${item.name}`);
  }
}

if (hasFlag('quiet')) process.exit(0);
