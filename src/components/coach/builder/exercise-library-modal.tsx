'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ExerciseRow } from '@/types/db';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/domain/labels';
import { normalizeText as normalize } from '@/lib/text';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/cn';


/** Selector de la biblioteca de ejercicios con búsqueda y filtro por categoría. */
export function ExerciseLibraryModal({
  open,
  onClose,
  library,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  library: ExerciseRow[];
  onPick: (exerciseId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((value) => library.some((exercise) => exercise.category === value)),
    [library],
  );

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    return library.filter((exercise) => {
      if (category !== 'all' && exercise.category !== category) return false;
      if (!needle) return true;
      return (
        normalize(exercise.name).includes(needle) ||
        exercise.muscles.some((muscle) => normalize(muscle).includes(needle)) ||
        normalize(CATEGORY_LABELS[exercise.category]).includes(needle)
      );
    });
  }, [library, query, category]);

  return (
    <Modal open={open} onClose={onClose} title="Añadir ejercicio" description={`${library.length} ejercicios disponibles`} size="lg">
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <span className="sr-only">Buscar ejercicio</span>
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, músculo o categoría…"
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 pl-10 pr-3 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {['all', ...categories].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                category === value
                  ? 'border-volt-500 bg-volt-500 text-ink-950'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
              )}
            >
              {value === 'all' ? 'Todos' : CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]}
            </button>
          ))}
        </div>

        <ul className="max-h-[45dvh] space-y-1.5 overflow-y-auto">
          {results.length === 0 ? (
            <li className="py-8 text-center text-sm text-ink-500">Ningún ejercicio coincide.</li>
          ) : (
            results.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  onClick={() => onPick(exercise.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-left transition-colors hover:border-volt-500/40 hover:bg-ink-850"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-50">{exercise.name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {CATEGORY_LABELS[exercise.category]}
                      {exercise.muscles.length > 0 ? ` · ${exercise.muscles.slice(0, 2).join(', ')}` : ''}
                    </span>
                  </span>
                  {exercise.owner_coach_id ? (
                    <span className="shrink-0 rounded-full bg-data-500/12 px-2 py-0.5 text-[10px] font-medium text-data-500">
                      Propio
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}
