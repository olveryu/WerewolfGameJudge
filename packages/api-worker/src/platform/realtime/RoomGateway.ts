/**
 * Durable Object WebSocket gateway for one room: admission, correlated sync, broadcast,
 * and inbox hints. Owns every socket side effect so the room authority never touches
 * `ctx.getWebSockets()` directly.
 *
 * Uses the Hibernation API: sockets carry a `user:<id>` tag plus a serialized attachment so the
 * gateway can identify each socket's owner after the object is evicted and woken.
 *
 * Stale sockets are closed by a periodic sweep driven from the DO alarm: keepalive pings are
 * answered by the runtime without waking the object, so only the sweep can notice a peer that
 * vanished without a Close frame (airplane mode, killed process).
 */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import {
  type CommandFrame,
  createCommandDecidedFrame,
  createCommandThrottledFrame,
  createCommandUnavailableFrame,
  createStateUpdateFrame,
  createSyncCurrentFrame,
  createSyncSnapshotFrame,
  INBOX_HINT_FRAME,
  parseClientFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import * as Sentry from '@sentry/cloudflare';

import type { Env } from '../../env';
import type { CommandDispatch } from '../commands/CommandPipeline';
import { requestWakeNoLaterThan } from '../commands/roomAlarm';
import { createLogger } from '../observability/logger';
import { wsRoomCommandSchema } from '../room/requestSchemas';
import type { DispatchRoomCommand, RoomInstanceIdentity } from '../room/types';
import {
  getWebSocketMessageByteLength,
  type RealtimeTrafficMessageType,
  recordRealtimeTraffic,
} from '../telemetry/realtimeTraffic';

const USER_SOCKET_TAG_PREFIX = 'user:';
/** A socket with no keepalive for this long is treated as half-open and closed. */
const STALE_SOCKET_MS = 60_000;
/** Alarm cadence for the half-open sweep while at least one socket is attached. */
export const STALE_SOCKET_SWEEP_INTERVAL_MS = 30_000;
/**
 * Per-socket cap on commands awaiting a result. Legitimate concurrency is ~3 (one stroke flush,
 * one single-flight user action, one auto-submission), so 16 leaves a wide margin and only trips
 * on a bug or a flooding client. Over the cap the gateway answers throttled instead of closing
 * the socket: closing would trigger a reconnect plus durable replay and amplify the flood.
 */
export const MAX_PENDING_COMMANDS_PER_SOCKET = 16;
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
  /** Immutable identity of the room this object serves, or null when no room is stored. */
  readRoomIdentity(): RoomInstanceIdentity | null;
  /** Run one user command through the pipeline (and broadcast when it commits). */
  dispatchCommand(request: DispatchRoomCommand): Promise<CommandDispatch>;
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
  /** Commands sent on a socket that have not received a COMMAND_RESULT yet. */
  readonly #pendingCommands = new WeakMap<WebSocket, number>();

  constructor(ctx: DurableObjectState, env: Env, deps: RoomGatewayDeps) {
    this.#ctx = ctx;
    this.#env = env;
    this.#deps = deps;
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(KEEPALIVE_REQUEST, KEEPALIVE_RESPONSE),
    );
  }

  /** Accept an authenticated socket and arm the sweep alarm. */
  async accept(socket: WebSocket, userId: string, nowMs: number): Promise<void> {
    if (userId.length === 0) throw new Error('Room socket requires a non-empty userId');
    this.#ctx.acceptWebSocket(socket, [userSocketTag(userId)]);
    const attachment: SocketAttachment = { userId, connectedAtMs: nowMs };
    socket.serializeAttachment(attachment);
    await requestWakeNoLaterThan(this.#ctx.storage, nowMs + STALE_SOCKET_SWEEP_INTERVAL_MS);
  }

  /** Handle one inbound frame. Any protocol violation closes the socket with 1002. */
  async handleMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
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
    if (frame.type === 'COMMAND') {
      await this.#handleCommand(socket, frame);
      return;
    }

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

  /** Run one COMMAND frame through the pipeline and answer only the sending socket. */
  async #handleCommand(socket: WebSocket, frame: CommandFrame): Promise<void> {
    let attachment: SocketAttachment;
    try {
      attachment = readAttachment(socket);
    } catch (error) {
      log.error('command without a socket attachment', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      socket.close(1011, 'command_failed');
      return;
    }
    const identity = this.#deps.readRoomIdentity();
    if (identity === null) {
      this.#send(
        socket,
        'COMMAND_RESULT',
        JSON.stringify(createCommandUnavailableFrame(frame.commandId)),
      );
      return;
    }
    if (frame.roomCode !== identity.roomCode) {
      log.error('command room code does not match this room', {
        commandRoomCode: frame.roomCode,
        roomCode: identity.roomCode,
      });
      Sentry.captureException(new Error('command room code does not match this room'));
      socket.close(REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol_error');
      return;
    }
    const pending = (this.#pendingCommands.get(socket) ?? 0) + 1;
    if (pending > MAX_PENDING_COMMANDS_PER_SOCKET) {
      log.warn('command throttled: too many pending commands', {
        userId: attachment.userId,
        roomCode: identity.roomCode,
        pending,
      });
      this.#send(
        socket,
        'COMMAND_RESULT',
        JSON.stringify(createCommandThrottledFrame(frame.commandId)),
      );
      return;
    }
    this.#pendingCommands.set(socket, pending);
    try {
      const parsed = wsRoomCommandSchema.safeParse({
        roomCode: frame.roomCode,
        commandId: frame.commandId,
        command: frame.command,
        controlledSeat: frame.controlledSeat,
      });
      if (!parsed.success) {
        log.error('invalid websocket command', {
          error: parsed.error.message,
          userId: attachment.userId,
        });
        Sentry.captureException(parsed.error);
        socket.close(REALTIME_CLOSE_CODE.PROTOCOL_ERROR, 'protocol_error');
        return;
      }
      let dispatch: CommandDispatch;
      try {
        dispatch = await this.#deps.dispatchCommand({
          roomCode: parsed.data.roomCode,
          commandId: parsed.data.commandId,
          actor: { kind: 'user', userId: attachment.userId },
          controlledSeat: parsed.data.controlledSeat,
          command: parsed.data.command,
        });
      } catch (error) {
        log.error('command dispatch failed', {
          error: error instanceof Error ? error.message : String(error),
          userId: attachment.userId,
        });
        Sentry.captureException(error);
        socket.close(1011, 'command_failed');
        return;
      }
      if (dispatch.kind === 'unavailable') {
        this.#send(
          socket,
          'COMMAND_RESULT',
          JSON.stringify(createCommandUnavailableFrame(frame.commandId)),
        );
        return;
      }
      this.#send(
        socket,
        'COMMAND_RESULT',
        JSON.stringify(createCommandDecidedFrame(frame.commandId, dispatch.result)),
      );
    } finally {
      const remaining = (this.#pendingCommands.get(socket) ?? 1) - 1;
      if (remaining <= 0) this.#pendingCommands.delete(socket);
      else this.#pendingCommands.set(socket, remaining);
    }
  }

  /** Alarm entry: close half-open sockets (peers that vanished without a Close frame). */
  sweep(nowMs: number): void {
    this.#closeStaleSockets(nowMs);
  }

  /** When the next sweep should run, or null once no open socket is attached. */
  nextSweepAt(nowMs: number): number | null {
    return this.#openSockets().length === 0 ? null : nowMs + STALE_SOCKET_SWEEP_INTERVAL_MS;
  }

  broadcastState(
    snapshot: RoomSnapshot<BaseGameState<GameType>>,
    commandType: string | null,
  ): void {
    this.#broadcast('STATE_UPDATE', JSON.stringify(createStateUpdateFrame(snapshot, commandType)));
  }

  /** Close sockets whose keepalive went stale; the rest stay open. */
  #closeStaleSockets(nowMs: number): void {
    for (const socket of this.#openSockets()) {
      const attachment = readAttachment(socket);
      const lastKeepaliveAt = this.#ctx.getWebSocketAutoResponseTimestamp(socket);
      const lastSeenMs =
        lastKeepaliveAt === null ? attachment.connectedAtMs : lastKeepaliveAt.getTime();
      if (nowMs - lastSeenMs > STALE_SOCKET_MS) {
        socket.close(1001, 'keepalive_timeout');
      }
    }
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
