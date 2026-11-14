import { getAppCheckToken, loadFirebase } from '../firebase';
import type { Listing, Order } from '../types';

/**
 * Unggah foto yang masih berupa data URL ke server Express (`POST /api/upload`)
 * lalu kembalikan URL publiknya. Diperlukan karena foto data URL tidak boleh
 * disimpan langsung ke Firestore (batas 1 MB per dokumen).
 *
 * Hanya aktif saat mode Firestore. Server memverifikasi ID token Firebase,
 * jadi pengguna harus sudah masuk. Berkas disimpan di folder `uploads/`.
 */
const enabled = import.meta.env.VITE_DATA_BACKEND === 'firestore';

function isDataUrl(value: string | undefined): boolean {
  return Boolean(value && value.startsWith('data:'));
}

async function uploadDataUrl(dataUrl: string): Promise<string | null> {
  const bundle = await loadFirebase();
  const token = await bundle?.auth.currentUser?.getIdToken();
  if (!token) {
    console.warn('[upload] dilewati: pengguna belum masuk.');
    return null;
  }

  const appCheckToken = await getAppCheckToken();

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({ dataUrl }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    console.warn('[upload] gagal:', payload?.error ?? response.statusText);
    return null;
  }

  const payload = (await response.json()) as { url?: string };
  return payload.url ?? null;
}

async function uploadImages(values: string[]): Promise<string[]> {
  return Promise.all(
    values.map(async (value) => {
      if (!isDataUrl(value)) return value;
      try {
        return (await uploadDataUrl(value)) ?? '';
      } catch (error) {
        console.warn('[upload] gagal mengunggah foto:', error);
        return '';
      }
    }),
  );
}

/** Unggah semua foto listing yang masih data URL, kembalikan listing baru. */
export async function uploadListingImages(listing: Listing): Promise<Listing> {
  if (!enabled) return listing;

  const images = listing.images ?? [];
  const hasDataUrl = [listing.imageUrl, ...images].some(isDataUrl);
  if (!hasDataUrl) return listing;

  const uploaded = await uploadImages(images);
  const coverFromImages = uploaded.find((url, index) => isDataUrl(images[index]) && url) ?? '';

  return {
    ...listing,
    images: uploaded.filter(Boolean),
    imageUrl: isDataUrl(listing.imageUrl) ? coverFromImages : listing.imageUrl,
  };
}

/** Unggah foto item pesanan yang masih data URL, kembalikan pesanan baru. */
export async function uploadOrderImages(order: Order): Promise<Order> {
  if (!enabled) return order;

  const hasDataUrl = order.items.some((item) => isDataUrl(item.imageUrl));
  if (!hasDataUrl) return order;

  const uploaded = await uploadImages(order.items.map((item) => item.imageUrl ?? ''));

  return {
    ...order,
    items: order.items.map((item, index) => ({
      ...item,
      imageUrl: uploaded[index] || item.imageUrl,
    })),
  };
}
