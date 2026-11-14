import { Armchair, Hammer, TreeDeciduous } from 'lucide-react';
import AIImageTool from '../components/AIImageTool';

export function AILandToHousePage() {
  return (
    <AIImageTool
      mode="land-to-house"
      title="AI Land to House"
      description="Unggah foto lahan kosong, dan lihat bagaimana sebuah rumah berdiri di atasnya — lengkap dengan bayangan dan sudut kamera yang sama."
      icon={TreeDeciduous}
      uploadLabel="Unggah foto lahan"
      uploadHint="Foto sebaiknya memperlihatkan batas lahan dan lingkungan sekitarnya."
      presets={[
        {
          label: 'Tropis Modern',
          prompt:
            'modern tropical two-storey house with large glass windows, wood slat screens, terracotta roof, tropical landscaping.',
        },
        {
          label: 'Minimalis Putih',
          prompt: 'white minimalist two-storey house, clean geometric lines, flat roof, floor-to-ceiling windows, tidy lawn.',
        },
        {
          label: 'Klasik Kolonial',
          prompt: 'colonial style house with white columns, pitched clay roof, wide veranda, mature garden.',
        },
      ]}
    />
  );
}

export function AIHomeRenovationPage() {
  return (
    <AIImageTool
      mode="renovation"
      title="AI Home Renovation"
      description="Simulasikan hasil renovasi sebelum mengeluarkan biaya. Struktur dan sudut bangunan tetap dipertahankan."
      icon={Hammer}
      uploadLabel="Unggah foto bangunan"
      uploadHint="Gunakan foto tampak depan atau ruangan yang ingin direnovasi."
      presets={[
        {
          label: 'Fasad Modern',
          prompt: 'renovate the facade into a modern design: clean plaster finish, dark window frames, minimalist carport, new paving.',
        },
        {
          label: 'Interior Terang',
          prompt: 'renovate the interior to be bright and airy: white walls, new flooring, recessed lighting, built-in storage.',
        },
        {
          label: 'Rustic Hangat',
          prompt: 'renovate with warm rustic character: natural stone accents, warm wood, pendant lighting, greenery.',
        },
      ]}
    />
  );
}

export function AIFurnitureSimulatorPage() {
  return (
    <AIImageTool
      mode="furniture"
      title="AI Furniture Simulator"
      description="Lihat bagaimana furniture tertentu terlihat di dalam ruangan Anda, lengkap dengan perspektif dan bayangan yang wajar."
      icon={Armchair}
      uploadLabel="Unggah foto ruangan"
      uploadHint="Foto ruangan yang masih kosong memberi hasil paling akurat."
      presets={[
        { label: 'Ruang Tamu', prompt: 'add a three-seater fabric sofa, a low coffee table, a rug, and a floor lamp.' },
        { label: 'Kamar Tidur', prompt: 'add a queen bed with linen bedding, two nightstands, and soft bedside lamps.' },
        { label: 'Ruang Makan', prompt: 'add a solid wood dining table with six chairs and a pendant light above it.' },
        { label: 'Ruang Kerja', prompt: 'add a wooden desk, an ergonomic chair, a bookshelf, and a desk lamp.' },
      ]}
    />
  );
}
