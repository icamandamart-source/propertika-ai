import { describe, expect, it } from 'vitest';
import {
  formatArea,
  formatDate,
  formatNumberInput,
  formatRupiah,
  formatRupiahShort,
  formatSpecs,
  parseNumberInput,
  slugify,
} from '../src/lib/format';

describe('formatRupiah', () => {
  it('memformat angka sebagai rupiah tanpa desimal', () => {
    expect(formatRupiah(1_500_000)).toBe('Rp 1.500.000');
    expect(formatRupiah(1_500_000.6)).toBe('Rp 1.500.001');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(Number.NaN)).toBe('Rp 0');
    expect(formatRupiah(Number.POSITIVE_INFINITY)).toBe('Rp 0');
  });

  it('memakai satuan ringkas untuk kartu', () => {
    expect(formatRupiahShort(1_850_000_000)).toBe('Rp 1,9 M');
    expect(formatRupiahShort(800_000_000)).toBe('Rp 800 Jt');
    expect(formatRupiahShort(4_250_000)).toBe('Rp 4,3 Jt');
    expect(formatRupiahShort(385_000)).toBe('Rp 385 Rb');
    expect(formatRupiahShort(900)).toBe('Rp 900');
    expect(formatRupiahShort(0)).toBe('Hubungi penjual');
    expect(formatRupiahShort(Number.NaN)).toBe('Hubungi penjual');
  });
});

describe('formatArea', () => {
  it('menampilkan luas dengan satuan meter persegi', () => {
    expect(formatArea(120)).toBe('120 m²');
    expect(formatArea(1_250)).toBe('1.250 m²');
  });

  it('mengembalikan tanda hubung untuk nilai tidak valid', () => {
    expect(formatArea(0)).toBe('-');
    expect(formatArea(-5)).toBe('-');
    expect(formatArea(Number.NaN)).toBe('-');
  });
});

describe('formatDate', () => {
  it('memformat tanggal ISO menjadi tanggal Indonesia', () => {
    expect(formatDate('2026-11-06T12:00:00.000Z')).toBe('6 Nov 2026');
  });

  it('mengembalikan tanda hubung untuk tanggal tidak valid', () => {
    expect(formatDate('bukan-tanggal')).toBe('-');
  });
});

describe('formatSpecs', () => {
  it('menampilkan luas tanah untuk kategori Tanah', () => {
    expect(
      formatSpecs({ category: 'Tanah', bedrooms: 0, bathrooms: 0, landArea: 200, buildingArea: 0 }),
    ).toBe('LT 200 m²');
    expect(
      formatSpecs({ category: 'Tanah', bedrooms: 0, bathrooms: 0, landArea: 0, buildingArea: 0 }),
    ).toBe('Luas belum diisi');
  });

  it('menampilkan dimensi untuk kategori Furniture', () => {
    expect(
      formatSpecs({ category: 'Furniture', bedrooms: 0, bathrooms: 0, landArea: 0, buildingArea: 12 }),
    ).toBe('Dimensi 12 m²');
    expect(
      formatSpecs({ category: 'Furniture', bedrooms: 0, bathrooms: 0, landArea: 0, buildingArea: 0 }),
    ).toBe('Furniture');
  });

  it('merangkum kamar dan luas untuk rumah', () => {
    expect(
      formatSpecs({ category: 'Rumah', bedrooms: 3, bathrooms: 2, landArea: 120, buildingArea: 90 }),
    ).toBe('3 KT · 2 KM · LB 90 m² · LT 120 m²');
    expect(
      formatSpecs({ category: 'Rumah', bedrooms: 0, bathrooms: 0, landArea: 0, buildingArea: 0 }),
    ).toBe('Spesifikasi belum diisi');
  });
});

describe('slugify', () => {
  it('mengubah teks menjadi slug huruf kecil', () => {
    expect(slugify('Rumah Mewah — Jakarta!')).toBe('rumah-mewah-jakarta');
    expect(slugify('  Apartemen 2BR  ')).toBe('apartemen-2br');
    expect(slugify('Ça va?')).toBe('ca-va');
  });
});

describe('input angka', () => {
  it('memformat dan membaca kembali angka ribuan', () => {
    expect(formatNumberInput(1_500_000_000)).toBe('1.500.000.000');
    expect(formatNumberInput(0)).toBe('');
    expect(parseNumberInput('1.500.000.000')).toBe(1_500_000_000);
    expect(parseNumberInput('Rp 4.250.000')).toBe(4_250_000);
    expect(parseNumberInput('')).toBe(0);
  });
});