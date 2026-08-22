'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, LogOut, Menu, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LogoMark, Wordmark } from '@/components/brand/wordmark';
import { Avatar } from '@/components/ui/primitives';
import { COACH_NAV, isActive } from './nav-config';
import { LogoutButton } from './logout-button';

export function CoachShell({
  children,
  coachName,
  coachCode,
  avatarUrl,
  unreadCount,
  pendingRequests,
}: {
  children: ReactNode;
  coachName: string;
  coachCode: string;
  avatarUrl: string | null;
  unreadCount: number;
  pendingRequests: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navegación principal">
      {COACH_NAV.map((item) => {
        const active = isActive(pathname, item);
        const badge = item.href === '/coach/messages' ? unreadCount : item.href === '/coach/players' ? pendingRequests : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'bg-volt-500/12 text-volt-500' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50',
            )}
          >
            <span className={cn(active ? 'text-volt-500' : 'text-ink-400')}>{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {badge > 0 ? (
              <span className="tabular rounded-full bg-volt-500 px-1.5 py-0.5 text-[10px] font-bold text-ink-950">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar de escritorio */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-800 bg-ink-900/60 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/coach" className="mb-6 flex items-center gap-2.5 px-1">
          <LogoMark />
          <Wordmark size="sm" />
        </Link>
        {nav}
        <div className="mt-auto space-y-3 pt-4">
          <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Tu código</p>
            <p className="metric mt-0.5 text-sm text-volt-500">{coachCode}</p>
          </div>
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={coachName} src={avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-100">{coachName}</p>
              <p className="text-xs text-ink-500">Entrenador</p>
            </div>
            <LogoutButton className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-800 hover:text-danger-500">
              <LogOut className="h-4 w-4" />
            </LogoutButton>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Barra superior móvil */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg p-2 text-ink-200 transition-colors hover:bg-ink-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/coach" className="flex items-center gap-2">
            <Wordmark size="sm" />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/coach/search"
              aria-label="Buscar"
              className="rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/coach/messages"
              aria-label="Mensajes"
              className="relative rounded-lg p-2 text-ink-300 transition-colors hover:bg-ink-800"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-volt-500" />
              ) : null}
            </Link>
          </div>
        </header>

        {/* Cajón móvil */}
        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
            />
            <div className="animate-rise absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-ink-800 bg-ink-900 px-4 py-5">
              <div className="mb-6 flex items-center justify-between">
                <Wordmark size="sm" />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Cerrar menú"
                  className="rounded-lg p-2 text-ink-300 hover:bg-ink-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              <div className="mt-auto space-y-3 pt-4">
                <div className="rounded-xl border border-ink-800 bg-ink-850 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Tu código</p>
                  <p className="metric mt-0.5 text-sm text-volt-500">{coachCode}</p>
                </div>
                <LogoutButton className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-ink-800 hover:text-danger-500">
                  <LogOut className="h-[18px] w-[18px]" />
                  Cerrar sesión
                </LogoutButton>
              </div>
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
