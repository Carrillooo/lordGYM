import 'server-only';
import { db } from '@/lib/db';
import { newId, threadKey } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import { fullName } from '@/lib/domain/labels';
import { ServiceError } from './accounts';
import { notify } from './notifications';
import type { MessageRow, ProfileRow } from '@/types/db';

export interface ThreadSummary {
  athleteId: string;
  coachId: string;
  key: string;
  counterpart: ProfileRow;
  lastMessage: MessageRow | null;
  unread: number;
}

/** Comprueba que los dos usuarios tienen un vínculo entrenador↔jugador activo. */
async function resolveThread(senderUserId: string, recipientUserId: string): Promise<string> {
  const [senderProfile] = await db().select('profiles', { user_id: senderUserId });
  const [recipientProfile] = await db().select('profiles', { user_id: recipientUserId });
  if (!senderProfile || !recipientProfile) throw new ServiceError('Usuario no encontrado.');
  if (senderProfile.role === recipientProfile.role) {
    throw new ServiceError('Sólo hay conversaciones entre entrenador y jugador.');
  }

  const coachUserId = senderProfile.role === 'coach' ? senderUserId : recipientUserId;
  const athleteUserId = senderProfile.role === 'coach' ? recipientUserId : senderUserId;
  const [coach] = await db().select('coaches', { user_id: coachUserId });
  const [athlete] = await db().select('athletes', { user_id: athleteUserId });
  if (!coach || !athlete) throw new ServiceError('Conversación no disponible.');

  const [link] = await db().select('coach_athletes', {
    coach_id: coach.id,
    athlete_id: athlete.id,
    status: 'active',
  });
  if (!link) throw new ServiceError('No existe vínculo activo entre esos usuarios.');
  return threadKey(coach.id, athlete.id);
}

export async function sendMessage(
  senderUserId: string,
  input: { recipientId: string; body: string; attachmentUrl?: string; attachmentType?: 'image' | 'video' },
): Promise<MessageRow> {
  const key = await resolveThread(senderUserId, input.recipientId);
  const row: MessageRow = {
    id: newId(),
    thread_key: key,
    sender_id: senderUserId,
    recipient_id: input.recipientId,
    body: input.body,
    attachment_url: input.attachmentUrl ?? null,
    attachment_type: input.attachmentType ?? null,
    created_at: nowIso(),
    read_at: null,
  };
  await db().insert('messages', row);

  const [senderProfile] = await db().select('profiles', { user_id: senderUserId });
  await notify(input.recipientId, {
    type: 'comment',
    title: senderProfile ? `Mensaje de ${fullName(senderProfile.first_name, senderProfile.last_name)}` : 'Nuevo mensaje',
    body: input.body.slice(0, 120),
    link: senderProfile?.role === 'coach' ? '/player/messages' : '/coach/messages',
  });
  return row;
}

export async function threadMessages(coachId: string, athleteId: string): Promise<MessageRow[]> {
  return db().select(
    'messages',
    { thread_key: threadKey(coachId, athleteId) },
    { orderBy: { column: 'created_at' } },
  );
}

export async function markThreadRead(userId: string, coachId: string, athleteId: string): Promise<void> {
  const rows = await db().select('messages', {
    thread_key: threadKey(coachId, athleteId),
    recipient_id: userId,
    read_at: null,
  });
  await Promise.all(rows.map((row) => db().update('messages', row.id, { read_at: nowIso() })));
}

/** Bandeja del entrenador: una conversación por jugador vinculado. */
export async function coachThreads(coachId: string, coachUserId: string): Promise<ThreadSummary[]> {
  const links = await db().select('coach_athletes', { coach_id: coachId, status: 'active' });
  if (links.length === 0) return [];
  const athletes = await db().select('athletes', { id: { in: links.map((l) => l.athlete_id) } });
  const profiles = await db().select('profiles', { user_id: { in: athletes.map((a) => a.user_id) } });
  const messages = await db().select('messages', { thread_key: { in: links.map((l) => threadKey(coachId, l.athlete_id)) } });

  return athletes
    .flatMap((athlete) => {
      const profile = profiles.find((p) => p.user_id === athlete.user_id);
      if (!profile) return [];
      const key = threadKey(coachId, athlete.id);
      const own = messages.filter((m) => m.thread_key === key).sort((a, b) => a.created_at.localeCompare(b.created_at));
      return [
        {
          athleteId: athlete.id,
          coachId,
          key,
          counterpart: profile,
          lastMessage: own[own.length - 1] ?? null,
          unread: own.filter((m) => m.recipient_id === coachUserId && m.read_at === null).length,
        },
      ];
    })
    .sort((a, b) => (b.lastMessage?.created_at ?? '').localeCompare(a.lastMessage?.created_at ?? ''));
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const rows = await db().select('messages', { recipient_id: userId, read_at: null });
  return rows.length;
}
