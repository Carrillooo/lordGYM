'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Plus } from 'lucide-react';
import type { ExerciseRow, WorkoutExerciseRow, WorkoutSetRow } from '@/types/db';
import {
  addExerciseAction,
  duplicateExerciseAction,
  removeExerciseAction,
  reorderExercisesAction,
} from '@/lib/actions/workouts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { ExerciseEditor } from './exercise-editor';
import { ExerciseLibraryModal } from './exercise-library-modal';

export interface BuilderRow {
  workoutExercise: WorkoutExerciseRow;
  exercise: ExerciseRow;
  sets: WorkoutSetRow[];
}

/**
 * Constructor de entrenamientos (§79). Reordenación por arrastre en escritorio
 * y con flechas en móvil; el orden se persiste en cuanto se suelta.
 */
export function WorkoutBuilder({
  workoutId,
  rows,
  library,
}: {
  workoutId: string;
  rows: BuilderRow[];
  library: ExerciseRow[];
}) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /**
   * El servidor es la fuente de verdad del orden. `pendingOrder` sólo guarda la
   * previsualización mientras se arrastra o hasta que el servidor confirma, así
   * el componente nunca tiene que sincronizar estado con props en render.
   */
  const [pendingOrder, setPendingOrder] = useState<BuilderRow[] | null>(null);
  const order = pendingOrder ?? rows;

  function persistOrder(next: BuilderRow[]) {
    setPendingOrder(next);
    startTransition(async () => {
      await reorderExercisesAction(
        workoutId,
        next.map((row) => row.workoutExercise.id),
      );
      router.refresh();
      setPendingOrder(null);
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    persistOrder(next);
  }

  function handleDragEnter(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) return;
    const next = [...order];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(index, 0, moved);
    dragIndex.current = index;
    setPendingOrder(next);
  }

  function handleDragEnd() {
    dragIndex.current = null;
    setDraggingId(null);
    persistOrder(order);
  }

  function addExercise(exerciseId: string) {
    const formData = new FormData();
    formData.set('workoutId', workoutId);
    formData.set('exerciseId', exerciseId);
    startTransition(async () => {
      await addExerciseAction(formData);
      router.refresh();
      setPendingOrder(null);
    });
  }

  function removeExercise(workoutExerciseId: string) {
    const formData = new FormData();
    formData.set('workoutId', workoutId);
    formData.set('workoutExerciseId', workoutExerciseId);
    // Retirada optimista: la fila desaparece antes de que responda el servidor.
    setPendingOrder(order.filter((row) => row.workoutExercise.id !== workoutExerciseId));
    startTransition(async () => {
      await removeExerciseAction(formData);
      router.refresh();
      setPendingOrder(null);
    });
  }

  function duplicateExercise(workoutExerciseId: string) {
    const formData = new FormData();
    formData.set('workoutId', workoutId);
    formData.set('workoutExerciseId', workoutExerciseId);
    startTransition(async () => {
      await duplicateExerciseAction(formData);
      router.refresh();
      setPendingOrder(null);
    });
  }

  return (
    <div className="space-y-4">
      {order.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title="Sin ejercicios todavía"
          description="Añade el primer ejercicio desde la biblioteca de LORDGYM o crea uno propio."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4" />
              Añadir ejercicio
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {order.map((row, index) => (
            <ExerciseEditor
              key={row.workoutExercise.id}
              workoutId={workoutId}
              workoutExercise={row.workoutExercise}
              exercise={row.exercise}
              initialSets={row.sets}
              index={index}
              total={order.length}
              onMove={move}
              onRemove={removeExercise}
              onDuplicate={duplicateExercise}
              isDragging={draggingId === row.workoutExercise.id}
              dragHandlers={{
                onDragStart: () => {
                  dragIndex.current = index;
                  setDraggingId(row.workoutExercise.id);
                },
                onDragEnter: () => handleDragEnter(index),
                onDragEnd: handleDragEnd,
              }}
            />
          ))}
        </ul>
      )}

      {order.length > 0 ? (
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
          Añadir ejercicio
        </Button>
      ) : null}

      <ExerciseLibraryModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        library={library}
        onPick={(exerciseId) => {
          addExercise(exerciseId);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
