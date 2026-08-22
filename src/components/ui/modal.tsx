'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Modal accesible sobre `<dialog>`: bloqueo de foco, cierre con Esc y con
 * clic en el fondo. En móvil se ancla abajo, como una hoja.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'w-full max-w-none bg-transparent p-0 text-ink-100 backdrop:bg-ink-950/80 backdrop:backdrop-blur-sm',
        'm-0 mt-auto sm:m-auto',
        width,
      )}
    >
      {open ? (
        <div className="card animate-rise mx-auto max-h-[88dvh] overflow-y-auto rounded-b-none p-0 sm:rounded-b-[var(--radius-card)]">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-800 bg-ink-850/95 px-5 py-4 backdrop-blur">
            <div>
              <h2 id="modal-title" className="text-lg font-semibold tracking-tight text-ink-50">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-ink-400">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-5">{children}</div>
          {footer ? (
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-800 bg-ink-850/95 px-5 py-4 backdrop-blur">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
