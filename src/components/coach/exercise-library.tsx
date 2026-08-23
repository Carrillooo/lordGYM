'use client';

import { useActionState, useMemo, useState } from 'react';
import { Dumbbell, Pencil, Plus, Search, Trash2, Video } from 'lucide-react';
import type { ExerciseRow } from '@/types/db';
import type { MediaMode } from '@/lib/media/types';
import { createExerciseAction, deleteExerciseAction, updateExerciseAction } from '@/lib/actions/exercises';
import { idleState } from '@/lib/actions/state';
import { CATEGORY_LABELS, CATEGORY_ORDER, METRIC_LABELS } from '@/lib/domain/labels';
import { normalizeText } from '@/lib/text';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { ExerciseFigureFrame } from '@/components/exercise/exercise-figure';
import { ExerciseDetailModal } from '@/components/exercise/exercise-detail';
import { cn } from '@/lib/cn';

export function ExerciseLibrary({
  exercises,
  coachId,
  videos,
  mediaMode,
}: {
  exercises: ExerciseRow[];
  coachId: string;
  /** Vídeos que este entrenador ha subido, por id de ejercicio. */
  videos: Record<string, string>;
  mediaMode: MediaMode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [scope, setScope] = useState<'all' | 'own'>('all');
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [viewing, setViewing] = useState<ExerciseRow | null>(null);
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => {
    const needle = normalizeText(query);
    return exercises.filter((exercise) => {
      if (category !== 'all' && exercise.category !== category) return false;
      if (scope === 'own' && exercise.owner_coach_id !== coachId) return false;
      if (!needle) return true;
      return (
        normalizeText(exercise.name).includes(needle) ||
        exercise.muscles.some((muscle) => normalizeText(muscle).includes(needle)) ||
        normalizeText(CATEGORY_LABELS[exercise.category]).includes(needle)
      );
    });
  }, [exercises, query, category, scope, coachId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <span className="sr-only">Buscar ejercicio</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ejercicio…"
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900/80 pl-10 pr-3 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          Crear ejercicio
        </Button>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setScope(scope === 'own' ? 'all' : 'own')}
          className={cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            scope === 'own'
              ? 'border-data-500 bg-data-500/15 text-data-500'
              : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
          )}
        >
          Sólo míos
        </button>
        {['all', ...CATEGORY_ORDER].map((value) => (
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
            {value === 'all' ? 'Todas' : CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="Ningún ejercicio coincide"
          description="Cambia el filtro o crea un ejercicio propio."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Crear ejercicio
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <Card className="flex h-full flex-col">
                <button
                  type="button"
                  onClick={() => setViewing(exercise)}
                  className="-m-1 rounded-xl p-1 text-left transition-colors hover:bg-ink-800/40"
                  aria-label={`Ver la ficha de ${exercise.name}`}
                >
                  <ExerciseFigureFrame
                    figureKey={exercise.figure_key}
                    category={exercise.category}
                    className="aspect-[10/7] w-full"
                  />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight text-ink-50">{exercise.name}</h2>
                    {exercise.owner_coach_id === coachId ? <Badge tone="data">Propio</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {CATEGORY_LABELS[exercise.category]}
                    {exercise.movement_type ? ` · ${exercise.movement_type}` : ''}
                  </p>
                  {exercise.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-400">{exercise.description}</p>
                  ) : null}
                </button>

                {exercise.muscles.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {exercise.muscles.slice(0, 3).map((muscle) => (
                      <Badge key={muscle}>{muscle}</Badge>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="text-xs text-ink-500">{METRIC_LABELS[exercise.metric_type]}</span>
                  <div className="flex items-center gap-1">
                    {videos[exercise.id] || exercise.video_url ? (
                      <button
                        type="button"
                        onClick={() => setViewing(exercise)}
                        aria-label="Ver vídeo de técnica"
                        className="rounded-lg p-1.5 text-volt-500 transition-colors hover:bg-ink-800"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                    ) : null}
                    {exercise.owner_coach_id === coachId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(exercise)}
                          aria-label="Editar ejercicio"
                          className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <form action={deleteExerciseAction}>
                          <input type="hidden" name="exerciseId" value={exercise.id} />
                          <button
                            type="submit"
                            aria-label="Eliminar ejercicio"
                            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-danger-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ExerciseDetailModal
        exercise={viewing}
        videoUrl={viewing ? (videos[viewing.id] ?? viewing.video_url) : null}
        mediaMode={mediaMode}
        onClose={() => setViewing(null)}
      />
      <ExerciseFormModal open={creating} onClose={() => setCreating(false)} />
      <ExerciseFormModal open={editing !== null} onClose={() => setEditing(null)} exercise={editing ?? undefined} />
    </div>
  );
}

function ExerciseFormModal({
  open,
  onClose,
  exercise,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: ExerciseRow;
}) {
  const action = exercise ? updateExerciseAction : createExerciseAction;
  const [state, formAction] = useActionState(action, idleState);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      description="Los campos con vídeo y técnica los verá el jugador durante la sesión."
    >
      <form action={formAction} className="space-y-4">
        {exercise ? <input type="hidden" name="exerciseId" value={exercise.id} /> : null}

        <Input label="Nombre" name="name" required defaultValue={exercise?.name ?? ''} error={state.fieldErrors?.name} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Categoría" name="category" defaultValue={exercise?.category ?? 'pecho'}>
            {CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select label="Tipo de registro" name="metricType" defaultValue={exercise?.metric_type ?? 'strength'}>
            {Object.entries(METRIC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Tipo de movimiento"
          name="movementType"
          defaultValue={exercise?.movement_type ?? ''}
          placeholder="Empuje horizontal"
        />
        <Input
          label="Músculos (separados por coma)"
          name="muscles"
          defaultValue={exercise?.muscles.join(', ') ?? ''}
          placeholder="Pectoral, Tríceps"
        />
        <Input
          label="Material (separado por coma)"
          name="equipment"
          defaultValue={exercise?.equipment.join(', ') ?? ''}
          placeholder="Barra, Banco"
        />
        <Textarea label="Descripción" name="description" defaultValue={exercise?.description ?? ''} rows={2} />
        <Textarea label="Notas técnicas" name="technique" defaultValue={exercise?.technique ?? ''} rows={2} />
        <Input
          label="Vídeo de referencia (URL)"
          name="videoUrl"
          type="url"
          defaultValue={exercise?.video_url ?? ''}
          placeholder="https://…"
          error={state.fieldErrors?.videoUrl}
        />
        <Input
          label="Imagen (URL)"
          name="imageUrl"
          type="url"
          defaultValue={exercise?.image_url ?? ''}
          placeholder="https://…"
          error={state.fieldErrors?.imageUrl}
        />

        {state.status !== 'idle' && state.message ? (
          <p className={state.status === 'error' ? 'text-sm text-danger-500' : 'text-sm text-success-500'}>
            {state.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitButton pendingLabel="Guardando…">{exercise ? 'Guardar cambios' : 'Crear ejercicio'}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
