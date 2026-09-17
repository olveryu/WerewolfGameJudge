/** Coordinates room identity, epoch and authoritative snapshots; delegates connection and command recovery. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type {
  BaseGameState,
  GameStateCodec,
  RoomSnapshot,
  StateUpdateMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import type { RoomCommandRecoveryRepository } from '@/features/room/services/RoomCommandRecoveryStore';
import {
  prepareRoomCommand,
  sendPreparedRoomCommand,
} from '@/features/room/session/roomCommandClient';
import { RoomCommandRecovery } from '@/features/room/session/RoomCommandRecovery';
import type {
  ActiveRoomIdentity,
  PreparedRoomCommand,
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
  RoomConnectOutcome,
  RoomSessionClient,
  RoomSessionSnapshot,
} from '@/features/room/session/types';
import { ConnectionManager } from '@/services/connection/ConnectionManager';
import { ConnectionState } from '@/services/connection/types';
import { appVisibilityStore } from '@/services/infra/appVisibility';
import type { IRealtimeTransport } from '@/services/types/IRealtimeTransport';

interface RoomSessionDeps<TState extends BaseGameState<string>> {
  readonly codec: GameStateCodec<TState>;
  readonly transport: IRealtimeTransport<TState>;
  readonly createCommandId: () => string;
  readonly commandRecovery: RoomCommandRecoveryRepository;
  readonly initialEpoch?: number;
}

export function createIdleSnapshot<TState extends BaseGameState<string>>(
  epoch: number,
): RoomSessionSnapshot<TState> {
  return Object.freeze({
    phase: 'idle',
    epoch,
    identity: null,
    connection: 'disconnected',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
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

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}

/** Owns exactly one room identity from connect() until disconnect(). */
export class RoomSession<
  TState extends BaseGameState<string>,
  TCommand extends object,
