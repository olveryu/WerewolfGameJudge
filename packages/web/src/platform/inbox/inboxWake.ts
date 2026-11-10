/** Wake signal from room links to the account inbox consumer (`live` and INBOX_HINT). */

import type { InboxWakeReason } from '@/platform/realtime/types';

export interface InboxWakeSignal {
  subscribe(listener: (reason: InboxWakeReason) => void): () => void;
  emit(reason: InboxWakeReason): void;
}

export function createInboxWakeSignal(): InboxWakeSignal {
  const listeners = new Set<(reason: InboxWakeReason) => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (reason) => {
      for (const listener of listeners) listener(reason);
    },
  };
}
