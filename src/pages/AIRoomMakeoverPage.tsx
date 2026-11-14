import { PaintBucket } from 'lucide-react';
import AIImageTool from '../components/AIImageTool';

export default function AIRoomMakeoverPage() {
  return (
    <AIImageTool
      mode="room-makeover"
      title="AI Room Makeover"
      description="Unggah foto ruangan kosong, lalu pilih gaya. AI akan mengisinya dengan perabot dan dekorasi tanpa mengubah struktur ruangan."
      icon={PaintBucket}
      uploadLabel="Unggah foto ruangan"
      uploadHint="Ambil foto dari sudut ruangan yang jelas, pastikan pencahayaan cukup."
      presets={[
        {
          label: 'Minimalis Jepang',
          prompt: 'Japanese minimalist style: light oak wood, beige linen, low-profile furniture, paper lantern lighting, a few green plants.',
        },
        {
          label: 'Skandinavia',
          prompt: 'Scandinavian style: white walls, pale wood floor, cozy textiles, simple functional furniture, soft daylight.',
        },
        {
          label: 'Industrial',
          prompt: 'Industrial loft style: exposed concrete, black metal frames, cognac leather sofa, Edison bulb lighting.',
        },
        {
          label: 'Mewah Modern',
          prompt: 'Modern luxury style: marble surfaces, brass accents, velvet upholstery, statement chandelier, warm ambient lighting.',
        },
      ]}
    />
  );
}
