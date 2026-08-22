'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { ATHLETE_STATUS_LABELS } from '@/lib/domain/labels';
import { cn } from '@/lib/cn';

/** Filtros de la lista de jugadores (§57). El estado vive en la URL. */
export function RosterFilter({ teams }: { teams: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? 'all';
  const team = params.get('team') ?? 'all';

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all' || value === '') next.delete(key);
    else next.set(key, value);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  const statuses = ['all', 'active', 'fatigue', 'attention', 'inactive'] as const;

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
        <span className="sr-only">Buscar jugador</span>
        <input
          type="search"
          defaultValue={params.get('q') ?? ''}
          onChange={(event) => update('q', event.target.value)}
          placeholder="Buscar por nombre o posición…"
          className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900/80 pl-10 pr-3 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
        />
      </label>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {statuses.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => update('status', value)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              status === value
                ? 'border-volt-500 bg-volt-500 text-ink-950'
                : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
            )}
          >
            {value === 'all' ? 'Todos' : ATHLETE_STATUS_LABELS[value]}
          </button>
        ))}

        {teams.length > 0
          ? ['all', ...teams].map((value) => (
              <button
                key={`team-${value}`}
                type="button"
                onClick={() => update('team', value)}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  team === value
                    ? 'border-data-500 bg-data-500/15 text-data-500'
                    : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
                )}
              >
                {value === 'all' ? 'Todos los equipos' : value}
              </button>
            ))
          : null}
      </div>
    </div>
  );
}
