import 'server-only';
import { db } from '@/lib/db';
import { newId } from '@/lib/domain/ids';
import { nowIso } from '@/lib/domain/datetime';
import type { NotificationRow } from '@/types/db';

export async function notify(
  userId: string,
  input: Pick<NotificationRow, 'type' | 'title'> & Partial<Pick<NotificationRow, 'body' | 'link'>>,
): Promise<void> {
  await db().insert('notifications', {
    id: newId(),
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    created_at: nowIso(),
    read_at: null,
  });
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationRow[]> {
  return db().select('notifications', { user_id: userId }, { orderBy: { column: 'created_at', ascending: false }, limit });
}

export async function unreadCount(userId: string): Promise<number> {
  const rows = await db().select('notifications', { user_id: userId, read_at: null });
  return rows.length;
}

export async function markAllRead(userId: string): Promise<void> {
  const rows = await db().select('notifications', { user_id: userId, read_at: null });
  await Promise.all(rows.map((row) => db().update('notifications', row.id, { read_at: nowIso() })));
}
