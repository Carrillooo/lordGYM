import Link from 'next/link';
import { HeartPulse, LogOut, MessageSquare } from 'lucide-react';
import { requireAthlete } from '@/lib/auth/guards';
import { coachOfAthlete } from '@/lib/services/roster';
import { athleteOverview } from '@/lib/services/progress';
import { ageFromBirthDate, formatShortDate, todayKey } from '@/lib/domain/datetime';
import { formatKg, formatNumber, formatPercent, fullName } from '@/lib/domain/labels';
import { Avatar, Badge, Card, CardHeader, PageHeader, Stat } from '@/components/ui/primitives';
import { AccountForm } from '@/components/settings/account-form';
import { PasswordForm } from '@/components/settings/password-form';
import { AthleteFicheForm } from '@/components/coach/athlete-fiche-form';
import { JoinCoachForm } from '@/components/player/join-coach-form';
import { LogoutButton } from '@/components/shell/logout-button';

export const metadata = { title: 'Perfil' };

export default async function PlayerProfilePage() {
  const { profile, athlete, user } = await requireAthlete();
  const today = todayKey();

  const [coach, overview] = await Promise.all([coachOfAthlete(athlete.id), athleteOverview(athlete.id, today)]);
  const name = fullName(profile.first_name, profile.last_name);
  const age = ageFromBirthDate(profile.birth_date, today);

  return (
    <div className="space-y-5">
      <PageHeader title="Perfil" />

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={name} src={profile.avatar_url} size={64} />
          <div className="min-w-0 flex-1">
            <h2 className="display text-xl text-ink-50">{name}</h2>
            <p className="mt-0.5 text-sm text-ink-400">
              {[age ? `${age} años` : null, athlete.sport, athlete.position].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-1 text-xs text-ink-500">Miembro desde {formatShortDate(athlete.created_at.slice(0, 10))}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {athlete.team_name ? <Badge tone="data">{athlete.team_name}</Badge> : null}
          {athlete.height_cm ? <Badge>{formatNumber(athlete.height_cm)} cm</Badge> : null}
          {athlete.weight_kg ? <Badge>{formatKg(athlete.weight_kg)}</Badge> : null}
          {athlete.laterality ? <Badge>{athlete.laterality}</Badge> : null}
        </div>

        {coach ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 p-3">
            <Avatar name={fullName(coach.profile.first_name, coach.profile.last_name)} src={coach.profile.avatar_url} size={38} />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-ink-500">Tu entrenador</p>
              <p className="truncate text-sm font-medium text-ink-100">
                {fullName(coach.profile.first_name, coach.profile.last_name)}
              </p>
            </div>
            <Link
              href="/player/messages"
              aria-label="Escribir a tu entrenador"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink-700 text-ink-300 transition-colors hover:border-volt-500 hover:text-volt-500"
            >
              <MessageSquare className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sesiones" value={overview.completedSessions} />
        <Stat label="Adherencia" value={formatPercent(overview.adherencePercent)} tone="success" />
        <Stat label="Racha" value={overview.streak} unit="días" tone="volt" />
        <Stat label="Récords" value={overview.recordCount} />
      </div>

      <Link
        href="/player/wellness"
        className="card card-hover flex items-center gap-3 p-4 text-sm text-ink-100"
      >
        <HeartPulse className="h-5 w-5 text-teal-glow" />
        Check-in de bienestar y mapa de dolor
      </Link>

      {!coach ? <JoinCoachForm /> : null}

      <AthleteFicheForm athlete={athlete} />

      <Card>
        <CardHeader title="Cuenta" subtitle={user.email} />
        <AccountForm profile={profile} />
      </Card>

      <Card>
        <CardHeader title="Contraseña" subtitle="Se te pide la actual para poder cambiarla." />
        <PasswordForm />
      </Card>

      <LogoutButton className="card card-hover flex w-full items-center justify-center gap-2 p-4 text-sm font-medium text-danger-500">
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </LogoutButton>
    </div>
  );
}
