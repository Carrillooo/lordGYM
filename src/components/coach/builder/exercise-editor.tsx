'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ExerciseRow, SetType, WorkoutExerciseRow, WorkoutSetRow } from '@/types/db';
import { saveExerciseConfigAction } from '@/lib/actions/workouts';
import { SET_TYPE_LABELS, SET_TYPE_ORDER } from '@/lib/domain/labels';
import { cn } from '@/lib/cn';

export interface EditableSet {
  setIndex: number;
  setType: SetType;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetPercent1rm: number | null;
  targetRpe: number | null;
  targetRir: number | null;
  targetDurationSeconds: number | null;
  targetDistanceM: number | null;
  targetVelocityMs: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export function toEditableSet(row: WorkoutSetRow): EditableSet {
  return {
    setIndex: row.set_index,
    setType: row.set_type,
    targetReps: row.target_reps,
    targetWeightKg: row.target_weight_kg,
    targetPercent1rm: row.target_percent_1rm,
    targetRpe: row.target_rpe,
    targetRir: row.target_rir,
    targetDurationSeconds: row.target_duration_seconds,
    targetDistanceM: row.target_distance_m,
    targetVelocityMs: row.target_velocity_ms,
    restSeconds: row.rest_seconds,
    notes: row.notes,
  };
}

const PRESETS: { label: string; sets: number; reps: number }[] = [
  { label: '3 × 12', sets: 3, reps: 12 },
  { label: '4 × 8', sets: 4, reps: 8 },
  { label: '4 × 6', sets: 4, reps: 6 },
  { label: '5 × 5', sets: 5, reps: 5 },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Editor de un ejercicio dentro del constructor. Autoguarda 700 ms después del
 * último cambio y muestra el estado, para no obligar a pulsar «Guardar» (§81).
 */
export function ExerciseEditor({
  workoutId,
  workoutExercise,
  exercise,
  initialSets,
  index,
  total,
  onMove,
  onRemove,
  onDuplicate,
  dragHandlers,
  isDragging,
}: {
  workoutId: string;
  workoutExercise: WorkoutExerciseRow;
  exercise: ExerciseRow;
  initialSets: WorkoutSetRow[];
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (workoutExerciseId: string) => void;
  onDuplicate: (workoutExerciseId: string) => void;
  dragHandlers: {
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
  };
  isDragging: boolean;
}) {
  const [sets, setSets] = useState<EditableSet[]>(() => initialSets.map(toEditableSet));
  const [rest, setRest] = useState(workoutExercise.rest_seconds);
  const [tempo, setTempo] = useState(workoutExercise.tempo ?? '');
  const [notes, setNotes] = useState(workoutExercise.notes ?? '');
  const [superset, setSuperset] = useState(workoutExercise.superset_group ?? '');
  const [open, setOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const skipFirstSave = useRef(true);

  const showWeight = exercise.metric_type === 'strength';
  const showReps = ['strength', 'bodyweight', 'jump'].includes(exercise.metric_type);
  const showDuration = ['time', 'cardio', 'jump'].includes(exercise.metric_type);
  const showDistance = ['distance', 'cardio'].includes(exercise.metric_type);

  const payload = useMemo(
    () => ({
      workoutId,
      workoutExerciseId: workoutExercise.id,
      restSeconds: rest,
      tempo: tempo.trim() || null,
      notes: notes.trim() || null,
      supersetGroup: superset.trim().toUpperCase() || null,
      sets: sets.map((set, i) => ({ ...set, setIndex: i + 1 })),
    }),
    [workoutId, workoutExercise.id, rest, tempo, notes, superset, sets],
  );

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    setSaveState('saving');
    const timer = setTimeout(async () => {
      const result = await saveExerciseConfigAction(payload);
      if (result.status === 'success') {
        setSaveState('saved');
        setErrorMessage(null);
        setTimeout(() => setSaveState((current) => (current === 'saved' ? 'idle' : current)), 2200);
      } else {
        setSaveState('error');
        setErrorMessage(result.message ?? 'No se ha podido guardar.');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [payload]);

  const updateSet = useCallback((setIndex: number, patch: Partial<EditableSet>) => {
    setSets((current) => current.map((set, i) => (i === setIndex ? { ...set, ...patch } : set)));
  }, []);

  function addSet() {
    setSets((current) => {
      const last = current[current.length - 1];
      return [...current, { ...(last ?? emptySet()), setIndex: current.length + 1 }];
    });
  }

  function removeSet(setIndex: number) {
    setSets((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== setIndex)));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setSets((current) => {
      const reference = current[0] ?? emptySet();
      return Array.from({ length: preset.sets }, (_, i) => ({
        ...reference,
        setIndex: i + 1,
        setType: 'normal' as SetType,
        targetReps: preset.reps,
      }));
    });
  }

  return (
    <li
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragEnter={dragHandlers.onDragEnter}
      onDragEnd={dragHandlers.onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      className={cn(
        'card overflow-hidden p-0 transition-opacity',
        isDragging && 'opacity-50 ring-1 ring-volt-500',
      )}
    >
      <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-900/50 px-3 py-2.5">
        <span
          className="hidden cursor-grab rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-200 sm:inline-flex"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="metric flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-xs text-ink-300">
          {index + 1}
        </span>

        <button type="button" onClick={() => setOpen((value) => !value)} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-semibold text-ink-50">{exercise.name}</span>
          <span className="block truncate text-xs text-ink-400">
            {summarize(sets, exercise.metric_type)} · descanso {formatRest(rest)}
            {superset ? ` · superserie ${superset.toUpperCase()}` : ''}
          </span>
        </button>

        <SaveIndicator state={saveState} />

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label="Subir ejercicio"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label="Bajar ejercicio"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(workoutExercise.id)}
            aria-label="Duplicar ejercicio"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(workoutExercise.id)}
            aria-label="Eliminar ejercicio"
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-danger-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="space-y-4 px-3 py-4 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs font-medium text-ink-300 transition-colors hover:border-volt-500 hover:text-volt-500"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                  <th scope="col" className="pb-2 pr-2 font-medium">#</th>
                  <th scope="col" className="pb-2 pr-2 font-medium">Tipo</th>
                  {showReps ? <th scope="col" className="pb-2 pr-2 font-medium">Reps</th> : null}
                  {showWeight ? <th scope="col" className="pb-2 pr-2 font-medium">Kg</th> : null}
                  {showWeight ? <th scope="col" className="pb-2 pr-2 font-medium">%1RM</th> : null}
                  {showDuration ? <th scope="col" className="pb-2 pr-2 font-medium">Seg</th> : null}
                  {showDistance ? <th scope="col" className="pb-2 pr-2 font-medium">Metros</th> : null}
                  <th scope="col" className="pb-2 pr-2 font-medium">RPE</th>
                  <th scope="col" className="pb-2 pr-2 font-medium">RIR</th>
                  <th scope="col" className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sets.map((set, setIndex) => (
                  <tr key={setIndex} className="border-t border-ink-850">
                    <td className="py-1.5 pr-2 text-ink-400">{setIndex + 1}</td>
                    <td className="py-1.5 pr-2">
                      <select
                        aria-label={`Tipo de serie ${setIndex + 1}`}
                        value={set.setType}
                        onChange={(event) => updateSet(setIndex, { setType: event.target.value as SetType })}
                        className="h-9 w-full min-w-28 rounded-lg border border-ink-700 bg-ink-900 px-2 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
                      >
                        {SET_TYPE_ORDER.map((type) => (
                          <option key={type} value={type}>
                            {SET_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    {showReps ? (
                      <NumberCell
                        label={`Repeticiones serie ${setIndex + 1}`}
                        value={set.targetReps}
                        onChange={(value) => updateSet(setIndex, { targetReps: value })}
                      />
                    ) : null}
                    {showWeight ? (
                      <NumberCell
                        label={`Peso serie ${setIndex + 1}`}
                        value={set.targetWeightKg}
                        step={0.5}
                        onChange={(value) => updateSet(setIndex, { targetWeightKg: value })}
                      />
                    ) : null}
                    {showWeight ? (
                      <NumberCell
                        label={`Porcentaje 1RM serie ${setIndex + 1}`}
                        value={set.targetPercent1rm}
                        onChange={(value) => updateSet(setIndex, { targetPercent1rm: value })}
                      />
                    ) : null}
                    {showDuration ? (
                      <NumberCell
                        label={`Duración serie ${setIndex + 1}`}
                        value={set.targetDurationSeconds}
                        onChange={(value) => updateSet(setIndex, { targetDurationSeconds: value })}
                      />
                    ) : null}
                    {showDistance ? (
                      <NumberCell
                        label={`Distancia serie ${setIndex + 1}`}
                        value={set.targetDistanceM}
                        onChange={(value) => updateSet(setIndex, { targetDistanceM: value })}
                      />
                    ) : null}
                    <NumberCell
                      label={`RPE serie ${setIndex + 1}`}
                      value={set.targetRpe}
                      step={0.5}
                      onChange={(value) => updateSet(setIndex, { targetRpe: value })}
                    />
                    <NumberCell
                      label={`RIR serie ${setIndex + 1}`}
                      value={set.targetRir}
                      onChange={(value) => updateSet(setIndex, { targetRir: value })}
                    />
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeSet(setIndex)}
                        disabled={sets.length <= 1}
                        aria-label={`Eliminar serie ${setIndex + 1}`}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-800 hover:text-danger-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addSet}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:border-volt-500 hover:text-volt-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir serie
          </button>

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Descanso (seg)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={15}
                value={rest}
                onChange={(event) => setRest(Number(event.target.value) || 0)}
                className="h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-sm text-ink-100 focus:border-volt-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Tempo</span>
              <input
                type="text"
                value={tempo}
                placeholder="3-1-X"
                onChange={(event) => setTempo(event.target.value)}
                className="h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-sm text-ink-100 focus:border-volt-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Superserie</span>
              <input
                type="text"
                maxLength={2}
                value={superset}
                placeholder="A"
                onChange={(event) => setSuperset(event.target.value)}
                className="h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-sm uppercase text-ink-100 focus:border-volt-500 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-ink-500">Notas</span>
              <input
                type="text"
                value={notes}
                placeholder="Indicación para el jugador"
                onChange={(event) => setNotes(event.target.value)}
                className="h-10 w-full rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-sm text-ink-100 focus:border-volt-500 focus:outline-none"
              />
            </label>
          </div>

          {errorMessage ? <p className="text-xs text-danger-500">{errorMessage}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

function NumberCell({
  value,
  onChange,
  step = 1,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  label: string;
}) {
  return (
    <td className="py-1.5 pr-2">
      <input
        type="number"
        aria-label={label}
        inputMode="decimal"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="tabular h-9 w-20 rounded-lg border border-ink-700 bg-ink-900 px-2 text-sm text-ink-100 focus:border-volt-500 focus:outline-none"
      />
    </td>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-500">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success-500">
        <Check className="h-3 w-3" />
        Guardado
      </span>
    );
  }
  return <span className="shrink-0 text-xs font-medium text-danger-500">Error</span>;
}

function emptySet(): EditableSet {
  return {
    setIndex: 1,
    setType: 'normal',
    targetReps: 10,
    targetWeightKg: null,
    targetPercent1rm: null,
    targetRpe: null,
    targetRir: null,
    targetDurationSeconds: null,
    targetDistanceM: null,
    targetVelocityMs: null,
    restSeconds: null,
    notes: null,
  };
}

function summarize(sets: EditableSet[], metricType: string): string {
  if (sets.length === 0) return 'Sin series';
  const first = sets[0];
  const uniform = sets.every((set) => set.targetReps === first.targetReps && set.targetWeightKg === first.targetWeightKg);
  if (!uniform) return `${sets.length} series variables`;
  if (first.targetReps !== null) {
    return `${sets.length} × ${first.targetReps}${first.targetWeightKg ? ` · ${first.targetWeightKg} kg` : ''}`;
  }
  if (first.targetDurationSeconds !== null) return `${sets.length} × ${first.targetDurationSeconds}s`;
  if (first.targetDistanceM !== null) return `${sets.length} × ${first.targetDistanceM} m`;
  return `${sets.length} series · ${metricType}`;
}

function formatRest(seconds: number): string {
  if (seconds <= 0) return 'sin pausa';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
}
