import { describe, expect, it } from 'vitest';
import { generateDefaultRab } from '../src/lib/rab';

function total(items: ReturnType<typeof generateDefaultRab>): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

describe('generateDefaultRab', () => {
  it('membuat RAB pembangunan rumah di atas tanah', () => {
    const items = generateDefaultRab('land-to-house', '', '', 4, 3);
    expect(items).toHaveLength(9);
    expect(items.map((item) => item.category)).toContain('Struktur');
    expect(items.map((item) => item.category)).toContain('Jasa');
    expect(total(items)).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.every((item) => item.included)).toBe(true);
  });

  it('menghitung biaya struktur dari luas tanah', () => {
    const items = generateDefaultRab('land-to-house', '', '', 10, 10);
    const pondasi = items.find((item) => item.name.includes('Pondasi'));
    expect(pondasi?.price).toBe(100 * 1_250_000);

    const kecil = generateDefaultRab('land-to-house', '', '', 2, 2);
    const pondasiKecil = kecil.find((item) => item.name.includes('Pondasi'));
    expect(pondasiKecil?.price).toBe(4 * 1_250_000);
  });

  it('membuat RAB kamar tidur tanpa TV dan dengan kasur', () => {
    const items = generateDefaultRab('room-makeover', 'Kamar Tidur', '', 5, 4);
    const names = items.map((item) => item.name).join(' | ');
    expect(names).toContain('Tempat Tidur');
    expect(names).toContain('Lemari Pakaian');
    expect(names).not.toContain('Smart TV');
    expect(names).toContain('Coffee Table');
    expect(total(items)).toBeGreaterThan(0);
  });

  it('membuat RAB ruang makan tanpa meja kopi', () => {
    const items = generateDefaultRab('room-makeover', 'Ruang Makan', 'tambah teko keramik');
    const names = items.map((item) => item.name).join(' | ');
    expect(names).toContain('Set Meja Makan');
    expect(names).toContain('Credenza');
    expect(names).toContain('Set Teko');
    expect(names).not.toContain('Coffee Table');
    expect(names).not.toContain('Smart TV');
  });

  it('membuat RAB ruang kerja dengan meja dan kursi kerja', () => {
    const items = generateDefaultRab('room-makeover', 'Ruang Kerja');
    const names = items.map((item) => item.name).join(' | ');
    expect(names).toContain('Meja Kerja');
    expect(names).toContain('Kursi Kerja');
    expect(names).toContain('Rak Buku');
    expect(names).not.toContain('Coffee Table');
  });

  it('menambahkan item sesuai kata kunci prompt', () => {
    const items = generateDefaultRab(
      'renovation',
      'Ruang Tamu',
      'gaya jepang dengan AC, lampu kayu, dan tanaman indoor',
    );
    const names = items.map((item) => item.name).join(' | ');
    expect(names).toContain('AC Inverter');
    expect(names).toContain('Standing Floor Lamp');
    expect(names).toContain('Tanaman Hias');
    expect(names).toContain('Rangka Kayu');
    expect(names).toContain('Meja Kopi Lesehan');
  });

  it('memakai lampu downlight bawaan saat prompt tidak menyebut lampu', () => {
    const items = generateDefaultRab('room-makeover', 'Ruang Tamu', '');
    const downlight = items.find((item) => item.name.includes('Downlight'));
    expect(downlight).toMatchObject({ price: 450_000, qty: 4, unit: 'titik' });
  });

  it('membulatkan biaya pengecatan dan perapihan dinding', () => {
    const items = generateDefaultRab('room-makeover', 'Ruang Tamu', '', 4, 3);
    const cat = items.find((item) => item.name.startsWith('Cat Dinding'));
    const plester = items.find((item) => item.name.startsWith('Perapihan Plesteran'));
    expect(cat?.price).toBe(1_190_000);
    expect(plester?.price).toBe(540_000);
  });

  it('memberi id unik pada setiap pemanggilan', () => {
    const first = generateDefaultRab('land-to-house');
    const second = generateDefaultRab('land-to-house');
    const ids = [...first, ...second].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});