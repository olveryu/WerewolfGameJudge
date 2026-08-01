/** Single owner for room identity, snapshot, connection, commands, and durable user events. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type {
  BaseGameState,
  GameStateCodec,
  RoomSnapshot,
  StateUpdateMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import {
  prepareRoomCommand,
  sendPreparedRoomCommand,
} from '@/features/room/session/roomCommandClient';
import type {
  ActiveRoomIdentity,
  PreparedRoomCommand,
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
  RoomConnectOutcome,
  RoomSessionClient,
  RoomSessionSnapshot,
  RoomUserEvent,
} from '@/features/room/session/types';
import { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import type { IRealtimeTransport, RealtimeUserEvent } from '@/services/types/IRealtimeTransport';
import type { IRoomStateService } from '@/services/types/IRoomStateService';
import { handleError } from '@/utils/errorPipeline';
import { roomSessionLog } from '@/utils/logger';

interface RoomSessionDeps<
  TState extends BaseGameState<string>,
  TEvent extends RoomUserEvent & RealtimeUserEvent,
> {
  readonly codec: GameStateCodec<TState>;
  readonly stateService: IRoomStateService<TState>;
  readonly transport: IRealtimeTransport<TState, TEvent>;
  readonly createCommandId: () => string;
}

interface PendingRoomCommand<TState extends BaseGameState<string>, TCommand extends object> {
  readonly prepared: PreparedRoomCommand<TCommand>;
  inFlight: Promise<RoomCommandDispatchOutcome<TState>> | null;
}

interface UserEventDelivery<TEvent> {
  readonly event: TEvent;
  readonly fingerprint: string;
  isDelivered: boolean;
  isDelivering: boolean;
}

function createIdleSnapshot<TState extends BaseGameState<string>>(
  epoch: number,
): RoomSessionSnapshot<TState> {
  return Object.freeze({
    phase: 'idle',
    epoch,
    identity: null,
    connection: 'disconnected',
    snapshot: null,
    lastCommand: null,
    error: null,
  });
}

function mapConnectionStatus(state: ConnectionState): RoomConnectionStatus {
  switch (state) {
    case ConnectionState.Connecting:
    case ConnectionState.Reconnecting:
      return 'connecting';
    case ConnectionState.Syncing:
      return 'syncing';
    case ConnectionState.Connected:
      return 'live';
    case ConnectionState.Idle:
    case ConnectionState.Disconnected:
    case ConnectionState.Disposed:
      return 'disconnected';
    case ConnectionState.Failed:
      return 'failed';
  }
}

function createIntentKey<TCommand extends object>(
  epoch: number,
  command: TCommand,
  controlledSeat: number | null,
): string {
  return canonicalJson({ epoch, controlledSeat, command });
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}

/** Owns exactly one room identity from connect() until disconnect(). */
export class RoomSession<
  TState extends BaseGameState<string>,
  TCommand extends object,
  TEvent extends RoomUserEvent & RealtimeUserEvent,
