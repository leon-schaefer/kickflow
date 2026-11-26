import '@/app/zodConfig';
import { z } from 'zod';
import localStore from '@/storage/local';

const chatSchema = z.object({
  draft: z.string().max(1200),
  history: z.array(z.object({ question: z.string(), answer: z.string() })).max(8),
});

export function readChat(key: string | null): z.infer<typeof chatSchema> {
  const raw = key && localStore.getItemSync(key);
  if (raw) {
    try {
      const parsed = chatSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Ein unlesbarer Verlauf startet leer.
    }
  }
  return { draft: '', history: [] };
}

export function saveChat(key: string | null, chat: z.infer<typeof chatSchema>) {
  if (!key) return;
  if (chat.draft || chat.history.length) void localStore.setItem(key, JSON.stringify(chat));
  else void localStore.removeItem(key);
}
