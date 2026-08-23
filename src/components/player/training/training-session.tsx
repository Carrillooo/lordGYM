'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Info,
  Minus,
  Plus,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import type { ExerciseCategory, SetStatus } from '@/types/db';
import type { MediaMode } from '@/lib/media/types';
import { logSetAction } from '@/lib/actions/player';
import { clearSession, dequeue, enqueue, pending } from '@/lib/offline/queue';
import { formatDuration, formatShortDate } from '@/lib/domain/datetime';
import { epley1RM } from '@/lib/domain/metrics';
import { SET_TYPE_LABELS } from '@/lib/domain/labels';
import { cn } from '@/lib/cn';
import { Badge, ProgressBar } from '@/components/ui/primitives';
import { RestTimer } from './rest-timer';
import { FinishSheet } from './finish-sheet';
import { ExitDialog } from './exit-dialog';
import { ExerciseFeedback } from './exercise-feedback';
import { AnimatedExerciseFigureFrame } from '@/components/exercise/exercise-figure-animated';
import { VideoPlayer } from '@/components/media/video-player';

export interface TrainingSet {
  id: string;
  index: number;
  setType: keyof typeof SET_TYPE_LABELS;
  targetReps: number | null;
  targetWeightKg: number | null;
  actualReps: number | null;
  actualWeightKg: number | null;
  actualDurationSeconds: number | null;
  actualDistanceM: number | null;
  rpe: number | null;
  status: SetStatus;
}

export interface TrainingExercise {
  sessionExerciseId: string;
  name: string;
  metricType: 'strength' | 'bodyweight' | 'time' | 'distance' | 'jump' | 'cardio';
  restSeconds: number;
  notes: string | null;
  description: string | null;
  technique: string | null;
  figureKey: string | null;
  category: ExerciseCategory;
  videoUrl: string | null;
  supersetGroup: string | null;
  lastTime: { weightKg: number | null; reps: number | null; date: string }[];
  bestWeightKg: number | null;
  athleteComment: string | null;
  videoNote: string | null;
  sets: TrainingSet[];
}

interface SetState {
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  rpe: number | null;
  status: SetStatus;
}

/**
 * Modo entrenamiento (§20, §88). Pantalla centrada en entrenar: cronómetro,
 * ejercicio actual, tabla de series con botones grandes y descanso automático.
 * Cada serie se guarda en local antes de enviarse, para poder seguir sin red.
 */
