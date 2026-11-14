import { useEffect, useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';

export function endOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

export interface CountdownParts {
  hours: string;
  minutes: string;
  seconds: string;
  done: boolean;
}

export function useCountdown(target?: Date): CountdownParts {
  const targetTime = useMemo(() => (target ?? endOfToday()).getTime(), [target]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const diff = Math.max(0, targetTime - now);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return {
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
    done: diff <= 0,
  };
}

interface Props {
  target?: Date;
  label?: string;
  tone?: 'light' | 'dark';
  className?: string;
}

export default function Countdown({ target, label = 'Berakhir dalam', tone = 'light', className = '' }: Props) {
  const { hours, minutes, seconds, done } = useCountdown(target);
  const boxClass =
    tone === 'dark'
      ? 'bg-white/20 text-white'
      : 'bg-slate-900 text-white';

  if (done) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
        <Clock3 className="h-3.5 w-3.5" />
        Promo berakhir
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`text-xs font-medium ${tone === 'dark' ? 'text-white/85' : 'text-slate-500'}`}>{label}</span>
      <span className="inline-flex items-center gap-1">
        {[hours, minutes, seconds].map((part, index) => (
          <span key={index} className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-bold tabular-nums ${boxClass}`}>
            {part}
          </span>
        ))}
      </span>
    </span>
  );
}
