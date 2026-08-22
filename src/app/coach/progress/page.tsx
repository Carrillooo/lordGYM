import { requireCoach } from '@/lib/auth/guards';
import { getRoster } from '@/lib/services/roster';
import { athleteOverview, loadSeries, personalRecords, volumeSeries } from '@/lib/services/progress';
import { todayKey } from '@/lib/domain/datetime';
import { formatKg, formatNumber, formatPercent, fullName } from '@/lib/domain/labels';
import { Card, CardHeader, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { TrendChart } from '@/components/charts/charts';
import { ExerciseProgressPanel } from '@/components/progress/exercise-progress-panel';
import { AthletePicker } from '@/components/coach/athlete-picker';

export const metadata = { title: 'Progreso' };

export default async function CoachProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string; exercise?: string; metric?: string }>;
}) {
  const { coach } = await requireCoach();
  const { athlete, exercise, metric } = await searchParams;
  const today = todayKey();

  const roster = await getRoster(coach.id, today);
  if (roster.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Rendimiento" title="Progreso" />
        <EmptyState
          title="Sin jugadores vinculados"
          description="Comparte tu código de entrenador para empezar a seguir su progresión."
        />
      </div>
    );
  }

  const selected = roster.find((entry) => entry.athlete.id === athlete) ?? roster[0];
  const [overview, records, load, volume] = await Promise.all([
    athleteOverview(selected.athlete.id, today),
    personalRecords(selected.athlete.id),
    loadSeries(selected.athlete.id, 42, today),
    volumeSeries(selected.athlete.id, 10, today),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rendimiento"
        title="Progreso"
        description="Evolución de fuerza, volumen, carga y récords de cada jugador."
        action={
          <AthletePicker
            athletes={roster.map((entry) => ({
              id: entry.athlete.id,
              name: fullName(entry.profile.first_name, entry.profile.last_name),
            }))}
            selectedId={selected.athlete.id}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sesiones" value={overview.completedSessions} />
        <Stat label="Volumen total" value={formatNumber(overview.totalVolumeKg)} unit="kg" />
        <Stat label="Adherencia" value={formatPercent(overview.adherencePercent)} tone="success" />
        <Stat label="Récords" value={overview.recordCount} tone="volt" />
      </div>

      <ExerciseProgressPanel
        athleteId={selected.athlete.id}
        exerciseId={exercise}
        metric={metric}
        title={`Progresión de ${selected.profile.first_name}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Carga diaria" subtitle="Últimas 6 semanas" />
          <TrendChart data={load} unit="AU" color="violet" height={200} />
        </Card>
        <Card>
          <CardHeader title="Volumen semanal" subtitle="Kilos totales por semana" />
          <TrendChart data={volume} unit="kg" color="data" height={200} variant="line" />
        </Card>
      </div>

      <Card>
        <CardHeader title="Récords personales" subtitle={`${records.length} marcas`} />
        {records.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">Todavía sin récords.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Ejercicio</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Récord</th>
                  <th scope="col" className="py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-850">
                {records.map(({ record, exerciseName }) => (
                  <tr key={record.id}>
                    <td className="py-2.5 pr-3 text-ink-100">{exerciseName}</td>
                    <td className="metric py-2.5 pr-3 text-volt-500">
                      {record.record_type === 'weight'
                        ? formatKg(record.value)
                        : record.record_type === 'reps'
                          ? `${formatNumber(record.value)} reps`
                          : record.record_type === 'distance'
                            ? `${formatNumber(record.value)} m`
                            : formatNumber(record.value, 1)}
                    </td>
                    <td className="py-2.5 text-ink-500">{record.achieved_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
