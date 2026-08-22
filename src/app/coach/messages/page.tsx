import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { coachThreads, markThreadRead, threadMessages } from '@/lib/services/messages';
import { db } from '@/lib/db';
import { fullName } from '@/lib/domain/labels';
import { formatTime } from '@/lib/domain/datetime';
import { Avatar, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ChatThread } from '@/components/messages/chat-thread';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Mensajes' };

export default async function CoachMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string }>;
}) {
  const { user, coach } = await requireCoach();
  const { athlete } = await searchParams;

  const threads = await coachThreads(coach.id, user.id);
  if (threads.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Comunicación" title="Mensajes" />
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="Sin conversaciones"
          description="Cuando aceptes a un jugador podrás escribirle desde aquí."
        />
      </div>
    );
  }

  const active = threads.find((thread) => thread.athleteId === athlete) ?? threads[0];
  const [messages] = await Promise.all([threadMessages(coach.id, active.athleteId)]);
  await markThreadRead(user.id, coach.id, active.athleteId);

  const [athleteRow] = await db().select('athletes', { id: active.athleteId });
  const recipientUserId = athleteRow?.user_id ?? '';

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Comunicación" title="Mensajes" />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="p-2">
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread.key}>
                <Link
                  href={`/coach/messages?athlete=${thread.athleteId}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                    thread.athleteId === active.athleteId ? 'bg-ink-800' : 'hover:bg-ink-850',
                  )}
                >
                  <Avatar
                    name={fullName(thread.counterpart.first_name, thread.counterpart.last_name)}
                    src={thread.counterpart.avatar_url}
                    size={38}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-100">
                      {fullName(thread.counterpart.first_name, thread.counterpart.last_name)}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {thread.lastMessage ? thread.lastMessage.body : 'Sin mensajes'}
                    </span>
                  </span>
                  {thread.unread > 0 ? (
                    <span className="tabular shrink-0 rounded-full bg-volt-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">
                      {thread.unread}
                    </span>
                  ) : thread.lastMessage ? (
                    <span className="shrink-0 text-[10px] text-ink-600">{formatTime(thread.lastMessage.created_at)}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex h-[65dvh] flex-col">
          <ChatThread
            messages={messages}
            currentUserId={user.id}
            recipientId={recipientUserId}
            recipientName={fullName(active.counterpart.first_name, active.counterpart.last_name)}
          />
        </Card>
      </div>
    </div>
  );
}
