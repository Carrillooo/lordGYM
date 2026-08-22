'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';
import type { MessageRow } from '@/types/db';
import { sendMessageAction } from '@/lib/actions/messages';
import { idleState } from '@/lib/actions/state';
import { formatTime } from '@/lib/domain/datetime';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/** Conversación entrenador ↔ jugador (§43), con adjuntos por URL. */
export function ChatThread({
  messages,
  currentUserId,
  recipientId,
  recipientName,
}: {
  messages: MessageRow[];
  currentUserId: string;
  recipientId: string;
  recipientName: string;
}) {
  const [state, formAction] = useActionState(sendMessageAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-500">
            Todavía no hay mensajes con {recipientName}. Escribe el primero.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            return (
              <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                    mine
                      ? 'rounded-br-md bg-volt-500 text-ink-950'
                      : 'rounded-bl-md border border-ink-800 bg-ink-850 text-ink-100',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  {message.attachment_url ? (
                    <a
                      href={message.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'mt-2 inline-flex items-center gap-1.5 text-xs underline',
                        mine ? 'text-ink-950/80' : 'text-data-500',
                      )}
                    >
                      <Paperclip className="h-3 w-3" />
                      {message.attachment_type === 'video' ? 'Ver vídeo' : 'Ver imagen'}
                    </a>
                  ) : null}
                  <p className={cn('mt-1 text-[10px]', mine ? 'text-ink-950/60' : 'text-ink-500')}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={formAction} className="mt-3 space-y-2 border-t border-ink-800 pt-3">
        <input type="hidden" name="recipientId" value={recipientId} />
        <div className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Mensaje</span>
            <input
              name="body"
              required
              maxLength={2000}
              autoComplete="off"
              placeholder={`Mensaje para ${recipientName.split(' ')[0]}…`}
              className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-sm text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            aria-label="Enviar mensaje"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-volt-500 text-ink-950 transition-transform active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer select-none">Adjuntar imagen o vídeo (URL)</summary>
          <div className="mt-2 flex gap-2">
            <input
              name="attachmentUrl"
              type="url"
              placeholder="https://…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
            />
            <select
              name="attachmentType"
              aria-label="Tipo de adjunto"
              className="h-9 rounded-lg border border-ink-700 bg-ink-900 px-2 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
            >
              <option value="">Tipo</option>
              <option value="image">Imagen</option>
              <option value="video">Vídeo</option>
            </select>
          </div>
        </details>

        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
      </form>
    </div>
  );
}