> implements RoomSessionClient<TState, TCommand, TEvent> {
  readonly #codec: GameStateCodec<TState>;
  readonly #connection: ConnectionManager<TState, TEvent>;
  readonly #createCommandId: () => string;
  readonly #listeners = new Set<() => void>();
  readonly #pendingCommands = new Map<string, PendingRoomCommand<TState, TCommand>>();
  readonly #userEventDeliveries = new Map<string, UserEventDelivery<TEvent>>();
  #snapshot: RoomSessionSnapshot<TState> = createIdleSnapshot(0);
  #snapshotFingerprint: string | null = null;
  #runtimeResetExpected = false;
  #userEventHandler: ((event: TEvent) => void | Promise<void>) | null = null;
  #userEventDeliveryChain: Promise<void> = Promise.resolve();

  constructor(deps: RoomSessionDeps<TState, TEvent>) {
    this.#codec = deps.codec;
    this.#createCommandId = deps.createCommandId;
    this.#connection = new ConnectionManager<TState, TEvent>({
      transport: deps.transport,
      fetchStateFromDB: (room) => deps.stateService.getGameState(room),
      getStateRevision: (room) => deps.stateService.getStateRevision(room),
      onStateUpdate: (message) => this.#applyStateUpdate(message),
      onFetchedState: (snapshot) => this.#applySnapshot(snapshot, null),
      onUserEvent: (event) => this.#receiveUserEvent(event),
    });
    this.#connection.addStateListener((state) => this.#handleConnectionState(state));
  }

  getSnapshot(): RoomSessionSnapshot<TState> {
    return this.#snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async connect(
    identity: ActiveRoomIdentity<TState['gameType']>,
    signal?: AbortSignal,
  ): Promise<RoomConnectOutcome> {
    if (this.#snapshot.phase !== 'idle') {
      throw new Error('[FAIL-FAST] Disconnect the active room session before connect');
    }
    if (identity.room.gameType !== this.#codec.gameType) {
      throw new Error(
        `RoomSession<${this.#codec.gameType}> cannot enter ${identity.room.gameType}`,
      );
    }
    if (identity.userId.length === 0) {
      throw new Error('Room session userId must be non-empty');
    }
    if (isSignalAborted(signal)) return { kind: 'cancelled' };

    const epoch = this.#snapshot.epoch + 1;
    this.#snapshotFingerprint = null;
    this.#pendingCommands.clear();
    this.#userEventDeliveries.clear();
    this.#setSnapshot(
      Object.freeze({
        phase: 'entering',
        epoch,
        identity,
        connection: 'connecting',
        snapshot: null,
        lastCommand: null,
        error: null,
      }),
    );

    try {
      const waitResult = await this.#waitForConnection(
        this.#connection.connectAndWait(identity.room),
        epoch,
        signal,
      );
      if (waitResult === 'cancelled') return { kind: 'cancelled' };
    } catch (error) {
      if (isSignalAborted(signal)) {
        if (this.#snapshot.epoch === epoch) this.disconnect();
        return { kind: 'cancelled' };
      }
      if (this.#snapshot.epoch !== epoch) return { kind: 'superseded' };

      this.#resetConnectionRuntime();
      const failure = error instanceof Error ? error : new Error(String(error));
      this.#setSnapshot(
        Object.freeze({
          phase: 'failed',
          epoch,
          identity,
          connection: 'failed',
          snapshot: null,
          lastCommand: null,
          error: failure,
        }),
      );
      throw failure;
    }

    const completed = this.getSnapshot();
    if (isSignalAborted(signal)) {
      if (completed.epoch === epoch) this.disconnect();
      return { kind: 'cancelled' };
    }
    if (completed.epoch !== epoch) return { kind: 'superseded' };
    if (completed.phase !== 'ready' || completed.connection !== 'live') {
      throw new Error('[FAIL-FAST] Connection completed without a live room snapshot');
    }
    return { kind: 'connected' };
  }

  async reconnect(signal?: AbortSignal): Promise<RoomConnectOutcome> {
    const current = this.#snapshot;
    if (current.phase !== 'ready' || current.connection !== 'failed') {
      throw new Error('[FAIL-FAST] Reconnect requires a ready session with failed transport');
    }
    if (isSignalAborted(signal)) return { kind: 'cancelled' };

    const epoch = current.epoch;
    try {
      const waitResult = await this.#waitForConnection(
        this.#connection.reconnectAndWait(),
        epoch,
        signal,
      );
      if (waitResult === 'cancelled') return { kind: 'cancelled' };
    } catch (error) {
      if (isSignalAborted(signal)) return { kind: 'cancelled' };
      if (this.#snapshot.epoch !== epoch) return { kind: 'superseded' };
      throw error;
    }

    const completed = this.getSnapshot();
    if (isSignalAborted(signal)) return { kind: 'cancelled' };
    if (completed.epoch !== epoch) return { kind: 'superseded' };
    if (completed.phase !== 'ready' || completed.connection !== 'live') {
      throw new Error('[FAIL-FAST] Reconnect completed without a fresh live snapshot');
    }
    return { kind: 'connected' };
  }

  disconnect(): void {
    const nextEpoch = this.#snapshot.epoch + 1;
    this.#pendingCommands.clear();
    this.#userEventDeliveries.clear();
    this.#snapshotFingerprint = null;
    this.#setSnapshot(createIdleSnapshot(nextEpoch));
    this.#resetConnectionRuntime();
  }

  prepare<TPreparedCommand extends TCommand>(
    command: TPreparedCommand,
    controlledSeat: number | null,
  ): PreparedRoomCommand<TPreparedCommand> {
    const current = this.#requireReadySnapshot();
    return prepareRoomCommand({
      sessionEpoch: current.epoch,
      roomCode: current.identity.room.roomCode,
      roomId: current.identity.room.roomId,
      command,
      controlledSeat,
      commandId: this.#createCommandId(),
    });
  }

  async dispatch(
    command: TCommand,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    const current = this.#requireReadySnapshot();
    const intentKey = createIntentKey(current.epoch, command, options.controlledSeat);
    let pending = this.#pendingCommands.get(intentKey);
    if (pending === undefined) {
      pending = {
        prepared: this.prepare(command, options.controlledSeat),
        inFlight: null,
      };
      this.#pendingCommands.set(intentKey, pending);
    }
    if (pending.inFlight !== null) {
      return pending.inFlight;
    }

    const entry = pending;
    const inFlight = this.dispatchPrepared(entry.prepared, options.label)
      .then((outcome) => {
        if (outcome.kind === 'decided' && this.#pendingCommands.get(intentKey) === entry) {
          this.#pendingCommands.delete(intentKey);
        }
        return outcome;
      })
      .finally(() => {
        if (this.#pendingCommands.get(intentKey) === entry) entry.inFlight = null;
      });
    entry.inFlight = inFlight;
    return inFlight;
  }

  async dispatchPrepared<TPreparedCommand extends TCommand>(
    prepared: PreparedRoomCommand<TPreparedCommand>,
    label: string,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    const current = this.#requirePreparedCommand(prepared);
    const attempt = await sendPreparedRoomCommand({
      prepared,
      codec: this.#codec,
      label,
    });
    if (this.#snapshot.epoch !== current.epoch) {
      throw new Error(
        `[FAIL-FAST] Room command ${prepared.commandId} completed for a stale session`,
      );
    }
    if (attempt.kind !== 'decided') return attempt;

    if (attempt.decision.kind === 'committed') {
      this.#applySnapshot(attempt.decision.snapshot, null);
    }
    return attempt;
  }

  setUserEventHandler(handler: (event: TEvent) => void | Promise<void>): () => void {
    if (this.#userEventHandler !== null) {
      throw new Error('[FAIL-FAST] Room session already has a user-event handler');
    }
    this.#userEventHandler = handler;
    this.#scheduleUserEventDelivery();
    return () => {
      if (this.#userEventHandler !== handler) {
        throw new Error('[FAIL-FAST] Room session user-event handler changed before cleanup');
      }
      this.#userEventHandler = null;
    };
  }

  #applyStateUpdate(message: StateUpdateMessage<TState>): void {
    this.#applySnapshot(
      {
        gameType: message.gameType,
        stateVersion: message.stateVersion,
        revision: message.revision,
        state: message.state,
      },
      message.lastCommandType,
    );
  }

  #applySnapshot(snapshot: RoomSnapshot<TState>, lastCommandType: string | null): void {
    const current = this.#snapshot;
    if (current.phase === 'idle') {
      throw new Error('[FAIL-FAST] Room snapshot arrived without an active session');
    }
    if (
      snapshot.gameType !== current.identity.room.gameType ||
      snapshot.state.roomCode !== current.identity.room.roomCode ||
      snapshot.state.hostUserId !== current.identity.room.hostUserId
    ) {
      throw new Error('[FAIL-FAST] Room directory metadata does not match its snapshot');
    }

    const fingerprint = canonicalJson(snapshot);
    if (current.phase === 'ready') {
      if (snapshot.revision < current.snapshot.revision) return;
      if (snapshot.revision === current.snapshot.revision) {
        if (fingerprint !== this.#snapshotFingerprint) {
          throw new Error(
            `[FAIL-FAST] Room revision ${snapshot.revision} changed its snapshot payload`,
          );
        }
        if (lastCommandType === null || current.lastCommand?.type === lastCommandType) return;
        this.#setSnapshot(
          Object.freeze({
            ...current,
            lastCommand: { revision: snapshot.revision, type: lastCommandType },
          }),
        );
        return;
      }
    }

    this.#snapshotFingerprint = fingerprint;
    this.#connection.updateRevision(snapshot.revision);
    this.#setSnapshot(
      Object.freeze({
        phase: 'ready',
        epoch: current.epoch,
        identity: current.identity,
        connection: mapConnectionStatus(this.#connection.getState()),
        snapshot,
        lastCommand:
          lastCommandType === null ? null : { revision: snapshot.revision, type: lastCommandType },
        error: null,
      }),
    );
  }

  #handleConnectionState(state: ConnectionState): void {
    const current = this.#snapshot;
    if (state === ConnectionState.Idle) {
      if (current.phase === 'idle' || this.#runtimeResetExpected) return;
      throw new Error(
        '[FAIL-FAST] Connection runtime became idle while the session remained active',
      );
    }
    if (current.phase === 'idle') {
      if (state === ConnectionState.Disposed) return;
      throw new Error('[FAIL-FAST] Connection runtime became active without a room session');
    }

    const connection = mapConnectionStatus(state);
    if (state === ConnectionState.Connected && current.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Connection became live without a room snapshot');
    }
    if (state === ConnectionState.Failed && current.phase !== 'ready') {
      const error = new Error('Room connection failed before receiving a snapshot');
      this.#setSnapshot(
        Object.freeze({
          phase: 'failed',
          epoch: current.epoch,
          identity: current.identity,
          connection: 'failed',
          snapshot: null,
          lastCommand: null,
          error,
        }),
      );
      return;
    }
    if (current.connection === connection) return;

    this.#setSnapshot(Object.freeze({ ...current, connection }));
    if (state === ConnectionState.Connected) {
      this.#acknowledgeDeliveredUserEvents();
    }
  }

  #receiveUserEvent(event: TEvent): void {
    if (this.#snapshot.phase === 'idle') {
      throw new Error('[FAIL-FAST] User event arrived without an active room session');
    }
    if (event.eventId.length === 0) {
      throw new Error('Room user event ID must be non-empty');
    }

    const fingerprint = canonicalJson(event);
    const existing = this.#userEventDeliveries.get(event.eventId);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error(`Room user event ${event.eventId} changed across deliveries`);
      }
      if (existing.isDelivered) {
        this.#sendUserEventAcknowledgement(event.eventId);
        return;
      }
    } else {
      this.#userEventDeliveries.set(event.eventId, {
        event,
        fingerprint,
        isDelivered: false,
        isDelivering: false,
      });
    }
    this.#scheduleUserEventDelivery();
  }

  #scheduleUserEventDelivery(): void {
    this.#userEventDeliveryChain = this.#userEventDeliveryChain
      .then(() => this.#deliverPendingUserEvents())
      .catch((error: unknown) => {
        handleError(error, {
          label: '房间事件',
          logger: roomSessionLog,
          feedback: false,
        });
      });
  }

  async #deliverPendingUserEvents(): Promise<void> {
    const handler = this.#userEventHandler;
    if (handler === null) return;

    for (const [eventId, delivery] of this.#userEventDeliveries) {
      if (delivery.isDelivered || delivery.isDelivering) continue;
      delivery.isDelivering = true;
      try {
        await handler(delivery.event);
        delivery.isDelivered = true;
        this.#sendUserEventAcknowledgement(eventId);
      } finally {
        delivery.isDelivering = false;
      }
    }
  }

  #acknowledgeDeliveredUserEvents(): void {
    for (const [eventId, delivery] of this.#userEventDeliveries) {
      if (delivery.isDelivered) this.#sendUserEventAcknowledgement(eventId);
    }
  }

  #sendUserEventAcknowledgement(eventId: string): void {
    if (!this.#connection.sendUserEventAcknowledgement(eventId)) {
      throw new Error(`Failed to send acknowledgement for room user event ${eventId}`);
    }
  }

  #requireReadySnapshot(): Extract<RoomSessionSnapshot<TState>, { readonly phase: 'ready' }> {
    if (this.#snapshot.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Room command requires a ready room session');
    }
    return this.#snapshot;
  }

  #requirePreparedCommand<TPreparedCommand extends TCommand>(
    prepared: PreparedRoomCommand<TPreparedCommand>,
  ): Extract<RoomSessionSnapshot<TState>, { readonly phase: 'ready' }> {
    const current = this.#requireReadySnapshot();
    if (prepared.sessionEpoch !== current.epoch) {
      throw new Error('[FAIL-FAST] Prepared room command belongs to a stale session epoch');
    }
    if (
      prepared.roomCode !== current.identity.room.roomCode ||
      prepared.roomId !== current.identity.room.roomId
    ) {
      throw new Error('[FAIL-FAST] Prepared room command belongs to another room instance');
    }
    return current;
  }

  #resetConnectionRuntime(): void {
    this.#runtimeResetExpected = true;
    try {
      this.#connection.disconnect();
    } finally {
      this.#runtimeResetExpected = false;
    }
  }

  async #waitForConnection(
    operation: Promise<void>,
    epoch: number,
    signal: AbortSignal | undefined,
  ): Promise<'completed' | 'cancelled'> {
    if (signal === undefined) {
      await operation;
      return 'completed';
    }

    let abortListener: (() => void) | null = null;
    const cancelled = new Promise<'cancelled'>((resolve) => {
      abortListener = () => {
        resolve('cancelled');
        if (this.#snapshot.epoch === epoch) this.disconnect();
      };
      signal.addEventListener('abort', abortListener, { once: true });
    });

    try {
      return await Promise.race([operation.then(() => 'completed' as const), cancelled]);
    } finally {
      if (abortListener !== null) signal.removeEventListener('abort', abortListener);
    }
  }

  #setSnapshot(snapshot: RoomSessionSnapshot<TState>): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
