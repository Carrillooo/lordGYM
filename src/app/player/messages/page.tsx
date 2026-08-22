import { requireAthlete } from '@/lib/auth/guards';
import { coachOfAthlete } from '@/lib/services/roster';
import { markThreadRead, threadMessages } from '@/lib/services/messages';
import { fullName } from '@/lib/domain/labels';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ChatThread } from '@/components/messages/chat-thread';

export const metadata = { title: 'Mensajes' };

export default async function PlayerMessagesPage() {
  const { user, athlete } = await requireAthlete();
  const coach = await coachOfAthlete(athlete.id);

  if (!coach) {
    return (
      <div className="space-y-5">
        <PageHeader title="Mensajes" />
        <EmptyState
          title="Sin entrenador vinculado"
          description="Cuando te unas a un equipo podrás hablar con tu entrenador desde aquí."
        />
      </div>
    );
  }

  const messages = await threadMessages(coach.coach.id, athlete.id);
  await markThreadRead(user.id, coach.coach.id, athlete.id);

  return (
    <div className="space-y-5">
      <PageHeader title="Mensajes" description={fullName(coach.profile.first_name, coach.profile.last_name)} />
      <Card className="flex h-[68dvh] flex-col">
        <ChatThread
          messages={messages}
          currentUserId={user.id}
          recipientId={coach.coach.user_id}
          recipientName={fullName(coach.profile.first_name, coach.profile.last_name)}
        />
      </Card>
    </div>
  );
}
