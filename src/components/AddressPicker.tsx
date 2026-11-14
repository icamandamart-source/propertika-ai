import { useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import type { GeoCoords } from '../types';
import {
  geocodeAddress,
  getCurrentCoords,
  mapsEmbedUrl,
  mapsSearchUrl,
  reverseGeocodePlace,
} from '../lib/geo';

interface Props {
  address: string;
  coords: GeoCoords | null;
  onAddressChange: (value: string) => void;
  onCoordsChange: (coords: GeoCoords | null) => void;
  onCityChange?: (city: string) => void;
  onPostalCodeChange?: (postalCode: string) => void;
  label?: string;
  placeholder?: string;
  inputClassName?: string;
  labelClassName?: string;
  hint?: string;
}

const defaultInput =
  'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';
const defaultLabel = 'mb-1.5 block text-sm font-medium text-slate-700';

/**
 * Input alamat lengkap dengan bantuan lokasi: deteksi GPS, cari titik dari
 * alamat, dan pratinjau peta. Alamat tetap bisa diketik manual.
 */
export default function AddressPicker({
  address,
  coords,
  onAddressChange,
  onCoordsChange,
  onCityChange,
  onPostalCodeChange,
  label,
  placeholder = 'Jalan, nomor, kelurahan, kecamatan, kota',
  inputClassName,
  labelClassName,
  hint,
}: Props) {
  const [busy, setBusy] = useState<'gps' | 'search' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const detect = async () => {
    setBusy('gps');
    setNote(null);
    try {
      const point = await getCurrentCoords();
      onCoordsChange(point);
      const place = await reverseGeocodePlace(point);
      if (place) {
        onAddressChange(place.address);
        if (place.city) onCityChange?.(place.city);
        if (place.postalCode) onPostalCodeChange?.(place.postalCode);
      }
      setNote(
        place
          ? 'Lokasi dan alamat terisi otomatis.'
          : 'Titik lokasi tersimpan. Lengkapi alamat secara manual bila perlu.',
      );
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'Gagal mendeteksi lokasi.');
    } finally {
      setBusy(null);
    }
  };

  const search = async () => {
    if (!address.trim()) {
      setNote('Isi alamat dulu untuk mencari titik di peta.');
      return;
    }
    setBusy('search');
    setNote(null);
    try {
      const point = await geocodeAddress(address);
      if (point) {
        onCoordsChange(point);
        setNote('Titik lokasi ditemukan dari alamat.');
      } else {
        setNote('Alamat tidak ditemukan. Coba tulis lebih spesifik atau gunakan tombol lokasi saya.');
      }
    } catch {
      setNote('Gagal mencari alamat.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {label && <span className={labelClassName ?? defaultLabel}>{label}</span>}

      <input
        className={inputClassName ?? defaultInput}
        value={address}
        onChange={(event) => onAddressChange(event.target.value)}
        placeholder={placeholder}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={detect}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === 'gps' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          Gunakan lokasi saya
        </button>
        <button
          type="button"
          onClick={search}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Cari di peta
        </button>
        {coords && (
          <button
            type="button"
            onClick={() => {
              onCoordsChange(null);
              setNote(null);
            }}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            Hapus titik
          </button>
        )}
      </div>

      {(hint || note) && (
        <p className="mt-1 block text-xs text-slate-400">{note ?? hint}</p>
      )}

      {coords && (
        <>
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <iframe
              title="Pratinjau peta lokasi"
              src={mapsEmbedUrl(coords)}
              className="h-40 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} ·{' '}
            <a
              href={mapsSearchUrl(coords)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-900 hover:underline"
            >
              Buka di Google Maps
            </a>
          </p>
        </>
      )}
    </div>
  );
}
