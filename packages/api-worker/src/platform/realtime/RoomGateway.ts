/**
 * Durable Object WebSocket gateway for one room: admission, correlated sync, broadcast,
 * presence and inbox hints. Owns every socket side effect so the room authority never touches
 * `ctx.getWebSockets()` directly.
 *
 * Uses the Hibernation API: sockets carry a `user:<id>` tag plus a serialized attachment so the
 * gateway can rebuild presence after the object is evicted and woken.
 *
 * Presence is recomputed on accept / close and by a periodic sweep driven from the DO alarm:
 * keepalive pings are answered by the runtime without waking the object, so only the sweep can
 * notice a peer that vanished without a Close frame (airplane mode, killed process).
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
import { requestWakeNoLaterThan } from '../commands/roomAlarm';
import { createLogger } from '../observability/logger';
import {
  getWebSocketMessageByteLength,
  type RealtimeTrafficMessageType,
  recordRealtimeTraffic,
} from '../telemetry/realtimeTraffic';

const USER_SOCKET_TAG_PREFIX = 'user:';
/** A socket with no keepalive for this long is treated as half-open and closed. */
const STALE_SOCKET_MS = 60_000;
/** Alarm cadence for the half-open sweep while at least one socket is attached. */
export const PRESENCE_SWEEP_INTERVAL_MS = 30_000;
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

function isSameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

export class RoomGateway {
  readonly #ctx: DurableObjectState;
  readonly #env: Env;
  readonly #deps: RoomGatewayDeps;
  /** Last published online set; null after a cold start so the first sweep republishes. */
  #lastPresence: ReadonlySet<string> | null = null;

  constructor(ctx: DurableObjectState, env: Env, deps: RoomGatewayDeps) {
    this.#ctx = ctx;
    this.#env = env;
    this.#deps = deps;
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(KEEPALIVE_REQUEST, KEEPALIVE_RESPONSE),
    );
  }

  /** Accept an authenticated socket, publish the new presence set and arm the sweep alarm. */
  async accept(socket: WebSocket, userId: string, nowMs: number): Promise<void> {
    if (userId.length === 0) throw new Error('Room socket requires a non-empty userId');
    this.#ctx.acceptWebSocket(socket, [userSocketTag(userId)]);
    const attachment: SocketAttachment = { userId, connectedAtMs: nowMs };
    socket.serializeAttachment(attachment);
    this.#publishPresence(this.#collectPresence(nowMs));
    await requestWakeNoLaterThan(this.#ctx.storage, nowMs + PRESENCE_SWEEP_INTERVAL_MS);
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
    this.#publishPresence(this.#collectPresence(nowMs));
  }

  /** Alarm entry: close half-open sockets and publish presence only when the online set changed. */
  sweep(nowMs: number): void {
    const online = this.#collectPresence(nowMs);
    if (this.#lastPresence !== null && isSameSet(online, this.#lastPresence)) return;
    this.#publishPresence(online);
  }

  /** When the next sweep should run, or null once no open socket is attached. */
  nextSweepAt(nowMs: number): number | null {
    return this.#openSockets().length === 0 ? null : nowMs + PRESENCE_SWEEP_INTERVAL_MS;
  }

  broadcastState(
    snapshot: RoomSnapshot<BaseGameState<GameType>>,
    commandType: string | null,
  ): void {
    this.#broadcast('STATE_UPDATE', JSON.stringify(createStateUpdateFrame(snapshot, commandType)));
  }

  /** Recompute the online set from open sockets, closing half-open ones along the way. */
  #collectPresence(nowMs: number): ReadonlySet<string> {
    const onlineUserIds = new Set<string>();
    for (const socket of this.#openSockets()) {
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
    return onlineUserIds;
  }

  #publishPresence(onlineUserIds: ReadonlySet<string>): void {
    this.#lastPresence = onlineUserIds;
    this.#broadcast('PRESENCE', JSON.stringify(createPresenceFrame(onlineUserIds)));
  }

  /** A server-initiated close keeps the socket listed until the peer answers; skip those. */
  #openSockets(tag?: string): WebSocket[] {
    return this.#ctx.getWebSockets(tag).filter((socket) => socket.readyState === WebSocket.OPEN);
  }

  /** Tell one user's sockets that their account inbox has new rows. Silent when offline. */
  notifyInbox(userId: string): void {
    const message = JSON.stringify(INBOX_HINT_FRAME);
    let deliveryCount = 0;
    for (const socket of this.#openSockets(userSocketTag(userId))) {
      if (this.#trySend(socket, message)) deliveryCount += 1;
    }
    if (deliveryCount > 0) this.#record('INBOX_HINT', message, deliveryCount);
  }

  closeAll(code: number, reason: string): void {
    for (const socket of this.#openSockets()) socket.close(code, reason);
  }

  #broadcast(messageType: RealtimeTrafficMessageType, message: string): void {
    let deliveryCount = 0;
    for (const socket of this.#openSockets()) {
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
