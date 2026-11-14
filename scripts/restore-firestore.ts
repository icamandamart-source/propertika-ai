#!/usr/bin/env tsx
/**
 * Pulihkan data Firestore dari berkas backup JSON.
 *
 * Aman secara bawaan: tanpa --confirm, skrip hanya menampilkan rencana
 * (dry-run) dan tidak menulis apa pun.
 *
 * Contoh:
 *   npm run backup:restore                          # dry-run dari backup terbaru
 *   npm run backup:restore -- --file backups/x.json  # dry-run berkas tertentu
 *   npm run backup:restore -- --confirm             # benar-benar menulis
 *   npm run backup:restore -- --confirm --only orders
 */
import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getAdmin } from '../server/admin.ts';
import { decodeDocument, parseManifest, totalDocuments } from '../server/backup-core.ts';

const BATCH_SIZE = 400;

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const backupDir = resolve(process.cwd(), 'backups');

function latestBackup(): string {
  const files = readdirSync(backupDir)
    .filter((name) => name.startsWith('firestore-') && name.endsWith('.json'))
    .map((name) => join(backupDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (files.length === 0) {
    throw new Error('Tidak ada berkas backups/firestore-*.json. Jalankan "npm run backup" dulu.');
  }
  return files[0];
}

const file = argValue('file') ? resolve(process.cwd(), argValue('file')!) : latestBackup();
const confirm = hasFlag('confirm');
const merge = hasFlag('merge');
const forceProject = hasFlag('force-project');
const only = (argValue('only') ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const admin = await getAdmin();
if (!admin) {
  console.error(
    '[restore] Firebase Admin tidak aktif. Isi FIREBASE_SERVICE_ACCOUNT atau GOOGLE_APPLICATION_CREDENTIALS di .env.',
  );
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_PROJECT_ID?.trim() ||
  process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
  admin.app.options.projectId ||
  'unknown';

let manifest;
try {
  manifest = parseManifest(JSON.parse(readFileSync(file, 'utf8')));
} catch (error) {
  console.error(`[restore] Gagal membaca backup: ${(error as Error).message}`);
  process.exit(1);
}

if (manifest.projectId !== projectId && !forceProject) {
  console.error(
    `[restore] Backup berasal dari proyek "${manifest.projectId}", tetapi .env menunjuk "${projectId}".\n` +
      'Tambahkan --force-project bila memang ingin menulis ke proyek ini.',
  );
  process.exit(1);
}

const collections = Object.keys(manifest.documents)
  .filter((name) => (only.length ? only.includes(name) : true))
  .sort();

if (collections.length === 0) {
  console.error(`[restore] Tidak ada koleksi yang cocok dengan --only ${only.join(',')}.`);
  process.exit(1);
}

if (manifest.projectId !== projectId) {
  console.warn(
    `[restore] PERINGATAN: backup dari proyek "${manifest.projectId}" dipulihkan ke "${projectId}".`,
  );
}

console.log(`[restore] Berkas : ${file}`);
console.log(`[restore] Dibuat : ${manifest.createdAt}`);
console.log(`[restore] Mode   : ${merge ? 'merge (field lama dipertahankan)' : 'overwrite dokumen'}`);
console.log('[restore] Rencana:');
for (const name of collections) {
  console.log(`  ${name.padEnd(12)} ${manifest.counts[name]} dokumen`);
}

if (!confirm) {
  console.log(
    `\n[restore] DRY-RUN: tidak ada data yang ditulis. Jalankan ulang dengan --confirm untuk memulihkan ${totalDocuments(manifest)} dokumen.`,
  );
  process.exit(0);
}

const context = { documentReference: (path: string) => admin.db.doc(path) };
let restored = 0;

for (const name of collections) {
  const docs = manifest.documents[name];
  let written = 0;
  for (let start = 0; start < docs.length; start += BATCH_SIZE) {
    const chunk = docs.slice(start, start + BATCH_SIZE);
    const batch = admin.db.batch();
    for (const item of chunk) {
      batch.set(
        admin.db.collection(name).doc(item.id),
        decodeDocument(item.data, context),
        { merge },
      );
    }
    await batch.commit();
    written += chunk.length;
    restored += chunk.length;
    console.log(`  ${name}: ${written}/${docs.length}...`);
  }
}

console.log(`\n[restore] Selesai: ${restored} dokumen ditulis ke ${projectId}.`);
