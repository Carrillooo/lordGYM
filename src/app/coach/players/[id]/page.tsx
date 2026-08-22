import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, MessageSquare, Quote, Ruler, Target, Video, Weight } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { getAthleteForCoach } from '@/lib/services/roster';
import {
  athleteOverview,
  bodyweightSeries,
  loadSeries,
  personalRecords,
  volumeSeries,
} from '@/lib/services/progress';
import { recentAthleteFeedback, recentSessions } from '@/lib/services/sessions';
import { assignmentsForAthlete } from '@/lib/services/assignments';
import { wellnessHistory, painHistory } from '@/lib/services/wellness';
import { testProgressForAthlete } from '@/lib/services/tests';
import { goalsWithProgress, listCoachNotes } from '@/lib/services/coach-notes';
import { ageFromBirthDate, formatShortDate, relativeDayLabel, todayKey } from '@/lib/domain/datetime';
import { formatKg, formatNumber, formatPercent, formatSigned, fullName } from '@/lib/domain/labels';
import { Avatar, Badge, Card, CardHeader, ProgressBar, Stat } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { TrendChart } from '@/components/charts/charts';
import { AthleteStatusBadge } from '@/components/coach/athlete-status';
import { ExerciseProgressPanel } from '@/components/progress/exercise-progress-panel';
import { CoachNotesPanel } from '@/components/coach/coach-notes-panel';
import { AthleteFicheForm } from '@/components/coach/athlete-fiche-form';
import { getRosterStatus } from '@/lib/services/roster-status';

export const metadata = { title: 'Ficha del jugador' };

