import type { ImageMode, RabItem } from '../types';

let idCounter = 1;
function makeId(): string {
  return `rab-${Date.now()}-${idCounter++}`;
}

export function generateDefaultRab(
  mode: ImageMode,
  presetLabel = '',
  promptText = '',
  panjang = 4,
  lebar = 3,
): RabItem[] {
  const luas = Math.max(1, Math.round(panjang * lebar * 10) / 10);
  const text = `${presetLabel} ${promptText}`.toLowerCase();
  const items: RabItem[] = [];

  const add = (
    name: string,
    category: RabItem['category'],
    price: number,
    qty = 1,
    unit = 'unit',
  ) => {
    items.push({
      id: makeId(),
      name,
      category,
      price,
      qty,
      unit,
      included: true,
    });
  };

  if (mode === 'land-to-house') {
    // Estimasi pembangunan rumah di atas tanah kavling
    add('Pekerjaan Pondasi Batu Kali & Struktur Beton Bertulang', 'Struktur', Math.round(luas * 1_250_000), 1, 'paket');
    add('Dinding Bata Ringan, Plester & Acian', 'Struktur', Math.round(luas * 750_000), 1, 'paket');
    add('Rangka Atap Baja Ringan & Genteng Metal/Keramik', 'Struktur', Math.round(luas * 600_000), 1, 'paket');
    add('Pemasangan Lantai Granit Tile 60x60 cm', 'Finishing & Cat', Math.round(luas * 380_000), 1, 'paket');
    add('Instalasi Kelistrikan & Lampu Downlight LED', 'Jasa', Math.round(luas * 250_000), 1, 'titik/paket');
    add('Instalasi Plumbing, Sanitasi & Saluran Air Bersih', 'Jasa', Math.round(luas * 200_000), 1, 'paket');
    add('Pengecatan Interior & Eksterior Weatherproof', 'Finishing & Cat', Math.round(luas * 220_000), 1, 'paket');
    add('Kusen Aluminium, Pintu Kayu Solid & Jendela Kaca', 'Finishing & Cat', 8_500_000, 1, 'set');
    add('Upah Tukang & Mandor Konstruksi Bangunan', 'Jasa', Math.round(luas * 650_000), 1, 'paket');
    return items;
  }

  // --- Kategori Ruang Tamu / Kamar Tidur / Interior Makeover ---
  const isBedroom = text.includes('kamar') || text.includes('tidur') || text.includes('kasur') || presetLabel === 'Kamar Tidur';
  const isDining = text.includes('makan') || text.includes('dining') || presetLabel === 'Ruang Makan';
  const isWorkspace = text.includes('kerja') || text.includes('kantor') || text.includes('desk') || presetLabel === 'Ruang Kerja';

  // 1. Elektronik (TV, AC, dsb)
  if (text.includes('tv') || text.includes('televisi') || (!isBedroom && !isDining && !isWorkspace)) {
    add('Smart TV 50 Inch 4K UHD Ultra Slim', 'Elektronik', 5_200_000, 1, 'unit');
    add('Backdrop Panel TV Dinding Minimalis Kayu', 'Furniture', 2_800_000, 1, 'unit');
  }

  if (text.includes('ac') || text.includes('pendingin')) {
    add('AC Inverter 1 PK Hemat Energi + Pasang', 'Elektronik', 4_200_000, 1, 'unit');
  }

  // 2. Tempat Duduk / Kasur Utama
  if (isBedroom) {
    add('Tempat Tidur Queen Size (160x200 cm) + Matras Pocket Spring', 'Furniture', 6_500_000, 1, 'set');
    add('Nakas Samping Tempat Tidur Kayu Natural', 'Furniture', 650_000, 2, 'unit');
    add('Lemari Pakaian 3 Pintu Sliding Minimalis', 'Furniture', 4_200_000, 1, 'unit');
  } else if (isDining) {
    add('Set Meja Makan Kayu Solid Jati/Oak + 6 Kursi', 'Furniture', 7_800_000, 1, 'set');
    add('Credenza / Buffet Samping Ruang Makan', 'Furniture', 2_600_000, 1, 'unit');
  } else if (isWorkspace) {
    add('Meja Kerja Minimalis Ergonomis 140x70 cm', 'Furniture', 2_400_000, 1, 'unit');
    add('Kursi Kerja Ergonomis Mesh Hydrolic', 'Furniture', 1_650_000, 1, 'unit');
    add('Rak Buku & Display Dokumen Dinding', 'Furniture', 1_850_000, 1, 'unit');
  } else {
    // Ruang Tamu / Keluarga
    const isJapanese = text.includes('jepang') || text.includes('japanese') || text.includes('kayu');
    add(
      isJapanese
        ? 'Sofa Minimalis 3-Seater Fabric Linen Rangka Kayu'
        : 'Sofa Minimalis 3-Seater Fabric Premium',
      'Furniture',
      4_800_000,
      1,
      'unit',
    );
  }

  // 3. Meja Kopi / Coffee Table
  if (!isDining && !isWorkspace) {
    const isJapanese = text.includes('jepang') || text.includes('kayu');
    add(
      isJapanese ? 'Meja Kopi Lesehan / Coffee Table Kayu Oak Solid' : 'Coffee Table Kayu & Kaca Minimalis',
      'Furniture',
      1_750_000,
      1,
      'unit',
    );
  }

  // 4. Teko / Gelas / Pernik Khusus
  if (text.includes('teko') || text.includes('teh') || text.includes('gelas')) {
    add('Set Teko & Cangkir Keramik Tradisional Jepang', 'Dekorasi', 380_000, 1, 'set');
  }

  // 5. Lampu & Pencahayaan
  if (text.includes('lampu') || text.includes('lighting')) {
    const lampName = text.includes('kayu')
      ? 'Standing Floor Lamp Sudut Nuansa Kayu Warm White'
      : 'Lampu Sudut Standing Modern Minimalis';
    add(lampName, 'Dekorasi', 850_000, 1, 'unit');
  } else {
    add('Lampu Plafon Downlight LED Warm White', 'Dekorasi', 450_000, 4, 'titik');
  }

  // 6. Karpet & Tekstil
  add('Karpet Area Tenun Minimalis (160x230 cm)', 'Dekorasi', 1_250_000, 1, 'lembar');

  if (text.includes('tanaman') || text.includes('plant')) {
    add('Tanaman Hias Monstera/Palem Indoor + Pot Keramik', 'Dekorasi', 350_000, 2, 'pot');
  }

  // 7. Finishing & Perbaikan Dinding berdasarkan Luas (P x L)
  const dindingArea = Math.round(luas * 2.8);
  add(
    `Cat Dinding Interior Premium & Primer Anti-Jamur (~${dindingArea} m²)`,
    'Finishing & Cat',
    Math.max(650_000, Math.round((dindingArea * 35_000) / 10000) * 10000),
    1,
    'paket',
  );

  add(
    `Perapihan Plesteran & Acian Dinding Rusak/Mengelupas (${luas} m²)`,
    'Finishing & Cat',
    Math.max(500_000, Math.round((luas * 45_000) / 10000) * 10000),
    1,
    'paket',
  );

  // 8. Jasa & Pemasangan
  add('Jasa Tukang Bangunan & Pemasangan Furnitur Interior (2 Hari)', 'Jasa', 1_400_000, 1, 'jasa');

  return items;
}
