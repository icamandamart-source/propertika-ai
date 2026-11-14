import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, History, Search, Sparkles, X } from 'lucide-react';
import { useAppState } from '../lib/store';
import { storeNameOf } from '../lib/marketplace';

const HISTORY_KEY = 'propertika:search-history';
const POPULAR = ['Rumah minimalis', 'Sofa', 'Apartemen Jakarta', 'Tanah BSD', 'Meja kerja', 'Villa Bali'];

function readHistory(): string[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}

interface Props {
  placeholder?: string;
  className?: string;
}

export default function SearchBox({ placeholder = 'Cari rumah, apartemen, furniture…', className = '' }: Props) {
  const { listings } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setHistory(readHistory()), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const suggestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    const seen = new Set<string>();
    return listings
      .filter((listing) =>
        [listing.title, listing.city, listing.location, listing.category, storeNameOf(listing), listing.brand ?? '']
          .join(' ')
          .toLowerCase()
          .includes(keyword),
      )
      .filter((listing) => {
        if (seen.has(listing.title)) return false;
        seen.add(listing.title);
        return true;
      })
      .slice(0, 6);
  }, [listings, query]);

  const remember = (value: string) => {
    const keyword = value.trim();
    if (!keyword) return;
    const next = [keyword, ...history.filter((item) => item.toLowerCase() !== keyword.toLowerCase())].slice(0, 8);
    setHistory(next);
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // abaikan bila penyimpanan penuh
    }
  };

  const go = (value: string) => {
    const keyword = value.trim();
    if (keyword) remember(keyword);
    setOpen(false);
    navigate(keyword ? `/properti?q=${encodeURIComponent(keyword)}` : '/properti');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    go(query);
  };

  const showPanel = open && (query.trim().length > 0 || history.length > 0);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <form onSubmit={submit} role="search">
        <div className="flex items-center overflow-hidden rounded-xl border-2 border-brand bg-white shadow-sm">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Cari produk"
            className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus kata kunci"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Cari"
            className="m-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition hover:bg-brand-dark sm:px-4"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </div>
      </form>

      {showPanel && (
        <div className="fade-in absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {query.trim() ? (
            <div>
              <button
                type="button"
                onClick={() => go(query)}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-brand-dark transition hover:bg-brand-soft"
              >
                <Search className="h-4 w-4" />
                Cari &ldquo;{query.trim()}&rdquo;
              </button>
              {suggestions.length > 0 ? (
                <ul className="py-1">
                  {suggestions.map((listing) => (
                    <li key={listing.id}>
                      <button
                        type="button"
                        onClick={() => {
                          remember(listing.title);
                          setOpen(false);
                          navigate(`/properti/${listing.id}`);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-50"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">{listing.title}</span>
                          <span className="block truncate text-[11px] text-slate-400">
                            {storeNameOf(listing)} · {listing.city}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-center text-xs text-slate-400">Tidak ada saran. Tekan Enter untuk mencari.</p>
              )}
            </div>
          ) : (
            <div className="p-3">
              {history.length > 0 && (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <History className="h-3.5 w-3.5" />
                      Terakhir dicari
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHistory([]);
                        try {
                          window.localStorage.removeItem(HISTORY_KEY);
                        } catch {
                          // abaikan
                        }
                      }}
                      className="text-[11px] font-medium text-slate-400 hover:text-brand-dark"
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {history.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => go(item)}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-brand-soft hover:text-brand-dark"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <span className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Sparkles className="h-3.5 w-3.5" />
                Pencarian populer
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => go(item)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand hover:text-brand-dark"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
