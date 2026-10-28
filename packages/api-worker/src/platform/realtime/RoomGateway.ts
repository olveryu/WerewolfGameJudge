/**
 * Durable Object WebSocket gateway for one room: admission, correlated sync, broadcast,
 * presence and inbox hints. Owns every socket side effect so the room authority never touches
 * `ctx.getWebSockets()` directly.
 *
 * Uses the Hibernation API: sockets carry a `user:<id>` tag plus a serialized attachment so the
 * gateway can rebuild presence after the object is evicted and woken.
 */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import {
  createPresenceFrame,
  createStateUpdateFrame,
  createSyncCurrentFrame,
  createSyncSnapshotFrame,
  INBOX_HINT_FRAME,
  parseClientFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import * as Sentry from '@sentry/cloudflare';

import type { Env } from '../../env';
import { createLogger } from '../observability/logger';
import {
  getWebSocketMessageByteLength,
  type RealtimeTrafficMessageType,
  recordRealtimeTraffic,
} from '../telemetry/realtimeTraffic';

const USER_SOCKET_TAG_PREFIX = 'user:';
/** A socket with no keepalive for this long is treated as half-open and closed. */
const STALE_SOCKET_MS = 60_000;
const KEEPALIVE_REQUEST = 'ping';
const KEEPALIVE_RESPONSE = 'pong';

const log = createLogger('RoomGateway');

interface SocketAttachment {
  readonly userId: string;
  readonly connectedAtMs: number;
}

export interface RoomGatewayDeps {
  /** Current authoritative snapshot, or null when the room has no state. */
  readSnapshot(): RoomSnapshot<BaseGameState<GameType>> | null;
}

function userSocketTag(userId: string): string {
  return `${USER_SOCKET_TAG_PREFIX}${userId}`;
}

function readAttachment(socket: WebSocket): SocketAttachment {
  const attachment: unknown = socket.deserializeAttachment();
  if (
    typeof attachment !== 'object' ||
    attachment === null ||
    !('userId' in attachment) ||
    typeof attachment.userId !== 'string' ||
    attachment.userId.length === 0 ||
    !('connectedAtMs' in attachment) ||
    typeof attachment.connectedAtMs !== 'number' ||
    !Number.isSafeInteger(attachment.connectedAtMs)
  ) {
    throw new Error('Room socket attachment is missing or malformed');
  }
  return { userId: attachment.userId, connectedAtMs: attachment.connectedAtMs };
}

export class RoomGateway {
  readonly #ctx: DurableObjectState;
  readonly #env: Env;
  readonly #deps: RoomGatewayDeps;

  constructor(ctx: DurableObjectState, env: Env, deps: RoomGatewayDeps) {
    this.#ctx = ctx;
    this.#env = env;
    this.#deps = deps;
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(KEEPALIVE_REQUEST, KEEPALIVE_RESPONSE),
    );
  }

  /** Accept an authenticated socket and publish the new presence set. */
  accept(socket: WebSocket, userId: string, nowMs: number): void {
    if (userId.length === 0) throw new Error('Room socket requires a non-empty userId');
    this.#ctx.acceptWebSocket(socket, [userSocketTag(userId)]);
    const attachment: SocketAttachment = { userId, connectedAtMs: nowMs };
    socket.serializeAttachment(attachment);
    this.broadcastPresence(nowMs);
  }

  /** Handle one inbound frame. Any protocol violation closes the socket with 1002. */
  handleMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    let frame: ReturnType<typeof parseClientFrame>;
    try {
      if (typeof message !== 'string') throw new Error('WebSocket client message must be text');
      frame = parseClientFrame(JSON.parse(message));
    } catch (error) {
      this.#record('INVALID_CLIENT_MESSAGE', message, 1);
      log.error('invalid websocket client message', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      socket.close(REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol_error');
      return;
    }
    this.#record(frame.type, message, 1);

    const snapshot = this.#deps.readSnapshot();
    if (snapshot === null) {
      const error = new Error('Initialized room has no authoritative snapshot');
      log.error('state sync failed', { error: error.message });
      Sentry.captureException(error);
      socket.close(REALTIME_CLOSE_CODE.STATE_UNAVAILABLE, 'state_unavailable');
      return;
    }
    const response =
      frame.knownRevision === snapshot.revision
        ? createSyncCurrentFrame(frame.requestId, snapshot.revision)
        : createSyncSnapshotFrame(frame.requestId, snapshot);
    this.#send(socket, 'SYNC_RESULT', JSON.stringify(response));
  }

  /** Called from the hibernation close handler; republishes presence without the closed socket. */
  handleClose(nowMs: number): void {
    this.broadcastPresence(nowMs);
  }

  broadcastState(
    snapshot: RoomSnapshot<BaseGameState<GameType>>,
    commandType: string | null,
  ): void {
    this.#broadcast('STATE_UPDATE', JSON.stringify(createStateUpdateFrame(snapshot, commandType)));
  }

  /** Recompute the online set from live sockets, closing half-open ones along the way. */
  broadcastPresence(nowMs: number): void {
    const onlineUserIds = new Set<string>();
    for (const socket of this.#ctx.getWebSockets()) {
      const attachment = readAttachment(socket);
      const lastKeepaliveAt = this.#ctx.getWebSocketAutoResponseTimestamp(socket);
      const lastSeenMs =
        lastKeepaliveAt === null ? attachment.connectedAtMs : lastKeepaliveAt.getTime();
      if (nowMs - lastSeenMs > STALE_SOCKET_MS) {
        socket.close(1001, 'keepalive_timeout');
        continue;
      }
      onlineUserIds.add(attachment.userId);
    }
    this.#broadcast('PRESENCE', JSON.stringify(createPresenceFrame(onlineUserIds)));
  }

  /** Tell one user's sockets that their account inbox has new rows. Silent when offline. */
  notifyInbox(userId: string): void {
    const message = JSON.stringify(INBOX_HINT_FRAME);
    let deliveryCount = 0;
    for (const socket of this.#ctx.getWebSockets(userSocketTag(userId))) {
      if (this.#trySend(socket, message)) deliveryCount += 1;
    }
    if (deliveryCount > 0) this.#record('INBOX_HINT', message, deliveryCount);
  }

  closeAll(code: number, reason: string): void {
    for (const socket of this.#ctx.getWebSockets()) socket.close(code, reason);
  }

  #broadcast(messageType: RealtimeTrafficMessageType, message: string): void {
    let deliveryCount = 0;
    for (const socket of this.#ctx.getWebSockets()) {
      if (this.#trySend(socket, message)) deliveryCount += 1;
    }
    this.#record(messageType, message, deliveryCount);
  }

  #send(socket: WebSocket, messageType: RealtimeTrafficMessageType, message: string): void {
    socket.send(message);
    this.#record(messageType, message, 1);
  }

  #trySend(socket: WebSocket, message: string): boolean {
    try {
      socket.send(message);
      return true;
    } catch (error) {
      log.warn('send skipped closed socket', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  #record(
    messageType: RealtimeTrafficMessageType,
    message: string | ArrayBuffer,
    deliveryCount: number,
  ): void {
    recordRealtimeTraffic(this.#env.REQUEST_TRAFFIC, {
      messageType,
      payloadBytes: getWebSocketMessageByteLength(message),
      deliveryCount,
      deploymentId: this.#env.CF_VERSION_METADATA.id,
    });
  }
}
