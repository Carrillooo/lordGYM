'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export function SearchBox({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  // Debounce para no navegar en cada pulsación.
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = value.trim();
      router.replace(query ? `/coach/search?q=${encodeURIComponent(query)}` : '/coach/search', { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      <span className="sr-only">Buscar</span>
      <input
        type="search"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar jugadores, ejercicios, entrenamientos…"
        className="h-12 w-full rounded-xl border border-ink-700 bg-ink-900/80 pl-11 pr-4 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
      />
    </label>
  );
}
