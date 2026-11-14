import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogEntry,
} from '../types';

/** Jumlah catatan yang disimpan di peramban dan ditampilkan pada tab admin. */
export const MAX_AUDIT_LOGS = 500;

/** Label yang mudah dibaca untuk setiap jenis tindakan admin. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'produk.ubah': 'Ubah produk',
  'produk.reset': 'Reset perubahan produk',
  'voucher.tambah': 'Tambah voucher',
  'voucher.hapus': 'Hapus voucher',
  'banner.tambah': 'Tambah banner',
  'banner.hapus': 'Hapus banner',
  'kategori.label': 'Ubah nama kategori',
  'kategori.visibilitas': 'Ubah visibilitas kategori',
};

export interface AuditEntryInput {
  actorUid: string;
  actorName: string;
  action: AuditAction;
  target: string;
  detail?: string;
  /** Waktu pencatatan; bisa diisi pada pengujian agar hasilnya deterministik. */
  now?: Date;
  /** ID khusus; bila kosong dibuat dari waktu + angka acak. */
  id?: string;
}

function auditId(now: Date): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 17);
  const random = Math.random().toString(36).slice(2, 8);
  return `audit-${stamp}-${random}`;
}

/** Bentuk catatan audit dari tindakan admin yang baru terjadi. */
export function createAuditEntry(input: AuditEntryInput): AuditLogEntry {
  const now = input.now ?? new Date();
  return {
    id: input.id ?? auditId(now),
    actorUid: input.actorUid,
    actorName: input.actorName.trim() || 'Admin',
    action: input.action,
    target: input.target.trim(),
    detail: (input.detail ?? '').trim(),
    createdAt: now.toISOString(),
  };
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  return value.slice(0, max);
}

/**
 * Baca catatan dari localStorage/Firestore dengan aman. Catatan yang tidak
 * lengkap atau memakai jenis tindakan tak dikenal dibuang.
 */
export function normalizeAuditEntry(raw: unknown): AuditLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = asText(item.id, 160);
  const actorUid = asText(item.actorUid, 128);
  const actorName = asText(item.actorName, 120);
  const target = asText(item.target, 200);
  const detail = asText(item.detail, 1000);
  const createdAt = asText(item.createdAt, 40);
  if (!id || !id.trim() || !actorUid || !actorUid.trim()) return null;
  if (!isAuditAction(item.action) || !createdAt || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }
  return {
    id,
    actorUid,
    actorName: actorName || 'Admin',
    action: item.action,
    target: target ?? '',
    detail: detail ?? '',
    createdAt,
  };
}

/** Gabungkan catatan lokal + cloud, buang duplikat, urutkan terbaru lebih dulu. */
export function mergeAuditLogs(
  ...groups: (AuditLogEntry[] | null | undefined)[]
): AuditLogEntry[] {
  const byId = new Map<string, AuditLogEntry>();
  for (const group of groups) {
    for (const entry of group ?? []) {
      const normalized = normalizeAuditEntry(entry);
      if (normalized) byId.set(normalized.id, normalized);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      const byTime = b.createdAt.localeCompare(a.createdAt);
      return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
    })
    .slice(0, MAX_AUDIT_LOGS);
}
