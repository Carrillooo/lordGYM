import Link from 'next/link';
import { Activity, ArrowRight, Bell, Download, Flame, HeartPulse, MessageSquare, PlayCircle, TrendingUp } from 'lucide-react';
import { requireAthlete } from '@/lib/auth/guards';
import { athleteOverview } from '@/lib/services/progress';
import { expireOverdueAssignments, nextAssignment, unfinishedSession } from '@/lib/services/assignments';
import { coachOfAthlete } from '@/lib/services/roster';
import { listNotifications } from '@/lib/services/notifications';
import { wellnessToday } from '@/lib/services/wellness';
import { listVisibleNotes } from '@/lib/services/coach-notes';
import { getSessionDetail } from '@/lib/services/sessions';
import { relativeDayLabel, todayKey } from '@/lib/domain/datetime';
import { formatNumber, formatPercent } from '@/lib/domain/labels';
import { Badge, Card, CardHeader, EmptyState, ProgressBar, Stat } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { StartSessionButton } from '@/components/player/start-session-button';
import { JoinCoachForm } from '@/components/player/join-coach-form';

export const metadata = { title: 'Inicio' };

export default async function PlayerHomePage() {
  const { profile, athlete } = await requireAthlete();
  const today = todayKey();

  await expireOverdueAssignments(athlete.id, today);

  const [overview, next, unfinished, coach, notifications, checkIn, notes] = await Promise.all([
    athleteOverview(athlete.id, today),
    nextAssignment(athlete.id, today),
    unfinishedSession(athlete.id),
    coachOfAthlete(athlete.id),
    listNotifications(profile.user_id, 5),
    wellnessToday(athlete.id, today),
    listVisibleNotes(athlete.id),
  ]);

  const resumable = unfinished ? await getSessionDetail(unfinished.id) : null;

  if (!coach) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm text-ink-400">Hola, {profile.first_name} 👋</p>
          <h1 className="display mt-1 text-3xl text-ink-50">Conecta con tu entrenador</h1>
        </header>
        <JoinCoachForm />
        <EmptyState
          title="Todavía no tienes entrenador"
          description="Introduce el código que te haya dado (por ejemplo LORD-A7K29) y le llegará tu solicitud."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-400">Hola, {profile.first_name} 👋</p>
          <h1 className="display mt-0.5 text-2xl text-ink-50">
            {next && next.assignment.scheduled_date === today ? 'Toca entrenar' : 'Tu semana'}
          </h1>
        </div>
        <Link
          href="/player/messages"
          aria-label="Mensajes"
          className="rounded-xl border border-ink-800 p-2.5 text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-50"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
      </header>

      {resumable && resumable.completedSets > 0 ? (
        <Card className="border-volt-500/30 bg-volt-500/[0.05]">
          <CardHeader
            title="Continuar entrenamiento"
            subtitle={`${resumable.workoutName} · ${resumable.completedSets}/${resumable.totalSets} series`}
          />
          <ProgressBar
            value={(resumable.completedSets / Math.max(1, resumable.totalSets)) * 100}
            showLabel
            className="mb-4"
          />
          <ButtonLink href={`/player/workout/${resumable.session.id}`} className="w-full" size="lg">
            <PlayCircle className="h-5 w-5" />
            Reanudar sesión
          </ButtonLink>
        </Card>
      ) : null}

      {next ? (
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-volt-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Badge tone="volt">{relativeDayLabel(next.assignment.scheduled_date, today)}</Badge>
              {next.assignment.scheduled_time ? <Badge>{next.assignment.scheduled_time}</Badge> : null}
            </div>
            <h2 className="display mt-3 text-2xl uppercase text-ink-50">{next.workout.name}</h2>
            {next.workout.estimated_minutes ? (
              <p className="mt-1 text-sm text-ink-400">
                {next.workout.estimated_minutes} min estimados
                {next.workout.goal ? ` · ${next.workout.goal}` : ''}
              </p>
            ) : null}
            {next.assignment.notes ? (
              <p className="mt-3 rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2 text-sm text-ink-300">
                {next.assignment.notes}
              </p>
            ) : null}

            <div className="mt-5 space-y-2">
              {next.session ? (
                <ButtonLink href={`/player/workout/${next.session.id}`} size="xl" className="w-full">
                  <PlayCircle className="h-5 w-5" />
                  Continuar entrenamiento
                </ButtonLink>
              ) : (
                <StartSessionButton assignmentId={next.assignment.id} />
              )}
              <a
                href={`/player/plan/${next.assignment.id}/pdf`}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-700 text-sm font-medium text-ink-300 transition-colors active:bg-ink-800"
              >
                <Download className="h-4 w-4" />
                Descargar en PDF
              </a>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No tienes entrenamientos pendientes"
          description="Tu entrenador todavía no te ha asignado la próxima sesión."
          action={
            <ButtonLink href="/player/calendar" variant="secondary">
              Ver calendario
            </ButtonLink>
          }
        />
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Racha"
          value={overview.streak}
          unit="días"
          tone={overview.streak >= 3 ? 'volt' : 'neutral'}
          icon={<Flame className="h-4 w-4" />}
        />
        <Stat
          label="Semana"
          value={`${overview.weeklyCompleted}/${overview.weeklyAssigned}`}
          icon={<Activity className="h-4 w-4" />}
        />
        <Stat label="Carga" value={formatNumber(overview.weeklyLoadAu)} unit="AU" icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {overview.streak >= 3 || overview.recordCount > 0 || overview.adherencePercent >= 90 ? (
        <Card className="flex flex-wrap items-center gap-2">
          {overview.streak >= 3 ? <Badge tone="volt">🔥 {overview.streak} días activo</Badge> : null}
          {overview.recordCount > 0 ? <Badge tone="violet">🏆 {overview.recordCount} récords</Badge> : null}
          {overview.adherencePercent >= 90 ? (
            <Badge tone="success">✅ {formatPercent(overview.adherencePercent)} adherencia</Badge>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-teal-glow" />
              Check-in de hoy
            </span>
          }
          subtitle={checkIn ? 'Ya lo has completado. Puedes actualizarlo.' : 'Un minuto: ayuda a ajustar tus cargas.'}
          action={
            <Link
              href="/player/wellness"
              className="-mr-2 flex h-11 items-center px-2 text-xs font-medium text-volt-500"
            >
              {checkIn ? 'Editar' : 'Rellenar'}
            </Link>
          }
        />
        {checkIn ? (
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              ['Sueño', checkIn.sleep],
              ['Energía', checkIn.energy],
              ['Estrés', checkIn.stress],
              ['Fatiga', checkIn.fatigue],
              ['Dolor', checkIn.soreness],
              ['Motivación', checkIn.motivation],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-ink-900/60 px-2 py-2.5">
                <p className="metric text-lg text-ink-50">{value}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <ButtonLink href="/player/wellness" variant="secondary" className="w-full">
            Hacer check-in
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        )}
      </Card>

      {notes.length > 0 ? (
        <Card>
          <CardHeader title="Notas de tu entrenador" />
          <ul className="space-y-2">
            {notes.slice(0, 3).map((note) => (
              <li key={note.id} className="rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2 text-sm text-ink-200">
                {note.body}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {notifications.length > 0 ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-ink-500" />
                Novedades
              </span>
            }
          />
          <ul className="divide-y divide-ink-850">
            {notifications.map((notification) => (
              <li key={notification.id} className="py-2.5">
                <p className="text-sm text-ink-100">{notification.title}</p>
                {notification.body ? <p className="text-xs text-ink-400">{notification.body}</p> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
