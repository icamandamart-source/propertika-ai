import { Link } from 'react-router-dom';
import {
  Armchair,
  Calculator,
  FileText,
  Hammer,
  PaintBucket,
  Sparkles,
  TreeDeciduous,
} from 'lucide-react';
import AiStatusBanner from '../components/AiStatusBanner';
import { useAiHealth } from '../lib/useAiHealth';

const TOOLS = [
  {
    title: 'AI Deskripsi Properti',
    icon: FileText,
    description: 'Ubah data properti menjadi iklan siap tayang dalam hitungan detik.',
    path: '/ai-deskripsi',
    kind: 'text' as const,
  },
  {
    title: 'AI Room Makeover',
    icon: PaintBucket,
    description: 'Foto ruangan kosong diubah menjadi ruangan berperabot yang realistis.',
    path: '/ai-room-makeover',
    kind: 'image' as const,
  },
  {
    title: 'AI Land to House',
    icon: TreeDeciduous,
    description: 'Lihat gambaran rumah yang bisa dibangun di atas lahan kosong Anda.',
    path: '/ai-land-to-house',
    kind: 'image' as const,
  },
  {
    title: 'AI Home Renovation',
    icon: Hammer,
    description: 'Simulasikan wajah baru rumah lama sebelum benar-benar direnovasi.',
    path: '/ai-home-renovation',
    kind: 'image' as const,
  },
  {
    title: 'AI Furniture Simulator',
    icon: Armchair,
    description: 'Coba penempatan furniture di ruangan Anda secara visual.',
    path: '/ai-furniture-simulator',
    kind: 'image' as const,
  },
  {
    title: 'Kalkulator KPR',
    icon: Calculator,
    description: 'Hitung cicilan bulanan, total bunga, dan dampak uang muka.',
    path: '/kalkulator-kpr',
    kind: 'local' as const,
  },
];

export default function AIStudioPage() {
  const health = useAiHealth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900 text-white">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">AI Property Studio</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enam alat bantu untuk mempercepat pekerjaan jual-beli properti.
          </p>
        </div>
      </div>

      <div className="mb-8">
        <AiStatusBanner health={health} />
        <AiStatusBanner health={health} capability="image" showStorage />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const isImageTool = tool.kind === 'image';
          const isTextTool = tool.kind === 'text';
          const isImageReady = health
            ? (health.imageProvider ?? (health.aiEnabled ? 'gemini' : 'none')) !== 'none'
            : true;
          const isTextReady = health ? health.aiEnabled : true;
          const isReady = isImageTool ? isImageReady : isTextTool ? isTextReady : true;
          const needsKey = !isReady;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <tool.icon className="h-10 w-10 text-emerald-900" />
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    needsKey ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {needsKey ? 'Butuh API key' : 'Aktif'}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{tool.title}</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600">{tool.description}</p>
              <span className="mt-4 text-sm font-semibold text-emerald-900 group-hover:text-emerald-700">
                Coba sekarang →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
