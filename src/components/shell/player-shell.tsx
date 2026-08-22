'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { isActive, PLAYER_NAV } from './nav-config';

/**
 * Contenedor del jugador: mobile-first con menú inferior (§45).
 * Durante el modo entrenamiento la navegación se oculta (§88): esas rutas
 * usan su propio layout sin este shell.
 */
export function PlayerShell({ children, unreadCount }: { children: ReactNode; unreadCount: number }) {
  const pathname = usePathname();

  // Modo entrenamiento (§88): pantalla limpia, sin navegación que distraiga.
  if (pathname.startsWith('/player/workout/')) {
    return <div className="min-h-dvh">{children}</div>;
  }

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-24">
      <main className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>

      <nav
        aria-label="Navegación"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch">
          {PLAYER_NAV.map((item) => {
            const active = isActive(pathname, item);
            const isTrain = item.href === '/player/today';
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-volt-500' : 'text-ink-400 hover:text-ink-200',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                      isTrain && !active && 'bg-ink-800 text-ink-100',
                      isTrain && active && 'bg-volt-500 text-ink-950',
                      active && !isTrain && 'bg-volt-500/12',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="relative">
                    {item.label}
                    {item.href === '/player' && unreadCount > 0 ? (
                      <span className="absolute -right-2.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-volt-500" />
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
