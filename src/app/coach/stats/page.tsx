import { requireCoach } from '@/lib/auth/guards';
import { coachDashboardStats, compareAthletes } from '@/lib/services/stats';
import { coachAlerts } from '@/lib/services/alerts';
import { todayKey } from '@/lib/domain/datetime';
import { formatNumber, formatPercent } from '@/lib/domain/labels';
import { Badge, Card, CardHeader, PageHeader, ProgressBar, Stat } from '@/components/ui/primitives';
import { BarsChart } from '@/components/charts/charts';
import { ExportCsvButton } from '@/components/coach/export-csv-button';

export const metadata = { title: 'Estadísticas' };

export default async function CoachStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { coach } = await requireCoach();
  const { range } = await searchParams;
  const today = todayKey();
  const days = range === '7' ? 7 : range === '90' ? 90 : 28;

  const [stats, comparison, alerts] = await Promise.all([
    coachDashboardStats(coach.id, today),
    compareAthletes(coach.id, days, today),
    coachAlerts(coach.id, today),
  ]);

  const csvRows = [
    ['Jugador', 'Sesiones', 'Adherencia %', 'Volumen kg', 'Carga AU', 'RPE medio', 'Récords'],
    ...comparison.map((row) => [
      row.name,
      String(row.sessions),
      String(row.adherencePercent),
      String(row.volumeKg),
      String(row.loadAu),
      row.avgRpe === null ? '' : String(row.avgRpe),
      String(row.records),
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Últimos ${days} días`}
        title="Estadísticas"
        description="Comparativa interna del equipo. No se publica ningún ranking a los jugadores."
        action={<ExportCsvButton rows={csvRows} filename={`lordgym-equipo-${today}.csv`} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Jugadores activos" value={stats.activeAthletes} />
        <Stat label="Sesiones completadas" value={stats.weeklyCompleted} hint={`de ${stats.weeklyAssigned} asignadas`} />
        <Stat label="Sesiones omitidas" value={stats.skippedThisWeek} tone={stats.skippedThisWeek > 0 ? 'danger' : 'neutral'} />
        <Stat
          label="Adherencia semanal"
          value={formatPercent(stats.compliancePercent)}
          tone={stats.compliancePercent >= 85 ? 'success' : 'warning'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Carga media / sesión" value={stats.avgLoadPerSession === null ? '—' : formatNumber(stats.avgLoadPerSession)} unit="AU" />
        <Stat label="RPE medio" value={stats.avgRpe === null ? '—' : stats.avgRpe.toString().replace('.', ',')} />
        <Stat label="Récords este mes" value={stats.totalRecordsThisMonth} tone="volt" />
      </div>

      <Card>
        <CardHeader title="Carga del equipo por día" subtitle="Semana actual · unidades arbitrarias" />
        <BarsChart data={stats.weeklyLoadSeries.map((point) => ({ label: point.label, value: point.value }))} unit="AU" height={220} />
      </Card>

      <Card>
        <CardHeader title="Comparación entre jugadores" subtitle={`Ventana de ${days} días`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-500">
                <th scope="col" className="py-2 pr-3 font-medium">Jugador</th>
                <th scope="col" className="py-2 pr-3 font-medium">Sesiones</th>
                <th scope="col" className="py-2 pr-3 font-medium">Adherencia</th>
                <th scope="col" className="py-2 pr-3 font-medium">Volumen</th>
                <th scope="col" className="py-2 pr-3 font-medium">Carga</th>
                <th scope="col" className="py-2 pr-3 font-medium">RPE</th>
                <th scope="col" className="py-2 font-medium">PR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-850">
              {comparison.map((row) => (
                <tr key={row.athleteId}>
                  <td className="py-2.5 pr-3 text-ink-100">{row.name}</td>
                  <td className="tabular py-2.5 pr-3 text-ink-300">{row.sessions}</td>
                  <td className="py-2.5 pr-3">
                    <ProgressBar
                      value={row.adherencePercent}
                      showLabel
                      tone={row.adherencePercent >= 80 ? 'volt' : row.adherencePercent >= 50 ? 'data' : 'danger'}
                      className="min-w-32"
                    />
                  </td>
                  <td className="tabular py-2.5 pr-3 text-ink-300">{formatNumber(row.volumeKg)} kg</td>
                  <td className="tabular py-2.5 pr-3 text-ink-300">{formatNumber(row.loadAu)} AU</td>
                  <td className="tabular py-2.5 pr-3 text-ink-300">
                    {row.avgRpe === null ? '—' : row.avgRpe.toString().replace('.', ',')}
                  </td>
                  <td className="tabular py-2.5 text-volt-500">{row.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {alerts.length > 0 ? (
        <Card>
          <CardHeader title="Alertas automáticas" subtitle="Señales de seguimiento, no indicaciones médicas." />
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3"
              >
                <Badge tone={alert.severity === 'danger' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'data'}>
                  {alert.title}
                </Badge>
                <span className="text-sm font-medium text-ink-100">{alert.athleteName}</span>
                <span className="min-w-0 flex-1 text-xs text-ink-400">{alert.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
