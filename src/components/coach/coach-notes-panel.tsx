'use client';

import { useActionState } from 'react';
import { Eye, EyeOff, Lock, Trash2 } from 'lucide-react';
import type { CoachNoteRow } from '@/types/db';
import { addCoachNoteAction, deleteCoachNoteAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { formatShortDate } from '@/lib/domain/datetime';
import { Card, CardHeader } from '@/components/ui/primitives';
import { SubmitButton, Textarea } from '@/components/ui/form';

/** Notas privadas del entrenador (§42). El jugador sólo ve las marcadas visibles. */
export function CoachNotesPanel({ athleteId, notes }: { athleteId: string; notes: CoachNoteRow[] }) {
  const [state, formAction] = useActionState(addCoachNoteAction, idleState);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-ink-500" />
            Notas del entrenador
          </span>
        }
        subtitle="Privadas salvo que marques la nota como visible."
      />

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="athleteId" value={athleteId} />
        <Textarea name="body" placeholder="Ej. Mejorar estabilidad de tobillo." required />
        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input
            type="checkbox"
            name="visible"
            className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-[var(--color-volt-500)]"
          />
          Visible para el jugador
        </label>
        {state.status !== 'idle' && state.message ? (
          <p className={state.status === 'error' ? 'text-sm text-danger-500' : 'text-sm text-success-500'}>
            {state.message}
          </p>
        ) : null}
        <SubmitButton size="sm" pendingLabel="Guardando…">
          Añadir nota
        </SubmitButton>
      </form>

      {notes.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-ink-800 bg-ink-900/50 p-3">
              <p className="text-sm text-ink-200">{note.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-ink-500">
                  {note.visible_to_athlete ? (
                    <>
                      <Eye className="h-3 w-3" /> Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" /> Privada
                    </>
                  )}
                  · {formatShortDate(note.created_at.slice(0, 10))}
                </span>
                <form action={deleteCoachNoteAction}>
                  <input type="hidden" name="noteId" value={note.id} />
                  <input type="hidden" name="athleteId" value={athleteId} />
                  <button
                    type="submit"
                    aria-label="Eliminar nota"
                    className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