> implements RoomSessionClient<TState, TCommand> {
  readonly #codec: GameStateCodec<TState>;
  readonly #connection: ConnectionManager<TState>;
  readonly #createCommandId: () => string;
  readonly #commandRecovery: RoomCommandRecoveryRepository;
  readonly #listeners = new Set<() => void>();
  #commands: RoomCommandRecovery<TState> | null = null;
  #snapshot: RoomSessionSnapshot<TState> = createIdleSnapshot(0);
  #commandAbortController: AbortController | null = null;
  #snapshotFingerprint: string | null = null;
  #runtimeResetExpected = false;

  constructor(deps: RoomSessionDeps<TState>) {
    this.#snapshot = createIdleSnapshot(deps.initialEpoch ?? 0);
    this.#codec = deps.codec;
    this.#createCommandId = deps.createCommandId;
    this.#commandRecovery = deps.commandRecovery;
    this.#connection = new ConnectionManager<TState>({
      transport: deps.transport,
      onStateUpdate: (message) => this.#applyStateUpdate(message),
      onStateSync: (snapshot) => this.#applySnapshot(snapshot, null),
      appVisibilityStore,
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
    if (this.#commandAbortController !== null) {
      throw new Error('[FAIL-FAST] Idle room session retained a command abort controller');
    }

    const epoch = this.#snapshot.epoch + 1;
    this.#commandAbortController = new AbortController();
    this.#snapshotFingerprint = null;
    this.#commands = new RoomCommandRecovery({
      identity,
      sessionEpoch: epoch,
      createCommandId: this.#createCommandId,
      repository: this.#commandRecovery,
      send: (prepared, label) => this.#sendPreparedCommand(prepared, label),
      onPendingCommandCount: (count) => this.#publishPendingCommandCount(count),
      onRecoveredCommandRejection: (commandId, reason) =>
        this.#publishRecoveredCommandRejection(commandId, reason),
      onNewIntent: () => this.#clearRecoveredCommandRejection(),
    });
    this.#setSnapshot(
      Object.freeze({
        phase: 'entering',
        epoch,
        identity,
        connection: 'connecting',
        pendingCommandCount: 0,
        lastRecoveredCommandRejection: null,
        snapshot: null,
        lastCommand: null,
        error: null,
      }),
    );

    try {
      this.#commands.restore();
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
          pendingCommandCount: this.#requireCommands().countRecoverableCommands(),
          lastRecoveredCommandRejection: null,
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
    this.#commandAbortController?.abort();
    this.#commandAbortController = null;
    this.#commands?.dispose();
    this.#commands = null;
    this.#snapshotFingerprint = null;
    this.#setSnapshot(createIdleSnapshot(nextEpoch));
    this.#resetConnectionRuntime();
  }

  /** Permanently release this room instance and its platform listeners. */
  dispose(): void {
    this.disconnect();
    this.#connection.dispose();
    this.#listeners.clear();
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
    this.#requireReadySnapshot();
    return this.#requireCommands().dispatch(command, options);
  }

  async dispatchPrepared<TPreparedCommand extends TCommand>(
    prepared: PreparedRoomCommand<TPreparedCommand>,
    label: string,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    return this.#sendPreparedCommand(prepared, label);
  }

  /** Consume a matching background-recovery failure without clearing a newer one. */
  acknowledgeRecoveredCommandRejection(commandId: string): void {
    if (this.#snapshot.lastRecoveredCommandRejection?.commandId !== commandId) return;
    this.#clearRecoveredCommandRejection();
  }

  async #sendPreparedCommand(
    prepared: PreparedRoomCommand<object>,
    label: string,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    const current = this.#requirePreparedCommand(prepared);
    const signal = this.#commandAbortController?.signal;
    if (signal === undefined) {
      throw new Error('[FAIL-FAST] Ready room session has no command abort controller');
    }
    const attempt = await sendPreparedRoomCommand({
      prepared,
      codec: this.#codec,
      label,
      signal,
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
    this.#setSnapshot(
      Object.freeze({
        phase: 'ready',
        epoch: current.epoch,
        identity: current.identity,
        connection: mapConnectionStatus(this.#connection.getState()),
        pendingCommandCount: this.#requireCommands().countRecoverableCommands(),
        lastRecoveredCommandRejection: current.lastRecoveredCommandRejection,
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
          pendingCommandCount: this.#requireCommands().countRecoverableCommands(),
          lastRecoveredCommandRejection: current.lastRecoveredCommandRejection,
          snapshot: null,
          lastCommand: null,
          error,
        }),
      );
      return;
    }
    if (current.connection === connection) return;

    this.#setSnapshot(Object.freeze({ ...current, connection }));
    this.#requireCommands().setConnection(connection === 'live');
  }

  #requireCommands(): RoomCommandRecovery<TState> {
    if (this.#commands === null) {
      throw new Error('[FAIL-FAST] Active room session has no command recovery owner');
    }
    return this.#commands;
  }

  #publishPendingCommandCount(pendingCommandCount: number): void {
    if (this.#snapshot.pendingCommandCount === pendingCommandCount) return;
    this.#setSnapshot(Object.freeze({ ...this.#snapshot, pendingCommandCount }));
  }

  #clearRecoveredCommandRejection(): void {
    if (this.#snapshot.lastRecoveredCommandRejection === null) return;
    this.#setSnapshot(Object.freeze({ ...this.#snapshot, lastRecoveredCommandRejection: null }));
  }

  #publishRecoveredCommandRejection(commandId: string, reason: string): void {
    this.#setSnapshot(
      Object.freeze({
        ...this.#snapshot,
        lastRecoveredCommandRejection: { commandId, reason },
      }),
    );
  }

  #requireReadySnapshot(): Extract<RoomSessionSnapshot<TState>, { readonly phase: 'ready' }> {
    if (this.#snapshot.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Room command requires a ready room session');
    }
    return this.#snapshot;
  }

  #requirePreparedCommand(
    prepared: PreparedRoomCommand<object>,
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
