import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { getRoster, pendingRequests } from '@/lib/services/roster';
import { ageFromBirthDate, relativeDayLabel } from '@/lib/domain/datetime';
import { formatPercent, fullName } from '@/lib/domain/labels';
import { Avatar, Card, EmptyState, PageHeader, ProgressBar } from '@/components/ui/primitives';
import { AthleteStatusBadge } from '@/components/coach/athlete-status';
import { LinkRequestList } from '@/components/coach/link-request-list';
import { CopyCodeButton } from '@/components/coach/copy-code-button';
import { RosterFilter } from '@/components/coach/roster-filter';

export const metadata = { title: 'Mis jugadores' };

export default async function CoachPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; team?: string }>;
}) {
  const { coach } = await requireCoach();
  const { q, status, team } = await searchParams;

  const [roster, requests] = await Promise.all([getRoster(coach.id), pendingRequests(coach.id)]);

  const teams = [...new Set(roster.flatMap((entry) => entry.teamNames))].sort();
  const query = (q ?? '').trim().toLowerCase();

  const filtered = roster.filter((entry) => {
    const name = fullName(entry.profile.first_name, entry.profile.last_name).toLowerCase();
    if (query && !name.includes(query) && !(entry.athlete.position ?? '').toLowerCase().includes(query)) return false;
    if (status && status !== 'all' && entry.status !== status) return false;
    if (team && team !== 'all' && !entry.teamNames.includes(team)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipo"
        title="Mis jugadores"
        description="Estado, cumplimiento y última sesión de cada deportista vinculado."
        action={<CopyCodeButton code={coach.coach_code} label={`Compartir ${coach.coach_code}`} />}
      />

      {requests.length > 0 ? <LinkRequestList requests={requests} /> : null}

      {roster.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Todavía no tienes jugadores"
          description={
            <>
              Comparte tu código para que se unan a tu equipo:
              <span className="metric mt-3 block text-2xl text-volt-500">{coach.coach_code}</span>
              <span className="mt-2 block text-xs text-ink-500">
                También pueden entrar por lordgym.app/join/{coach.coach_code.replace('LORD-', '')}
              </span>
            </>
          }
          action={<CopyCodeButton code={coach.coach_code} />}
        />
      ) : (
        <>
          <RosterFilter teams={teams} />

          {filtered.length === 0 ? (
            <Card className="text-center text-sm text-ink-400">Ningún jugador coincide con el filtro.</Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => {
                const name = fullName(entry.profile.first_name, entry.profile.last_name);
                const age = ageFromBirthDate(entry.profile.birth_date);
                return (
                  <li key={entry.athlete.id}>
                    <Link href={`/coach/players/${entry.athlete.id}`} className="card card-hover block h-full p-5">
                      <div className="flex items-start gap-3">
                        <Avatar name={name} src={entry.profile.avatar_url} size={48} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-ink-50">{name}</p>
                          <p className="truncate text-xs text-ink-400">
                            {[age ? `${age} años` : null, entry.athlete.position, entry.athlete.sport]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-600" />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <AthleteStatusBadge status={entry.status} />
                        {entry.teamNames.length > 0 ? (
                          <span className="truncate text-xs text-ink-500">{entry.teamNames.join(', ')}</span>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink-400">Cumplimiento semanal</span>
                          <span className="tabular font-medium text-ink-100">
                            {entry.weeklyCompleted}/{entry.weeklyAssigned} · {formatPercent(entry.weeklyAdherence)}
                          </span>
                        </div>
                        <ProgressBar
                          value={entry.weeklyAdherence}
                          tone={entry.weeklyAdherence >= 80 ? 'volt' : entry.weeklyAdherence >= 50 ? 'data' : 'danger'}
                        />
                      </div>

                      <p className="mt-3 text-xs text-ink-500">
                        Última sesión:{' '}
                        {entry.lastSessionAt ? relativeDayLabel(entry.lastSessionAt.slice(0, 10)) : 'sin registros'}
                        {entry.avgRpe !== null ? ` · RPE ${entry.avgRpe.toString().replace('.', ',')}` : ''}
                      </p>

                      {entry.statusReason ? (
                        <p className="mt-2 rounded-lg bg-ink-900/70 px-2.5 py-1.5 text-xs text-ink-400">
                          {entry.statusReason}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
