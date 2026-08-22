import { requireCoach } from '@/lib/auth/guards';
import { assignmentsForCoach } from '@/lib/services/assignments';
import { getRoster } from '@/lib/services/roster';
import { listWorkouts } from '@/lib/services/workouts';
import { addDays, endOfMonth, monthGrid, startOfMonth, startOfWeek, todayKey } from '@/lib/domain/datetime';
import { fullName } from '@/lib/domain/labels';
import { PageHeader } from '@/components/ui/primitives';
import { CoachCalendar } from '@/components/coach/calendar/coach-calendar';

export const metadata = { title: 'Calendario' };

export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; athlete?: string }>;
}) {
  const { coach } = await requireCoach();
  const { view, date, athlete } = await searchParams;

  const today = todayKey();
  const anchor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const mode = view === 'day' || view === 'month' ? view : 'week';

  const range =
    mode === 'day'
      ? { from: anchor, to: anchor }
      : mode === 'week'
        ? { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
        : { from: monthGrid(anchor)[0], to: monthGrid(anchor)[41] };

  const [assignments, roster, workouts] = await Promise.all([
    assignmentsForCoach(coach.id, range.from, range.to),
    getRoster(coach.id, today),
    listWorkouts(coach.id),
  ]);

  const filtered = athlete ? assignments.filter((view_) => view_.assignment.athlete_id === athlete) : assignments;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planificación"
        title="Calendario"
        description="Arrastra una sesión a otro día para reprogramarla. Los cambios se guardan al soltar."
      />

      <CoachCalendar
        mode={mode}
        anchor={anchor}
        today={today}
        monthStart={startOfMonth(anchor)}
        monthEnd={endOfMonth(anchor)}
        selectedAthleteId={athlete ?? null}
        athletes={roster.map((entry) => ({
          id: entry.athlete.id,
          name: fullName(entry.profile.first_name, entry.profile.last_name),
          team: entry.teamNames[0] ?? null,
        }))}
        workouts={workouts.map((workout) => ({ id: workout.id, name: workout.name }))}
        events={filtered.map((item) => ({
          assignmentId: item.assignment.id,
          date: item.assignment.scheduled_date,
          time: item.assignment.scheduled_time,
          status: item.assignment.status,
          workoutName: item.workout.name,
          athleteId: item.assignment.athlete_id,
          athleteName: item.athleteProfile
            ? fullName(item.athleteProfile.first_name, item.athleteProfile.last_name)
            : 'Jugador',
        }))}
      />
    </div>
  );
}
