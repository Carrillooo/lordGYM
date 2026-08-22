import { requireCoach } from '@/lib/auth/guards';
import { fullName } from '@/lib/domain/labels';
import { unreadMessageCount } from '@/lib/services/messages';
import { pendingRequests } from '@/lib/services/roster';
import { CoachShell } from '@/components/shell/coach-shell';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, coach } = await requireCoach();
  const [unread, requests] = await Promise.all([
    unreadMessageCount(user.id),
    pendingRequests(coach.id),
  ]);

  return (
    <CoachShell
      coachName={fullName(profile.first_name, profile.last_name)}
      coachCode={coach.coach_code}
      avatarUrl={profile.avatar_url}
      unreadCount={unread}
      pendingRequests={requests.length}
    >
      {children}
    </CoachShell>
  );
}
