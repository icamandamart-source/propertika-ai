import { Star } from 'lucide-react';

interface Props {
  rating?: number;
  count?: number;
  size?: 'xs' | 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}

const SIZE = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
} as const;

export default function RatingStars({ rating = 0, count, size = 'xs', showValue, className = '' }: Props) {
  const value = Math.max(0, Math.min(5, rating || 0));
  const filled = Math.round(value);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="inline-flex items-center gap-0.5" aria-label={`Rating ${value.toFixed(1)} dari 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${SIZE[size]} ${
              star <= filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
            }`}
            aria-hidden="true"
          />
        ))}
      </span>
      {showValue && value > 0 && <span className="text-[11px] font-medium text-slate-500">{value.toFixed(1)}</span>}
      {typeof count === 'number' && count > 0 && (
        <span className="text-[11px] text-slate-400">({count})</span>
      )}
    </span>
  );
}
