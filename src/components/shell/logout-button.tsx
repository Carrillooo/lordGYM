'use client';

import type { ReactNode } from 'react';
import { logoutAction } from '@/lib/actions/auth';

export function LogoutButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form action={logoutAction} className="contents">
      <button type="submit" className={className} aria-label="Cerrar sesión">
        {children}
      </button>
    </form>
  );
}
