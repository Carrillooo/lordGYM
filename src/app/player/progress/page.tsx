import { requireAthlete } from '@/lib/auth/guards';
import {
  athleteOverview,
  bodyweightSeries,
  loadSeries,
  personalRecords,
  volumeSeries,
} from '@/lib/services/progress';
import { testProgressForAthlete } from '@/lib/services/tests';
import { goalsWithProgress } from '@/lib/services/coach-notes';
import { recentSessions } from '@/lib/services/sessions';
import { formatShortDate, todayKey } from '@/lib/domain/datetime';
import { formatKg, formatNumber, formatPercent, formatSigned } from '@/lib/domain/labels';
import { Badge, Card, CardHeader, PageHeader, ProgressBar, Stat } from '@/components/ui/primitives';
import { TrendChart } from '@/components/charts/charts';
import { ExerciseProgressPanel } from '@/components/progress/exercise-progress-panel';
import { BodyweightForm } from '@/components/player/bodyweight-form';

export const metadata = { title: 'Progreso' };

export default async function PlayerProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; metric?: string }>;
}) {
  const { athlete } = await requireAthlete();
  const { exercise, metric } = await searchParams;
  const today = todayKey();

  const [overview, records, weights, load, volume, tests, goals, sessions] = await Promise.all([
    athleteOverview(athlete.id, today),
    personalRecords(athlete.id),
    bodyweightSeries(athlete.id),
    loadSeries(athlete.id, 28, today),
    volumeSeries(athlete.id, 8, today),
    testProgressForAthlete(athlete.id),
    goalsWithProgress(athlete.id),
    recentSessions(athlete.id, 6),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Progreso" description="Tu evolución de fuerza, volumen, carga y récords." />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Entrenamientos" value={overview.completedSessions} />
        <Stat label="Volumen total" value={formatNumber(overview.totalVolumeKg)} unit="kg" />
        <Stat label="Adherencia" value={formatPercent(overview.adherencePercent)} tone="success" />
        <Stat label="Récords" value={overview.recordCount} tone="volt" />
      </div>

      <ExerciseProgressPanel athleteId={athlete.id} exerciseId={exercise} metric={metric} title="Tu progresión" />

      {goals.length > 0 ? (
        <Card>
          <CardHeader title="Objetivos" />
          <ul className="space-y-4">
            {goals.map(({ goal, currentValue, percent, achieved }) => (
              <li key={goal.id}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink-100">{goal.title}</span>
                  <span className="tabular text-xs text-ink-400">
                    {currentValue === null ? '—' : formatNumber(currentValue, 2)} / {formatNumber(goal.target_value, 2)}{' '}
                    {goal.unit}
                  </span>
                </div>
                <ProgressBar className="mt-2" value={percent} tone={achieved ? 'success' : 'volt'} showLabel />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Carga diaria" subtitle="RPE de sesión × minutos · últimos 28 días" />
        <TrendChart data={load} unit="AU" color="violet" height={190} />
      </Card>

      <Card>
        <CardHeader title="Volumen semanal" subtitle="Kilos totales movidos" />
        <TrendChart data={volume} unit="kg" color="data" height={190} variant="line" />
      </Card>

      <Card>
        <CardHeader
          title="Peso corporal"
          subtitle={overview.latestWeightKg ? `Último registro: ${formatKg(overview.latestWeightKg)}` : 'Sin registros'}
        />
        <TrendChart data={weights} unit="kg" color="teal" height={190} variant="line" />
        <div className="mt-4">
          <BodyweightForm today={today} defaultValue={overview.latestWeightKg} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Récords personales" subtitle={`${records.length} marcas`} />
        {records.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Todavía sin récords. Van a caer.</p>
        ) : (
          <ul className="divide-y divide-ink-850">
            {records.map(({ record, exerciseName }) => (
              <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-100">{exerciseName}</span>
                  <span className="block text-xs text-ink-500">{formatShortDate(record.achieved_at.slice(0, 10))}</span>
                </span>
                <span className="metric shrink-0 text-lg text-volt-500">
                  {record.record_type === 'weight'
                    ? formatKg(record.value)
                    : record.record_type === 'reps'
                      ? `${formatNumber(record.value)} reps`
                      : record.record_type === 'distance'
                        ? `${formatNumber(record.value)} m`
                        : formatNumber(record.value, 1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {tests.length > 0 ? (
        <Card>
          <CardHeader title="Tests" subtitle="Evolución de tus pruebas físicas" />
          <ul className="divide-y divide-ink-850">
            {tests.map((entry) => (
              <li key={entry.test.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-100">{entry.test.name}</span>
                  <span className="block text-xs text-ink-500">
                    {formatNumber(entry.first, 2)} → {formatNumber(entry.latest, 2)} {entry.test.unit}
                  </span>
                </span>
                <Badge tone={(entry.improvementPercent ?? 0) >= 0 ? 'success' : 'danger'}>
                  {formatSigned(entry.improvementPercent)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Últimas sesiones" />
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Aún no has completado ninguna sesión.</p>
        ) : (
          <ul className="divide-y divide-ink-850">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-ink-100">
                  {formatShortDate((session.completed_at ?? session.started_at).slice(0, 10))}
                </span>
                <span className="flex gap-2">
                  <Badge>{formatNumber(session.total_volume_kg)} kg</Badge>
                  <Badge tone={(session.session_rpe ?? 0) >= 8.5 ? 'warning' : 'neutral'}>
                    RPE {session.session_rpe?.toString().replace('.', ',') ?? '—'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
