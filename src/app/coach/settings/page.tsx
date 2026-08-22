import { requireCoach } from '@/lib/auth/guards';
import { getRoster, listTeams } from '@/lib/services/roster';
import { STAFF_ROLE_LABELS, fullName } from '@/lib/domain/labels';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { CopyCodeButton } from '@/components/coach/copy-code-button';
import { AccountForm } from '@/components/settings/account-form';
import { PasswordForm } from '@/components/settings/password-form';
import { TeamsPanel } from '@/components/coach/teams-panel';

export const metadata = { title: 'Configuración' };

export default async function CoachSettingsPage() {
  const { profile, coach, user } = await requireCoach();
  const [roster, teams] = await Promise.all([getRoster(coach.id), listTeams(coach.id)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Cuenta" title="Configuración" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tu perfil" subtitle={user.email} />
          <AccountForm profile={profile} />
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Contraseña" subtitle="Se te pide la actual para poder cambiarla." />
            <PasswordForm />
          </Card>

          <Card>
            <CardHeader title="Código de entrenador" subtitle="Compártelo para que los jugadores se unan a tu equipo." />
            <p className="metric text-3xl text-volt-500">{coach.coach_code}</p>
            <p className="mt-2 text-xs text-ink-500">
              Enlace directo: lordgym.app/join/{coach.coach_code.replace('LORD-', '')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyCodeButton code={coach.coach_code} />
              <CopyCodeButton
                code={`https://lordgym.app/join/${coach.coach_code.replace('LORD-', '')}`}
                label="Copiar enlace"
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Rol en el staff" subtitle="Arquitectura preparada para varios roles (§55)." />
            <div className="flex flex-wrap gap-2">
              {Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
                <Badge key={value} tone={value === coach.staff_role ? 'volt' : 'neutral'}>
                  {label}
                  {value !== 'head_coach' ? ' · próximamente' : ''}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">
              El MVP activa únicamente «Entrenador principal». Preparador físico y fisioterapeuta comparten el mismo
              modelo de datos y se habilitarán sin migración.
            </p>
          </Card>
        </div>
      </div>

      <TeamsPanel
        teams={teams.map(({ team, athleteIds }) => ({ id: team.id, name: team.name, athleteIds }))}
        athletes={roster.map((entry) => ({
          id: entry.athlete.id,
          name: fullName(entry.profile.first_name, entry.profile.last_name),
        }))}
      />
    </div>
  );
}