export function TrainingSession({
  sessionId,
  workoutName,
  startedAt,
  exercises,
  mediaMode,
}: {
  sessionId: string;
  workoutName: string;
  startedAt: string;
  exercises: TrainingExercise[];
  mediaMode: MediaMode;
}) {
  const [current, setCurrent] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [elapsed, setElapsed] = useState(() => Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)));
  const [rest, setRest] = useState<{ seconds: number; key: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [prToast, setPrToast] = useState<{ exercise: string; value: string } | null>(null);
  const restKey = useRef(0);

  const [state, setState] = useState<Record<string, SetState>>(() => {
    const initial: Record<string, SetState> = {};
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        initial[set.id] = {
          reps: set.actualReps ?? set.targetReps,
          weight: set.actualWeightKg ?? set.targetWeightKg,
          duration: set.actualDurationSeconds,
          distance: set.actualDistanceM,
          rpe: set.rpe,
          status: set.status,
        };
      }
    }
    return initial;
  });

  // Cronómetro total (§93).
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const flushQueue = useCallback(async () => {
    const queued = pending(sessionId);
    setOfflineCount(queued.length);
    for (const entry of queued) {
      const result = await logSetAction({
        sessionId: entry.sessionId,
        setId: entry.setId,
        actualReps: entry.actualReps,
        actualWeightKg: entry.actualWeightKg,
        actualDurationSeconds: entry.actualDurationSeconds,
        actualDistanceM: entry.actualDistanceM,
        rpe: entry.rpe,
        status: entry.status,
      });
      if (result.status === 'success') dequeue(sessionId, entry.setId);
    }
    setOfflineCount(pending(sessionId).length);
  }, [sessionId]);

  // Reintento al recuperar conexión (§65). El primer vaciado se programa fuera
  // del render para no encadenar renders al montar el modo entrenamiento.
  useEffect(() => {
    const timer = setTimeout(() => void flushQueue(), 0);
    window.addEventListener('online', flushQueue);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', flushQueue);
    };
  }, [flushQueue]);

  const totalSets = useMemo(() => exercises.reduce((acc, exercise) => acc + exercise.sets.length, 0), [exercises]);
  const completedSets = useMemo(
    () => Object.values(state).filter((set) => set.status === 'completed').length,
    [state],
  );
  const completedExercises = useMemo(
    () =>
      exercises.filter((exercise) => exercise.sets.every((set) => state[set.id]?.status !== 'pending')).length,
    [exercises, state],
  );

  const exercise = exercises[current];

  function patch(setId: string, changes: Partial<SetState>) {
    setState((currentState) => ({ ...currentState, [setId]: { ...currentState[setId], ...changes } }));
  }

  async function persist(setId: string, next: SetState) {
    enqueue({
      sessionId,
      setId,
      actualReps: next.reps,
      actualWeightKg: next.weight,
      actualDurationSeconds: next.duration,
      actualDistanceM: next.distance,
      rpe: next.rpe,
      status: next.status,
    });
    setOfflineCount(pending(sessionId).length);

    const result = await logSetAction({
      sessionId,
      setId,
      actualReps: next.reps,
      actualWeightKg: next.weight,
      actualDurationSeconds: next.duration,
      actualDistanceM: next.distance,
      rpe: next.rpe,
      status: next.status,
    });
    if (result.status === 'success') dequeue(sessionId, setId);
    setOfflineCount(pending(sessionId).length);
  }

  function toggleSet(setId: string) {
    const previous = state[setId];
    const nextStatus: SetStatus = previous.status === 'completed' ? 'pending' : 'completed';
    const next = { ...previous, status: nextStatus };
    patch(setId, { status: nextStatus });
    void persist(setId, next);

    if (nextStatus !== 'completed') return;

    // Aviso optimista de récord: se confirma al cerrar la sesión.
    if (
      exercise.metricType === 'strength' &&
      next.weight !== null &&
      exercise.bestWeightKg !== null &&
      next.weight > exercise.bestWeightKg
    ) {
      setPrToast({ exercise: exercise.name, value: `${next.weight} kg` });
      setTimeout(() => setPrToast(null), 4200);
    }

    if (exercise.restSeconds > 0) {
      restKey.current += 1;
      setRest({ seconds: exercise.restSeconds, key: restKey.current });
    }
  }

  function goTo(index: number) {
    if (index < 0 || index >= exercises.length) return;
    setCurrent(index);
    setShowVideo(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const showWeight = exercise.metricType === 'strength';
  const showReps = ['strength', 'bodyweight', 'jump'].includes(exercise.metricType);
  const showDuration = ['time', 'cardio'].includes(exercise.metricType);
  const showDistance = ['distance', 'cardio'].includes(exercise.metricType);

  return (
    <div className="min-h-dvh pb-40">
      <header className="safe-top sticky top-0 z-30 border-b border-ink-800 bg-ink-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setExiting(true)}
            aria-label="Salir del entrenamiento"
            className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold uppercase tracking-wide text-ink-50">{workoutName}</p>
            <p className="text-xs text-ink-400">
              {completedExercises} / {exercises.length} ejercicios · {completedSets} / {totalSets} series
            </p>
          </div>
          <span className="metric tabular shrink-0 text-lg text-volt-500">{formatDuration(elapsed)}</span>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <ProgressBar value={(completedSets / Math.max(1, totalSets)) * 100} />
        </div>
      </header>

      {offlineCount > 0 ? (
        <div className="mx-auto mt-3 flex max-w-2xl items-center gap-2 px-4">
          <span className="flex items-center gap-2 rounded-xl border border-amber-glow/30 bg-amber-glow/10 px-3 py-2 text-xs text-amber-glow">
            <CloudOff className="h-3.5 w-3.5" />
            {offlineCount} serie(s) guardadas en el móvil. Se sincronizan al recuperar conexión.
          </span>
        </div>
      ) : null}

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Ejercicio anterior"
            className="rounded-xl border border-ink-700 p-2.5 text-ink-300 transition-colors hover:border-ink-600 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs uppercase tracking-wider text-ink-500">
            Ejercicio {current + 1} de {exercises.length}
          </span>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === exercises.length - 1}
            aria-label="Siguiente ejercicio"
            className="rounded-xl border border-ink-700 p-2.5 text-ink-300 transition-colors hover:border-ink-600 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <AnimatedExerciseFigureFrame
                figureKey={exercise.figureKey}
                category={exercise.category}
                title={`Ilustración de ${exercise.name}`}
                className="h-14 w-20 shrink-0 sm:h-16 sm:w-24"
              />
              <div className="min-w-0">
              <h1 className="display text-2xl uppercase text-ink-50">{exercise.name}</h1>
              <p className="mt-1 text-sm text-ink-400">
                {exercise.sets.length} × {exercise.sets[0]?.targetReps ?? '—'}
                {exercise.sets[0]?.targetWeightKg ? ` · objetivo ${exercise.sets[0].targetWeightKg} kg` : ''}
                {exercise.restSeconds > 0 ? ` · descanso ${formatDuration(exercise.restSeconds)}` : ''}
              </p>
              </div>
            </div>
            {exercise.videoUrl ? (
              <button
                type="button"
                onClick={() => setShowVideo((value) => !value)}
                aria-label="Ver vídeo de técnica"
                aria-expanded={showVideo}
                className={cn(
                  'shrink-0 rounded-xl border p-2.5 transition-colors',
                  showVideo
                    ? 'border-volt-500 text-volt-500'
                    : 'border-ink-700 text-ink-300 hover:border-volt-500 hover:text-volt-500',
                )}
              >
                <Video className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          {/*
            El vídeo se reproduce aquí dentro, no en otra pestaña: en mitad de
            una serie, salir de la app es perder el cronómetro y el sitio.
          */}
          {showVideo && exercise.videoUrl ? (
            <div className="mt-3">
              <VideoPlayer url={exercise.videoUrl} label="Ver vídeo de técnica" />
            </div>
          ) : null}

          {exercise.supersetGroup ? (
            <Badge tone="violet" className="mt-3">
              Superserie {exercise.supersetGroup}
            </Badge>
          ) : null}

          {exercise.notes ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2 text-sm text-ink-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
              {exercise.notes}
            </p>
          ) : null}

          {/*
            Las series no usan tabla a propósito: en un móvil de 390 px una
            tabla obliga a desplazarse en horizontal para llegar al botón de
            completar, que es la acción más repetida de toda la app (§66).
            Cada serie ocupa dos líneas y todo queda al alcance del pulgar.
          */}
          <ul className="mt-4 space-y-2" aria-label={`Series de ${exercise.name}`}>
            {exercise.sets.map((set) => {
              const value = state[set.id];
              const done = value.status === 'completed';
              return (
                <li
                  key={set.id}
                  className={cn(
                    'rounded-xl border px-2.5 py-2 transition-colors',
                    done ? 'border-volt-500/35 bg-volt-500/[0.06]' : 'border-ink-800 bg-ink-900/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider">
                    <span className="text-ink-400">
                      Serie {set.index}
                      {set.setType !== 'normal' ? (
                        <span className="ml-1.5 text-ink-500">{SET_TYPE_LABELS[set.setType]}</span>
                      ) : null}
                    </span>
                    <span className="tabular text-ink-500">
                      {set.targetWeightKg || set.targetReps
                        ? `Objetivo ${set.targetWeightKg ? `${set.targetWeightKg} kg × ` : ''}${set.targetReps ?? '—'}`
                        : 'Sin objetivo'}
                    </span>
                  </div>

                  <div className="mt-2 flex items-end gap-2">
                    {showWeight ? (
                      <NumberInput
                        caption="Kg"
                        label={`Peso serie ${set.index}`}
                        value={value.weight}
                        step={2.5}
                        onChange={(next) => patch(set.id, { weight: next })}
                        onCommit={() => void persist(set.id, { ...state[set.id] })}
                      />
                    ) : null}
                    {showReps ? (
                      <NumberInput
                        caption="Reps"
                        label={`Repeticiones serie ${set.index}`}
                        value={value.reps}
                        onChange={(next) => patch(set.id, { reps: next })}
                        onCommit={() => void persist(set.id, { ...state[set.id] })}
                      />
                    ) : null}
                    {showDuration ? (
                      <NumberInput
                        caption="Seg"
                        label={`Segundos serie ${set.index}`}
                        value={value.duration}
                        onChange={(next) => patch(set.id, { duration: next })}
                        onCommit={() => void persist(set.id, { ...state[set.id] })}
                      />
                    ) : null}
                    {showDistance ? (
                      <NumberInput
                        caption="Metros"
                        label={`Metros serie ${set.index}`}
                        value={value.distance}
                        onChange={(next) => patch(set.id, { distance: next })}
                        onCommit={() => void persist(set.id, { ...state[set.id] })}
                      />
                    ) : null}
                    <NumberInput
                      caption="RPE"
                      label={`RPE serie ${set.index}`}
                      value={value.rpe}
                      step={0.5}
                      onChange={(next) => patch(set.id, { rpe: next })}
                      onCommit={() => void persist(set.id, { ...state[set.id] })}
                    />

                    <button
                      type="button"
                      onClick={() => toggleSet(set.id)}
                      aria-label={done ? `Desmarcar serie ${set.index}` : `Completar serie ${set.index}`}
                      aria-pressed={done}
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95',
                        done
                          ? 'border-volt-500 bg-volt-500 text-ink-950'
                          : 'border-ink-600 text-ink-400 hover:border-volt-500 hover:text-volt-500',
                      )}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {showWeight || showReps ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {showWeight ? (
                <>
                  <QuickButton
                    label="-2,5 kg"
                    icon={<Minus className="h-3.5 w-3.5" />}
                    onClick={() => adjustAll('weight', -2.5)}
                  />
                  <QuickButton
                    label="+2,5 kg"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => adjustAll('weight', 2.5)}
                  />
                </>
              ) : null}
              {showReps ? (
                <>
                  <QuickButton
                    label="-1 rep"
                    icon={<Minus className="h-3.5 w-3.5" />}
                    onClick={() => adjustAll('reps', -1)}
                  />
                  <QuickButton
                    label="+1 rep"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => adjustAll('reps', 1)}
                  />
                </>
              ) : null}
            </div>
          ) : null}

          {exercise.lastTime.length > 0 ? (
            <div className="mt-5 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
                Última vez {exercise.lastTime[0].date ? `· ${formatShortDate(exercise.lastTime[0].date)}` : ''}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {exercise.lastTime.slice(0, 5).map((entry, index) => (
                  <li key={index} className="tabular text-sm text-ink-300">
                    {entry.weightKg ? `${entry.weightKg} kg × ` : ''}
                    {entry.reps ?? '—'}
                    {entry.weightKg && entry.reps ? (
                      <span className="ml-2 text-xs text-ink-600">
                        1RM est. {epley1RM(entry.weightKg, entry.reps)} kg
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ExerciseFeedback
            key={exercise.sessionExerciseId}
            sessionExerciseId={exercise.sessionExerciseId}
            initialComment={exercise.athleteComment}
            initialVideoUrl={exercise.videoNote}
            mediaMode={mediaMode}
          />

          {exercise.technique || exercise.description ? (
            <details className="mt-4 text-sm">
              <summary className="flex h-11 cursor-pointer select-none items-center text-xs font-medium uppercase tracking-wider text-ink-500">
                Cómo se hace
              </summary>
              <div className="mt-3 space-y-3">
                <AnimatedExerciseFigureFrame
                  figureKey={exercise.figureKey}
                  category={exercise.category}
                  title={`Ilustración de ${exercise.name}`}
                  className="aspect-[10/7] w-full max-w-xs"
                />
                {exercise.description ? <p className="text-ink-400">{exercise.description}</p> : null}
                {exercise.technique ? <p className="text-ink-300">{exercise.technique}</p> : null}
              </div>
            </details>
          ) : null}
        </section>

        <nav aria-label="Ejercicios de la sesión" className="card p-2">
          <ul className="space-y-0.5">
            {exercises.map((item, index) => {
              const done = item.sets.every((set) => state[set.id]?.status === 'completed');
              return (
                <li key={item.sessionExerciseId}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                      index === current ? 'bg-ink-800' : 'hover:bg-ink-850',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                        done ? 'bg-volt-500 text-ink-950' : 'bg-ink-800 text-ink-400',
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <span className={cn('min-w-0 flex-1 truncate text-sm', done ? 'text-ink-400' : 'text-ink-100')}>
                      {item.name}
                    </span>
                    <span className="tabular shrink-0 text-xs text-ink-500">
                      {item.sets.filter((set) => state[set.id]?.status === 'completed').length}/{item.sets.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setSoundEnabled((value) => !value)}
          className="text-xs text-ink-500 underline-offset-2 hover:underline"
        >
          Sonido al terminar el descanso: {soundEnabled ? 'activado' : 'desactivado'}
        </button>
      </main>

      {rest ? (
        <RestTimer
          key={rest.key}
          seconds={rest.seconds}
          soundEnabled={soundEnabled}
          onDone={() => setRest(null)}
          onSkip={() => setRest(null)}
        />
      ) : (
        <div className="safe-inset-x fixed bottom-0 z-30 border-t border-ink-800 bg-ink-950/90 px-4 pb-[calc(0.75rem+var(--safe-bottom))] pt-3 backdrop-blur-lg">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => setFinishing(true)}
              className="h-14 w-full rounded-2xl bg-volt-500 text-base font-semibold uppercase tracking-wide text-ink-950 transition-transform active:scale-[0.98]"
            >
              Terminar entrenamiento
            </button>
          </div>
        </div>
      )}

      {prToast ? (
        <div className="animate-rise fixed inset-x-4 top-24 z-50 mx-auto max-w-sm rounded-2xl border border-volt-500/40 bg-ink-900/95 p-4 text-center shadow-2xl backdrop-blur">
          <Trophy className="mx-auto h-8 w-8 text-volt-500" />
          <p className="display mt-2 text-xl uppercase text-volt-500">Nuevo PR</p>
          <p className="mt-1 text-sm text-ink-200">{prToast.exercise}</p>
          <p className="metric text-2xl text-ink-50">{prToast.value}</p>
        </div>
      ) : null}

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        sessionId={sessionId}
        elapsedSeconds={elapsed}
        onFinished={() => {
          // Sin refrescar la ruta: al quedar la sesión completada, la propia
          // ruta redirige a /player y el jugador se perdería el resumen (§23).
          // Los datos ya se revalidan desde la Server Action.
          clearSession(sessionId);
        }}
      />

      <ExitDialog open={exiting} onClose={() => setExiting(false)} sessionId={sessionId} />
    </div>
  );

  function adjustAll(field: 'weight' | 'reps', delta: number) {
    setState((currentState) => {
      const next = { ...currentState };
      for (const set of exercise.sets) {
        const value = next[set.id];
        if (value.status === 'completed') continue;
        const base = field === 'weight' ? (value.weight ?? 0) : (value.reps ?? 0);
        const updated = Math.max(0, Math.round((base + delta) * 100) / 100);
        next[set.id] = field === 'weight' ? { ...value, weight: updated } : { ...value, reps: updated };
      }
      return next;
    });
  }
}

function NumberInput({
  value,
  onChange,
  onCommit,
  step = 1,
  label,
  caption,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  onCommit: () => void;
  step?: number;
  label: string;
  caption: string;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">{caption}</span>
      <span className="sr-only">{label}</span>
      <input
        type="number"
        aria-label={label}
        inputMode="decimal"
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        onBlur={onCommit}
        className="tabular h-12 w-full min-w-0 rounded-xl border border-ink-700 bg-ink-900 px-1.5 text-center text-base text-ink-50 focus:border-volt-500 focus:outline-none"
      />
    </label>
  );
}

function QuickButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1 rounded-xl border border-ink-700 bg-ink-850 px-3 text-sm font-medium text-ink-100 transition-colors hover:border-volt-500 active:scale-95"
    >
      {icon}
      {label}
    </button>
  );
}
