import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { assertCoachLinkedToAthlete } from '@/lib/auth/guards';
import { epley1RM } from '@/lib/domain/metrics';
import { ServiceError } from './accounts';
import type { CoachNoteRow, GoalRow } from '@/types/db';
import type { z } from 'zod';
import type { goalSchema } from '@/lib/validation/schemas';

type GoalInput = z.infer<typeof goalSchema>;

// --- Notas privadas del entrenador (§42) -----------------------------------

export async function addCoachNote(
  coachId: string,
  athleteId: string,
  body: string,
  visibleToAthlete = false,
): Promise<CoachNoteRow> {
  await assertCoachLinkedToAthlete(coachId, athleteId);
  const row: CoachNoteRow = {
    id: newId(),
    coach_id: coachId,
    athlete_id: athleteId,
    body,
    visible_to_athlete: visibleToAthlete,
    created_at: nowIso(),
  };
  await db().insert('coach_notes', row);
  return row;
}

export async function listCoachNotes(coachId: string, athleteId: string): Promise<CoachNoteRow[]> {
  return db().select(
    'coach_notes',
    { coach_id: coachId, athlete_id: athleteId },
    { orderBy: { column: 'created_at', ascending: false } },
  );
}

/** El jugador sólo ve las notas que el entrenador ha marcado como visibles. */
export async function listVisibleNotes(athleteId: string): Promise<CoachNoteRow[]> {
  return db().select(
    'coach_notes',
    { athlete_id: athleteId, visible_to_athlete: true },
    { orderBy: { column: 'created_at', ascending: false } },
  );
}

export async function deleteCoachNote(coachId: string, noteId: string): Promise<void> {
  const [note] = await db().select('coach_notes', { id: noteId, coach_id: coachId });
  if (!note) throw new ServiceError('Nota no encontrada.');
  await db().remove('coach_notes', noteId);
}

// --- Objetivos (§74) -------------------------------------------------------

export async function createGoal(coachId: string, input: GoalInput): Promise<GoalRow> {
  await assertCoachLinkedToAthlete(coachId, input.athleteId);
  const row: GoalRow = {
    id: newId(),
    athlete_id: input.athleteId,
    coach_id: coachId,
    title: input.title,
    metric: input.metric,
    exercise_id: input.exerciseId ?? null,
    test_id: input.testId ?? null,
    start_value: input.startValue ?? null,
    target_value: input.targetValue,
    unit: input.unit,
    lower_is_better: input.lowerIsBetter,
    due_date: input.dueDate ?? null,
    created_at: nowIso(),
  };
  await db().insert('goals', row);
  return row;
}

export async function deleteGoal(coachId: string, goalId: string): Promise<void> {
  const [goal] = await db().select('goals', { id: goalId, coach_id: coachId });
  if (!goal) throw new ServiceError('Objetivo no encontrado.');
  await db().remove('goals', goalId);
}

export interface GoalProgress {
  goal: GoalRow;
  currentValue: number | null;
  /** 0–100. Con `lower_is_better` mide cuánto se ha recortado hacia el objetivo. */
  percent: number;
  achieved: boolean;
}

/** Calcula el valor actual de cada objetivo a partir de los datos reales. */
export async function goalsWithProgress(athleteId: string): Promise<GoalProgress[]> {
  const goals = await db().select('goals', { athlete_id: athleteId });
  if (goals.length === 0) return [];

  const [records, weights, testResults] = await Promise.all([
    db().select('personal_records', { athlete_id: athleteId }),
    db().select('bodyweight_logs', { athlete_id: athleteId }, { orderBy: { column: 'date', ascending: false }, limit: 1 }),
    db().select('test_results', { athlete_id: athleteId }),
  ]);

  return goals.map((goal): GoalProgress => {
    let currentValue: number | null = null;

    if (goal.metric === 'exercise_weight' && goal.exercise_id) {
      currentValue =
        records.find((r) => r.exercise_id === goal.exercise_id && r.record_type === 'weight')?.value ?? null;
    } else if (goal.metric === 'exercise_e1rm' && goal.exercise_id) {
      const record = records.find((r) => r.exercise_id === goal.exercise_id && r.record_type === 'e1rm');
      currentValue =
        record?.value ??
        (() => {
          const weight = records.find((r) => r.exercise_id === goal.exercise_id && r.record_type === 'weight');
          return weight ? epley1RM(weight.weight_kg ?? weight.value, weight.reps ?? 1) : null;
        })();
    } else if (goal.metric === 'bodyweight') {
      currentValue = weights[0]?.weight_kg ?? null;
    } else if (goal.metric === 'test' && goal.test_id) {
      const own = testResults
        .filter((r) => r.test_id === goal.test_id)
        .sort((a, b) => b.date.localeCompare(a.date));
      currentValue = own[0]?.value ?? null;
    }

    if (currentValue === null) {
      return { goal, currentValue: null, percent: 0, achieved: false };
    }

    const start = goal.start_value ?? (goal.lower_is_better ? currentValue * 1.15 : 0);
    const span = goal.target_value - start;
    const progressed = currentValue - start;
    const percent = span === 0 ? 100 : Math.max(0, Math.min(100, Math.round((progressed / span) * 100)));
    const achieved = goal.lower_is_better ? currentValue <= goal.target_value : currentValue >= goal.target_value;

    return { goal, currentValue, percent: achieved ? 100 : percent, achieved };
  });
}