export default async function CoachPlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exercise?: string; metric?: string }>;
}) {
  const { coach } = await requireCoach();
  const { id } = await params;
  const { exercise, metric } = await searchParams;

  const record = await getAthleteForCoach(coach.id, id);
  if (!record) notFound();

  const { athlete, profile } = record;
  const today = todayKey();
  const name = fullName(profile.first_name, profile.last_name);

  const [
    overview,
    records,
    sessions,
    upcoming,
    wellness,
    pains,
    tests,
    goals,
    notes,
    weights,
    load,
    volume,
    status,
    feedback,
  ] = await Promise.all([
    athleteOverview(athlete.id, today),
    personalRecords(athlete.id),
    recentSessions(athlete.id, 8),
    assignmentsForAthlete(athlete.id, today, '2100-01-01'),
    wellnessHistory(athlete.id, 21, today),
    painHistory(athlete.id, 60, today),
    testProgressForAthlete(athlete.id),
    goalsWithProgress(athlete.id),
    listCoachNotes(coach.id, athlete.id),
    bodyweightSeries(athlete.id),
    loadSeries(athlete.id, 28, today),
    volumeSeries(athlete.id, 8, today),
    getRosterStatus(coach.id, athlete.id, today),
    recentAthleteFeedback(athlete.id, 6),
  ]);

  const age = ageFromBirthDate(profile.birth_date, today);

  return (
    <div className="space-y-6">
      <Link
        href="/coach/players"
        className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Mis jugadores
      </Link>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={name} src={profile.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="display text-2xl text-ink-50 sm:text-3xl">{name}</h1>
              {status ? <AthleteStatusBadge status={status.status} /> : null}
            </div>
            <p className="mt-1 text-sm text-ink-400">
              {[age ? `${age} años` : null, athlete.sport, athlete.position, athlete.team_name]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-400">
              {athlete.height_cm ? (
                <Badge>
                  <Ruler className="h-3 w-3" />
                  {formatNumber(athlete.height_cm)} cm
                </Badge>
              ) : null}
              {athlete.weight_kg ? (
                <Badge>
                  <Weight className="h-3 w-3" />
                  {formatKg(athlete.weight_kg)}
                </Badge>
              ) : null}
              {athlete.laterality ? <Badge>{athlete.laterality}</Badge> : null}
              <Badge>Desde {formatShortDate(athlete.created_at.slice(0, 10))}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/coach/calendar?athlete=${athlete.id}`} size="sm">
              <CalendarPlus className="h-4 w-4" />
              Asignar sesión
            </ButtonLink>
            <ButtonLink href={`/coach/messages?athlete=${athlete.id}`} variant="secondary" size="sm">
              <MessageSquare className="h-4 w-4" />
              Mensaje
            </ButtonLink>
          </div>
        </div>

        {(athlete.goals || athlete.injuries) && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {athlete.goals ? (
              <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Objetivos</p>
                <p className="mt-1 text-sm text-ink-200">{athlete.goals}</p>
              </div>
            ) : null}
            {athlete.injuries ? (
              <div className="rounded-xl border border-amber-glow/25 bg-amber-glow/[0.06] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-glow">Lesiones</p>
                <p className="mt-1 text-sm text-ink-200">{athlete.injuries}</p>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sesiones completadas" value={overview.completedSessions} hint={`${overview.pendingSessions} pendientes`} />
        <Stat
          label="Adherencia"
          value={formatPercent(overview.adherencePercent)}
          tone={overview.adherencePercent >= 85 ? 'success' : overview.adherencePercent >= 65 ? 'warning' : 'danger'}
        />
        <Stat label="Carga semanal" value={formatNumber(overview.weeklyLoadAu)} unit="AU" hint={overview.acwr !== null ? `Ratio agudo:crónico ${overview.acwr.toString().replace('.', ',')}` : undefined} />
        <Stat
          label="RPE medio"
          value={overview.avgRpe === null ? '—' : overview.avgRpe.toString().replace('.', ',')}
          tone={overview.avgRpe !== null && overview.avgRpe >= 8.5 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Volumen total" value={formatNumber(overview.totalVolumeKg)} unit="kg" />
        <Stat label="Récords" value={overview.recordCount} tone="volt" />
        <Stat label="Racha" value={overview.streak} unit="días" />
        <Stat
          label="Peso corporal"
          value={overview.latestWeightKg === null ? '—' : formatNumber(overview.latestWeightKg, 1)}
          unit={overview.latestWeightKg === null ? undefined : 'kg'}
        />
      </div>

      <ExerciseProgressPanel athleteId={athlete.id} exerciseId={exercise} metric={metric} showSuggestion />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Carga diaria" subtitle="Últimos 28 días · RPE × minutos" />
          <TrendChart data={load} unit="AU" color="violet" height={200} />
        </Card>
        <Card>
          <CardHeader title="Volumen semanal" subtitle="Kilos totales movidos por semana" />
          <TrendChart data={volume} unit="kg" color="data" height={200} variant="line" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Peso corporal" subtitle={`${weights.length} registros`} />
          <TrendChart data={weights} unit="kg" color="teal" height={200} variant="line" />
        </Card>

        <Card>
          <CardHeader
            title="Wellness"
            subtitle={
              overview.avgFatigue !== null
                ? `Fatiga media ${overview.avgFatigue.toString().replace('.', ',')}/5 · Sueño ${
                    overview.avgSleep?.toString().replace('.', ',') ?? '—'
                  }/5`
                : 'Sin check-ins todavía'
            }
          />
          <TrendChart
            data={wellness.map((row) => ({ date: row.date, value: row.fatigue }))}
            color="amber"
            height={200}
            variant="line"
          />
          {pains.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {pains.slice(0, 3).map((pain) => (
                <li
                  key={pain.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-2 text-sm"
                >
                  <span className="text-ink-200">
                    {pain.body_part} · {pain.side}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-ink-500">{formatShortDate(pain.date)}</span>
                    <Badge tone={pain.intensity >= 7 ? 'danger' : pain.intensity >= 4 ? 'warning' : 'neutral'}>
                      {pain.intensity}/10
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Récords personales" subtitle={`${records.length} marcas registradas`} />
          {records.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">Todavía no hay récords.</p>
          ) : (
            <ul className="divide-y divide-ink-850">
              {records.slice(0, 8).map(({ record, exerciseName }) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-2.5">
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

        <Card>
          <CardHeader title="Objetivos" subtitle="Progreso hacia las metas fijadas" />
          {goals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">Sin objetivos definidos.</p>
          ) : (
            <ul className="space-y-4">
              {goals.map(({ goal, currentValue, percent, achieved }) => (
                <li key={goal.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-ink-100">
                      <Target className="h-3.5 w-3.5 text-ink-500" />
                      {goal.title}
                    </span>
                    <span className="tabular text-xs text-ink-400">
                      {currentValue === null ? '—' : formatNumber(currentValue, 2)} / {formatNumber(goal.target_value, 2)}{' '}
                      {goal.unit}
                    </span>
                  </div>
                  <ProgressBar className="mt-2" value={percent} tone={achieved ? 'success' : 'volt'} showLabel />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Últimas sesiones" subtitle="Resultado registrado por el jugador" />
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">Sin sesiones completadas.</p>
          ) : (
            <ul className="divide-y divide-ink-850">
              {sessions.map((session) => (
                <li key={session.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-ink-100">
                      {relativeDayLabel((session.completed_at ?? session.started_at).slice(0, 10), today)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={(session.session_rpe ?? 0) >= 8.5 ? 'danger' : 'neutral'}>
                        RPE {session.session_rpe?.toString().replace('.', ',') ?? '—'}
                      </Badge>
                      <Badge tone="data">{formatNumber(session.total_volume_kg)} kg</Badge>
                    </span>
                  </div>
                  {session.comment ? <p className="mt-1 text-xs text-ink-400">«{session.comment}»</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Próximas sesiones" subtitle={`${upcoming.length} asignadas`} />
          {upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">Nada programado. Asigna desde el calendario.</p>
          ) : (
            <ul className="divide-y divide-ink-850">
              {upcoming.slice(0, 8).map((view) => (
                <li key={view.assignment.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink-100">{view.workout.name}</span>
                    <span className="block text-xs text-ink-500">
                      {relativeDayLabel(view.assignment.scheduled_date, today)}
                      {view.assignment.scheduled_time ? ` · ${view.assignment.scheduled_time}` : ''}
                    </span>
                  </span>
                  <Badge tone={view.assignment.status === 'started' ? 'volt' : 'neutral'}>
                    {view.assignment.status === 'started' ? 'En curso' : 'Pendiente'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {tests.length > 0 ? (
        <Card>
          <CardHeader title="Tests" subtitle="Evolución de las pruebas físicas" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-500">
                  <th scope="col" className="py-2 pr-3 font-medium">Prueba</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Primera</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Última</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Mejor</th>
                  <th scope="col" className="py-2 font-medium">Mejora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-850">
                {tests.map((entry) => (
                  <tr key={entry.test.id}>
                    <td className="py-2.5 pr-3 text-ink-100">{entry.test.name}</td>
                    <td className="tabular py-2.5 pr-3 text-ink-300">
                      {formatNumber(entry.first, 2)} {entry.test.unit}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-ink-100">
                      {formatNumber(entry.latest, 2)} {entry.test.unit}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-ink-300">
                      {formatNumber(entry.best, 2)} {entry.test.unit}
                    </td>
                    <td
                      className={
                        (entry.improvementPercent ?? 0) >= 0
                          ? 'tabular py-2.5 font-semibold text-success-500'
                          : 'tabular py-2.5 font-semibold text-danger-500'
                      }
                    >
                      {formatSigned(entry.improvementPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {feedback.length > 0 ? (
        <Card>
          <CardHeader
            title="Comentarios del jugador"
            subtitle="Lo que ha escrito durante sus sesiones (§75, §77)"
          />
          <ul className="space-y-2">
            {feedback.map((item, index) => (
              <li key={`${item.sessionId}-${index}`} className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink-100">{item.exerciseName}</span>
                  <span className="text-xs text-ink-500">{formatShortDate(item.date)}</span>
                </div>
                {item.comment ? (
                  <p className="mt-1.5 flex items-start gap-2 text-sm text-ink-300">
                    <Quote className="mt-0.5 h-3 w-3 shrink-0 text-ink-600" />
                    {item.comment}
                  </p>
                ) : null}
                {item.videoUrl ? (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-data-500 hover:underline"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Ver vídeo de la serie
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CoachNotesPanel athleteId={athlete.id} notes={notes} />
        <AthleteFicheForm athlete={athlete} coachId={coach.id} />
      </div>
    </div>
  );
}
