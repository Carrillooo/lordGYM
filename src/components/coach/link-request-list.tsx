'use client';

import { useActionState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import type { CoachAthleteRow, ProfileRow } from '@/types/db';
import { respondToLinkAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { fullName } from '@/lib/domain/labels';
import { formatShortDate } from '@/lib/domain/datetime';
import { Avatar, Card, CardHeader } from '@/components/ui/primitives';
import { SubmitButton } from '@/components/ui/form';

export function LinkRequestList({ requests }: { requests: { link: CoachAthleteRow; profile: ProfileRow }[] }) {
  const [state, formAction] = useActionState(respondToLinkAction, idleState);

  return (
    <Card className="border-volt-500/25 bg-volt-500/[0.04]">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-volt-500" />
            Solicitudes pendientes
          </span>
        }
        subtitle={`${requests.length} jugador(es) quieren unirse a tu equipo`}
      />
      {state.status !== 'idle' && state.message ? (
        <p className={state.status === 'error' ? 'mb-3 text-sm text-danger-500' : 'mb-3 text-sm text-success-500'}>
          {state.message}
        </p>
      ) : null}
      <ul className="space-y-2">
        {requests.map(({ link, profile }) => (
          <li
            key={link.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/50 p-3"
          >
            <Avatar name={fullName(profile.first_name, profile.last_name)} src={profile.avatar_url} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-100">
                {fullName(profile.first_name, profile.last_name)}
              </p>
              <p className="text-xs text-ink-400">Solicitud del {formatShortDate(link.requested_at.slice(0, 10))}</p>
            </div>
            <form action={formAction} className="flex gap-2">
              <input type="hidden" name="linkId" value={link.id} />
              <SubmitButton name="decision" value="accept" size="sm" pendingLabel="…">
                <Check className="h-4 w-4" />
                Aceptar
              </SubmitButton>
              <SubmitButton name="decision" value="reject" size="sm" variant="danger" pendingLabel="…">
                <X className="h-4 w-4" />
                Rechazar
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </Card>
  );
}
