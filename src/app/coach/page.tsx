import Link from 'next/link';
import {
  Activity,
  CalendarCheck,
  ChevronRight,
  Copy,
  Flame,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { coachDashboardStats } from '@/lib/services/stats';
import { coachAlerts } from '@/lib/services/alerts';
import { getRoster, pendingRequests } from '@/lib/services/roster';
import { assignmentsForCoach } from '@/lib/services/assignments';
import { todayKey } from '@/lib/domain/datetime';
import { formatNumber, formatPercent, fullName } from '@/lib/domain/labels';
import { Avatar, Badge, Card, CardHeader, EmptyState, Stat } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { BarsChart } from '@/components/charts/charts';
import { CopyCodeButton } from '@/components/coach/copy-code-button';
import { LinkRequestList } from '@/components/coach/link-request-list';
import { AthleteStatusDot } from '@/components/coach/athlete-status';

export const metadata = { title: 'Inicio' };

export default async function CoachDashboardPage() {
  const { profile, coach } = await requireCoach();
  const today = todayKey();

  const [stats, alerts, roster, requests, todaysSessions] = await Promise.all([
    coachDashboardStats(coach.id, today),
    coachAlerts(coach.id, today),
    getRoster(coach.id, today),
    pendingRequests(coach.id),
    assignmentsForCoach(coach.id, today, today),
  ]);

  const todayIndex = new Date(`${today}T12:00:00Z`).getUTCDay();
  const highlight = todayIndex === 0 ? 6 : todayIndex - 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">Hola, {profile.first_name} 👋</p>
          <h1 className="display mt-1 text-3xl text-ink-50 sm:text-4xl">Panel de entrenador</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/coach/workouts/new" size="md">
            <Plus className="h-4 w-4" />
            Crear entrenamiento
          </ButtonLink>
          <ButtonLink href="/coach/calendar" variant="secondary" size="md">
            <CalendarCheck className="h-4 w-4" />
            Calendario
          </ButtonLink>
        </div>
      </header>

      {requests.length > 0 ? <LinkRequestList requests={requests} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Jugadores activos"
          value={stats.activeAthletes}
          hint={stats.pendingRequests > 0 ? `${stats.pendingRequests} solicitud(es) pendientes` : 'Equipo al completo'}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Entrenan hoy"
          value={stats.trainingToday}
          hint={`${stats.trainingToday === 1 ? '1 jugador entrena' : `${stats.trainingToday} jugadores entrenan`} hoy.`}
          icon={<Flame className="h-4 w-4" />}
          tone="volt"
        />
        <Stat
          label="Sesiones completadas"
          value={`${stats.weeklyCompleted} / ${stats.weeklyAssigned}`}
          hint="Esta semana"
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <Stat
          label="Cumplimiento"
          value={formatPercent(stats.compliancePercent)}
          hint={stats.skippedThisWeek > 0 ? `${stats.skippedThisWeek} sesión(es) omitidas` : 'Sin sesiones omitidas'}
          tone={stats.compliancePercent >= 85 ? 'success' : stats.compliancePercent >= 65 ? 'warning' : 'danger'}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Carga semanal del equipo"
            subtitle={`Unidades arbitrarias (RPE × minutos)${
              stats.avgRpe !== null ? ` · RPE medio ${stats.avgRpe.toString().replace('.', ',')}` : ''
            }`}
          />
          <BarsChart
            data={stats.weeklyLoadSeries.map((point) => ({ label: point.label, value: point.value }))}
            unit="AU"
            highlightIndex={highlight}
            height={230}
          />
        </Card>

        <Card>
          <CardHeader
            title="Jugadores que requieren atención"
            subtitle={alerts.length === 0 ? 'Ninguna alerta activa' : `${alerts.length} señal(es) detectadas`}
            action={
              <Link href="/coach/players" className="text-xs font-medium text-volt-500 hover:underline">
                Ver todos
              </Link>
            }
          />
          {alerts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-500">
              Todo en orden. Sin RPE elevado, dolor ni sesiones sin completar.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={`/coach/players/${alert.athleteId}`}
                    className="flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3 transition-colors hover:border-ink-600"
                  >
                    <span
                      className={
                        alert.severity === 'danger'
                          ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger-500'
                          : alert.severity === 'warning'
                            ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-glow'
                            : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-data-500'
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-100">{alert.athleteName}</span>
                      <span className="block text-xs text-ink-400">{alert.detail}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Sesiones de hoy"
            subtitle={
              todaysSessions.length === 0
                ? 'No hay sesiones asignadas para hoy'
                : `${todaysSessions.length} sesión(es) programadas`
            }
          />
          {todaysSessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-500">
              Asigna un entrenamiento desde el calendario.
            </p>
          ) : (
            <ul className="divide-y divide-ink-800">
              {todaysSessions.map((view) => (
                <li key={view.assignment.id} className="flex items-center gap-3 py-3">
                  <Avatar
                    name={
                      view.athleteProfile
                        ? fullName(view.athleteProfile.first_name, view.athleteProfile.last_name)
                        : 'Jugador'
                    }
                    src={view.athleteProfile?.avatar_url}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-100">
                      {view.athleteProfile
                        ? fullName(view.athleteProfile.first_name, view.athleteProfile.last_name)
                        : 'Jugador'}
                    </p>
                    <p className="truncate text-xs text-ink-400">
                      {view.workout.name}
                      {view.assignment.scheduled_time ? ` · ${view.assignment.scheduled_time}` : ''}
                    </p>
                  </div>
                  <Badge
                    tone={
                      view.assignment.status === 'completed'
                        ? 'success'
                        : view.assignment.status === 'started'
                          ? 'volt'
                          : 'neutral'
                    }
                  >
                    {view.assignment.status === 'completed'
                      ? 'Completado'
                      : view.assignment.status === 'started'
                        ? 'En curso'
                        : 'Pendiente'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Equipo"
            subtitle={`${roster.length} jugador(es) activos`}
            action={
              <Link href="/coach/players" className="text-xs font-medium text-volt-500 hover:underline">
                Ver todos
              </Link>
            }
          />
          {roster.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent p-0"
              title="Todavía no tienes jugadores"
              description={
                <>
                  Comparte tu código para que se unan a tu equipo:
                  <span className="metric mt-2 block text-lg text-volt-500">{coach.coach_code}</span>
                </>
              }
              action={<CopyCodeButton code={coach.coach_code} />}
              icon={<Users className="h-6 w-6" />}
            />
          ) : (
            <ul className="divide-y divide-ink-800">
              {roster.slice(0, 6).map((entry) => (
                <li key={entry.athlete.id}>
                  <Link
                    href={`/coach/players/${entry.athlete.id}`}
                    className="flex items-center gap-3 py-3 transition-opacity hover:opacity-80"
                  >
                    <Avatar
                      name={fullName(entry.profile.first_name, entry.profile.last_name)}
                      src={entry.profile.avatar_url}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">
                        {fullName(entry.profile.first_name, entry.profile.last_name)}
                      </p>
                      <p className="truncate text-xs text-ink-400">
                        {entry.weeklyCompleted}/{entry.weeklyAssigned} esta semana ·{' '}
                        {formatPercent(entry.weeklyAdherence)} cumplimiento
                      </p>
                    </div>
                    <AthleteStatusDot status={entry.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Récords este mes"
          value={stats.totalRecordsThisMonth}
          icon={<Activity className="h-4 w-4" />}
          tone="volt"
        />
        <Stat
          label="Carga media por sesión"
          value={stats.avgLoadPerSession === null ? '—' : formatNumber(stats.avgLoadPerSession)}
          unit={stats.avgLoadPerSession === null ? undefined : 'AU'}
        />
        <Card className="flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">Tu código de entrenador</p>
            <p className="metric mt-2 text-2xl text-volt-500">{coach.coach_code}</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <CopyCodeButton code={coach.coach_code} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-500">
              <Copy className="h-3 w-3" />
              lordgym.app/join/{coach.coach_code.replace('LORD-', '')}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
