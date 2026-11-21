/** Production composition of RoomLink: one lease and one outbox store shared by every game. */
import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import * as Sentry from '@sentry/react';

import { API_BASE_URL } from '@/config/api';
import { platformEnvironment } from '@/platform/env/PlatformEnvironment';
import { apiClient } from '@/platform/http/client';
import { storage } from '@/services/infra/localStorage';
import { realtimeLog } from '@/utils/logger';

import { createOutboxStorage } from './outboxStorage';
import { createRoomLease, type RoomLease, RoomLinkImpl } from './RoomLink';
import type { RealtimeSocket } from './SocketChannel';
import type { InboxWakeReason, RoomLink } from './types';

/** Project the browser WebSocket onto the channel port; handlers receive only what the port names. */
function openBrowserSocket(url: string): RealtimeSocket {
  const socket = new WebSocket(url);
  const port: RealtimeSocket = {
    get readyState() {
      return socket.readyState;
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
  };
  socket.onopen = () => port.onopen?.();
  socket.onmessage = (event) => port.onmessage?.({ data: event.data });
  socket.onclose = (event) => port.onclose?.({ code: event.code, reason: event.reason });
  socket.onerror = () => port.onerror?.();
  return port;
}

export interface RoomLinkFactory {
  create<TState extends BaseGameState<string>, TCommand extends object>(
    codec: GameStateCodec<TState>,
  ): RoomLink<TState, TCommand>;
  /**
   * Closes every link bound to another room or user than `scope`. A room's link outlives its room
   * page while the user is on that room's subpages (settings, config, guide), whose routes carry
   * the same room code; it is released once the route leaves the room or the user changes.
   */
  releaseOutside(scope: RoomFlowScope): void;
}

/** The room the current route belongs to and the signed-in user; null when there is none. */
export interface RoomFlowScope {
  readonly roomCode: string | null;
  readonly userId: string | null;
}

interface ReleasableLink {
  readonly isOutside: (scope: RoomFlowScope) => boolean;
  readonly close: () => void;
}

export interface RoomLinkFactoryOptions {
  /** Called on every INBOX_HINT frame and whenever a link becomes live. */
  readonly onInboxWake: (reason: InboxWakeReason) => void;
}

export function createRoomLinkFactory(options: RoomLinkFactoryOptions): RoomLinkFactory {
  const lease: RoomLease = createRoomLease();
  const outboxStorage = createOutboxStorage(storage, Date.now, (error) => {
    realtimeLog.error('dropped unreadable room command outbox', { error: error.message });
    Sentry.captureException(error);
  });
  const socketBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
  const links: ReleasableLink[] = [];
  return {
    create: (codec) => {
      const link = new RoomLinkImpl({
        codec,
        api: apiClient,
        lease,
        socketBaseUrl,
        environment: platformEnvironment,
        outboxStorage,
        newCommandId: newRequestId,
        createSocket: openBrowserSocket,
        now: Date.now,
        random: Math.random,
        setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeout: (handle) => clearTimeout(handle),
        onProtocolError: (error) => {
          realtimeLog.error('realtime protocol error', { error: error.message });
          Sentry.captureException(error);
        },
        onInboxWake: options.onInboxWake,
      });
      links.push({
        isOutside: ({ roomCode, userId }) => {
          const { identity } = link.getSnapshot();
          return (
            identity !== null && (identity.room.roomCode !== roomCode || identity.userId !== userId)
          );
        },
        close: () => link.close(),
      });
      return link;
    },
    releaseOutside: (scope) => {
      for (const link of links) {
        if (link.isOutside(scope)) link.close();
      }
    },
  };
}
