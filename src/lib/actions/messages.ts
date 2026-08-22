'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/session';
import { sendMessage } from '@/lib/services/messages';
import { markAllRead } from '@/lib/services/notifications';
import { messageSchema } from '@/lib/validation/schemas';
import { errorState, fromException, successState, zodFieldErrors, type ActionState } from './state';

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const current = await getCurrentUser();
    if (!current) return errorState('Sesión no válida.');

    const parsed = messageSchema.safeParse({
      recipientId: formData.get('recipientId'),
      body: formData.get('body'),
      attachmentUrl: formData.get('attachmentUrl'),
      attachmentType: formData.get('attachmentType'),
    });
    if (!parsed.success) return errorState('Revisa el mensaje.', zodFieldErrors(parsed.error));

    await sendMessage(current.user.id, {
      recipientId: parsed.data.recipientId,
      body: parsed.data.body,
      attachmentUrl: parsed.data.attachmentUrl,
      attachmentType: parsed.data.attachmentType,
    });

    revalidatePath('/coach/messages');
    revalidatePath('/player/messages');
    return successState();
  } catch (error) {
    return fromException(error);
  }
}

export async function markNotificationsReadAction(): Promise<void> {
  const current = await getCurrentUser();
  if (!current) return;
  await markAllRead(current.user.id);
  revalidatePath('/player');
  revalidatePath('/coach');
}
