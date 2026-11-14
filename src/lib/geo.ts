import type { GeoCoords } from '../types';

const env = import.meta.env ?? {};
const MAPS_API_KEY = (env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';

/** True kalau kunci Google Maps API tersedia untuk pengisian alamat otomatis. */
export const mapsApiKeyConfigured = Boolean(MAPS_API_KEY);

/** Pastikan nilai dari penyimpanan/Firebase benar-benar berisi koordinat valid. */
export function normalizeCoords(raw: unknown): GeoCoords | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { lat?: unknown; lng?: unknown };
  const lat = typeof value.lat === 'number' ? value.lat : Number(value.lat);
  const lng = typeof value.lng === 'number' ? value.lng : Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Jarak garis lurus antara dua titik dalam kilometer (rumus haversine). */
export function haversineKm(a: GeoCoords, b: GeoCoords): number {
  const earthRadiusKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "± 850 m", "± 3,2 km" — pembulatan supaya mudah dibaca. */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '-';
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${new Intl.NumberFormat('id-ID').format(meters)} m`;
  }
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${new Intl.NumberFormat('id-ID').format(Math.round(km))} km`;
}

/** Peta Google yang bisa disematkan tanpa kunci API. */
export function mapsEmbedUrl(coords: GeoCoords, zoom = 15): string {
  return `https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=${zoom}&hl=id&output=embed`;
}

/** Tautan untuk membuka titik lokasi di Google Maps. */
export function mapsSearchUrl(coords: GeoCoords): string {
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
}

/** Minta izin dan ambil posisi pengguna saat ini dari peramban. */
export function getCurrentCoords(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Peramban ini tidak mendukung deteksi lokasi.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan izin lokasi pada peramban lalu coba lagi.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Lokasi tidak tersedia. Periksa GPS atau koneksi Anda.'
              : 'Gagal mendeteksi lokasi. Coba lagi.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

export interface ResolvedPlace {
  address: string;
  city?: string;
  postalCode?: string;
}

interface GoogleAddressComponent {
  long_name?: string;
  types?: string[];
}

interface GoogleGeocodeResult {
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: { location?: { lat?: number; lng?: number } };
}

interface GoogleGeocodeResponse {
  status?: string;
  results?: GoogleGeocodeResult[];
}

function placeFromGoogle(result: GoogleGeocodeResult | undefined): ResolvedPlace | null {
  if (!result?.formatted_address) return null;
  const components = result.address_components ?? [];
  const valueOf = (...types: string[]): string | undefined => {
    for (const type of types) {
      const component = components.find((item) => item.types?.includes(type));
      if (component?.long_name) return component.long_name;
    }
    return undefined;
  };
  return {
    address: result.formatted_address,
    city: valueOf(
      'locality',
      'postal_town',
      'sublocality_level_1',
      'administrative_area_level_2',
      'administrative_area_level_1',
    ),
    postalCode: valueOf('postal_code'),
  };
}

async function reverseGeocodeOsm(coords: GeoCoords): Promise<ResolvedPlace | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}` +
    `&lon=${coords.lng}&addressdetails=1&accept-language=id`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    if (!data.display_name) return null;
    const address = data.address ?? {};
    return {
      address: data.display_name,
      city:
        address.city ??
        address.town ??
        address.village ??
        address.municipality ??
        address.county ??
        address.state,
      postalCode: address.postcode,
    };
  } catch {
    return null;
  }
}

/**
 * Ubah koordinat menjadi alamat lengkap. Google Geocoding dipakai bila kunci
 * tersedia; bila gagal, fallback ke OpenStreetMap agar GPS tetap bisa mengisi
 * alamat tanpa konfigurasi tambahan.
 */
export async function reverseGeocodePlace(coords: GeoCoords): Promise<ResolvedPlace | null> {
  if (MAPS_API_KEY) {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}` +
      `&language=id&key=${encodeURIComponent(MAPS_API_KEY)}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as GoogleGeocodeResponse;
        if (data.status === 'OK') {
          const place = placeFromGoogle(data.results?.[0]);
          if (place) return place;
        }
      }
    } catch {
      // Lanjut ke fallback OpenStreetMap.
    }
  }
  return reverseGeocodeOsm(coords);
}

/** Versi ringkas yang hanya mengembalikan teks alamat. */
export async function reverseGeocode(coords: GeoCoords): Promise<string | null> {
  const place = await reverseGeocodePlace(coords);
  return place?.address ?? null;
}

async function geocodeOsm(query: string): Promise<GeoCoords | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
    `&q=${encodeURIComponent(query)}&accept-language=id`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const data = (await response.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return normalizeCoords({ lat: Number(data[0].lat), lng: Number(data[0].lon) });
  } catch {
    return null;
  }
}

/**
 * Ubah alamat yang diketik menjadi koordinat. Google Geocoding dipakai bila
 * kunci tersedia, lalu fallback ke OpenStreetMap.
 */
export async function geocodeAddress(address: string): Promise<GeoCoords | null> {
  const query = address.trim();
  if (!query) return null;
  if (MAPS_API_KEY) {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}` +
      `&language=id&key=${encodeURIComponent(MAPS_API_KEY)}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = (await response.json()) as GoogleGeocodeResponse;
        if (data.status === 'OK') {
          const point = normalizeCoords(data.results?.[0]?.geometry?.location);
          if (point) return point;
        }
      }
    } catch {
      // Lanjut ke fallback OpenStreetMap.
    }
  }
  return geocodeOsm(query);
}
