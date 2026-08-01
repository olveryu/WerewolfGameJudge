/** Strict codec for game modules that do not define durable user events. */

import type { RealtimeUserEventCodec } from '@/services/types/IRealtimeTransport';

export const NO_ROOM_USER_EVENT_CODEC: RealtimeUserEventCodec<never> = {
  parse(): never {
    throw new Error('[FAIL-FAST] This game does not accept room user events');
  },
};
