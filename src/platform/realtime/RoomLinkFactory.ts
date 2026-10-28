/** Production composition of RoomLink: one lease and one outbox store shared by every game. */
import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import * as Sentry from '@sentry/react-native';

import { API_BASE_URL } from '@/config/api';
import { platformEnvironment } from '@/platform/env/PlatformEnvironment';
import { apiClient } from '@/platform/http/client';
import { storage } from '@/services/infra/localStorage';
import { realtimeLog } from '@/utils/logger';

import { createOutboxStorage } from './outboxStorage';
import { createRoomLease, type RoomLease, RoomLinkImpl } from './RoomLink';
import type { RoomLink } from './types';

export interface RoomLinkFactory {
  create<TState extends BaseGameState<string>, TCommand extends object>(
    codec: GameStateCodec<TState>,
  ): RoomLink<TState, TCommand>;
}

export interface RoomLinkFactoryOptions {
  /** Called on every INBOX_HINT frame; wired to the account inbox consumer. */
  readonly onInboxHint: () => void;
}

export function createRoomLinkFactory(options: RoomLinkFactoryOptions): RoomLinkFactory {
  const lease: RoomLease = createRoomLease();
  const outboxStorage = createOutboxStorage(storage, Date.now);
  const socketBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
  return {
    create: (codec) =>
      new RoomLinkImpl({
        codec,
        api: apiClient,
        lease,
        socketBaseUrl,
        environment: platformEnvironment,
        outboxStorage,
        newCommandId: newRequestId,
        createSocket: (url) => new WebSocket(url),
        now: Date.now,
        random: Math.random,
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
        onProtocolError: (error) => {
          realtimeLog.error('realtime protocol error', { error: error.message });
          Sentry.captureException(error);
        },
        onInboxHint: options.onInboxHint,
      }),
  };
}
