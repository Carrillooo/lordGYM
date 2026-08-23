'use client';

import type { ReactNode } from 'react';
import { logoutAction } from '@/lib/actions/auth';
import { clearPrivateCache } from '@/lib/offline/private-cache';

export function LogoutButton({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form
      action={logoutAction}
      className="contents"
      // Al salir se borra del móvil la copia del modo entrenamiento que guarda
      // el service worker. En un móvil compartido, el siguiente en entrar no
      // puede encontrarse el entreno del anterior.
      onSubmit={() => clearPrivateCache()}
    >
      <button type="submit" className={className} aria-label="Cerrar sesión">
        {children}
      </button>
    </form>
  );
}
