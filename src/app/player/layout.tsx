import { requireAthlete } from '@/lib/auth/guards';
import { unreadMessageCount } from '@/lib/services/messages';
import { PlayerShell } from '@/components/shell/player-shell';

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAthlete();
  const unread = await unreadMessageCount(user.id);

  return <PlayerShell unreadCount={unread}>{children}</PlayerShell>;
}
