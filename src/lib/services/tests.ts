import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { percentChange } from '@/lib/domain/metrics';
import { ServiceError } from './accounts';
import { assertCoachLinkedToAthlete } from '@/lib/auth/guards';
import type { TestResultRow, TestRow } from '@/types/db';
import type { z } from 'zod';
import type { testResultSchema } from '@/lib/validation/schemas';

type TestResultInput = z.infer<typeof testResultSchema>;

export async function listTests(coachId: string): Promise<TestRow[]> {
  const rows = await db().select('tests', { coach_id: { in: [null, coachId] } });
  return rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'es'));
}

export async function createTest(
  coachId: string,
  input: { name: string; unit: string; category: string; lowerIsBetter: boolean },
): Promise<TestRow> {
  const row: TestRow = {
    id: newId(),
    coach_id: coachId,
    name: input.name,
    unit: input.unit,
    category: input.category,
    lower_is_better: input.lowerIsBetter,
  };
  await db().insert('tests', row);
  return row;
}

export async function recordTestResult(coachId: string, input: TestResultInput): Promise<TestResultRow> {
  await assertCoachLinkedToAthlete(coachId, input.athleteId);
  const [test] = await db().select('tests', { id: input.testId });
  if (!test) throw new ServiceError('Prueba no encontrada.');
  if (test.coach_id !== null && test.coach_id !== coachId) {
    throw new ServiceError('Esa prueba no es tuya.');
  }

  const row: TestResultRow = {
    id: newId(),
    test_id: input.testId,
    athlete_id: input.athleteId,
    date: input.date,
    value: input.value,
    note: input.note ?? null,
    created_at: nowIso(),
  };
  await db().insert('test_results', row);
  return row;
}

export interface TestProgress {
  test: TestRow;
  results: TestResultRow[];
  first: number | null;
  latest: number | null;
  /** Mejora en %, ya con el signo correcto según `lower_is_better`. */
  improvementPercent: number | null;
  best: number | null;
}

export async function testProgressForAthlete(athleteId: string): Promise<TestProgress[]> {
  const results = await db().select('test_results', { athlete_id: athleteId }, { orderBy: { column: 'date' } });
  if (results.length === 0) return [];
  const tests = await db().select('tests', { id: { in: [...new Set(results.map((r) => r.test_id))] } });

  return tests
    .map((test): TestProgress => {
      const own = results.filter((r) => r.test_id === test.id);
      const values = own.map((r) => r.value);
      const first = values[0] ?? null;
      const latest = values[values.length - 1] ?? null;
      return {
        test,
        results: own,
        first,
        latest,
        improvementPercent:
          first !== null && latest !== null ? percentChange(first, latest, test.lower_is_better) : null,
        best: values.length > 0 ? (test.lower_is_better ? Math.min(...values) : Math.max(...values)) : null,
      };
    })
    .sort((a, b) => a.test.name.localeCompare(b.test.name, 'es'));
}

/** Última marca de cada jugador en una prueba, para comparar el equipo (§41). */
export async function testComparison(
  coachId: string,
  testId: string,
  athleteIds: string[],
): Promise<{ athleteId: string; value: number | null; date: string | null }[]> {
  if (athleteIds.length === 0) return [];
  const results = await db().select('test_results', { test_id: testId, athlete_id: { in: athleteIds } });
  return athleteIds.map((athleteId) => {
    const own = results
      .filter((r) => r.athlete_id === athleteId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { athleteId, value: own[0]?.value ?? null, date: own[0]?.date ?? null };
  });
}
