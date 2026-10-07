/** Owns pending command delivery and recovery for one session epoch; never owns game snapshots. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomCommandRecoveryRepository } from '@/features/room/services/RoomCommandRecoveryStore';
import { handleError } from '@/utils/errorPipeline';
import { roomSessionLog } from '@/utils/logger';

import { prepareRoomCommand } from './roomCommandClient';
import type {
  ActiveRoomIdentity,
  PreparedRoomCommand,
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
} from './types';

const RECOVERABLE_COMMAND_RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000] as const;

interface PendingRoomCommand<TState extends BaseGameState<string>> {
  readonly prepared: PreparedRoomCommand<object>;
  readonly label: string;
  readonly isRecoverable: boolean;
  attemptedConnectionGeneration: number;
  recoveryAttemptCount: number;
  nextRecoveryAtMs: number | null;
  inFlight: Promise<RoomCommandDispatchOutcome<TState>> | null;
}

interface RoomCommandRecoveryDeps<TState extends BaseGameState<string>> {
  readonly identity: ActiveRoomIdentity<TState['gameType']>;
  readonly sessionEpoch: number;
  readonly createCommandId: () => string;
  readonly repository: RoomCommandRecoveryRepository;
  readonly send: (
    prepared: PreparedRoomCommand<object>,
    label: string,
  ) => Promise<RoomCommandDispatchOutcome<TState>>;
  readonly onPendingCommandCount: (count: number) => void;
  readonly onRecoveredCommandRejection: (commandId: string, reason: string) => void;
  readonly onNewIntent: () => void;
}

function createIntentKey(command: object, controlledSeat: number | null): string {
  return canonicalJson({ controlledSeat, command });
}

/** One-shot recovery owner; dispose before replacing the session identity or epoch. */
export class RoomCommandRecovery<TState extends BaseGameState<string>> {
  readonly #deps: RoomCommandRecoveryDeps<TState>;
  readonly #pendingCommands = new Map<string, PendingRoomCommand<TState>>();
  #isDisposed = false;
  #isLive = false;
  #connectionGeneration = 0;
  #isCommandRecoveryScheduled = false;
  #commandRecoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: RoomCommandRecoveryDeps<TState>) {
    this.#deps = deps;
  }

  /** Restore persisted intentions before connecting, preserving their original command IDs. */
  restore(): void {
    this.#requireActive();
    const { identity, sessionEpoch, repository } = this.#deps;
    const recoveredCommands = [...repository.load(identity.room.roomId, identity.userId)].sort(
      (first, second) => first.createdAtMs - second.createdAtMs,
    );
    for (const recovered of recoveredCommands) {
      if (recovered.roomCode !== identity.room.roomCode) {
        throw new Error('[FAIL-FAST] Recoverable room command code changed for one room instance');
      }
      const prepared = prepareRoomCommand({
        sessionEpoch,
        roomCode: recovered.roomCode,
        roomId: recovered.roomId,
        commandId: recovered.commandId,
        command: recovered.command,
        controlledSeat: recovered.controlledSeat,
      });
      const intentKey = createIntentKey(prepared.command, prepared.controlledSeat);
      if (this.#pendingCommands.has(intentKey)) {
        throw new Error('[FAIL-FAST] Recoverable room commands contain duplicate intents');
      }
      this.#pendingCommands.set(intentKey, {
        prepared,
        label: recovered.label,
        isRecoverable: true,
        attemptedConnectionGeneration: -1,
        recoveryAttemptCount: 0,
        nextRecoveryAtMs: null,
        inFlight: null,
      });
    }
    this.#publishPendingCommandCount();
  }

  /** Persist new recoverable intentions before sending; share in-flight work for one intent. */
  dispatch(
    command: object,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    this.#requireActive();
    const intentKey = createIntentKey(command, options.controlledSeat);
    let pending = this.#pendingCommands.get(intentKey);
    if (pending === undefined) {
      this.#deps.onNewIntent();
      const { identity, sessionEpoch, createCommandId, repository } = this.#deps;
      const prepared = prepareRoomCommand({
        sessionEpoch,
        roomCode: identity.room.roomCode,
        roomId: identity.room.roomId,
        command,
        controlledSeat: options.controlledSeat,
        commandId: createCommandId(),
      });
      const isRecoverable = options.isRecoverable === true;
      if (isRecoverable) {
        repository.save({
          roomCode: prepared.roomCode,
          roomId: prepared.roomId,
          userId: identity.userId,
          commandId: prepared.commandId,
          command: prepared.command,
          controlledSeat: prepared.controlledSeat,
          label: options.label,
        });
      }
      pending = {
        prepared,
        label: options.label,
        isRecoverable,
        attemptedConnectionGeneration: -1,
        recoveryAttemptCount: 0,
        nextRecoveryAtMs: null,
        inFlight: null,
      };
      this.#pendingCommands.set(intentKey, pending);
      this.#publishPendingCommandCount();
    } else if (pending.isRecoverable !== (options.isRecoverable === true)) {
      throw new Error('[FAIL-FAST] Room command recovery policy changed for one pending intent');
    }
    return pending.inFlight ?? this.#dispatchPendingCommand(intentKey, pending);
  }

  /** Resume recovery only after the coordinator confirms a live authoritative snapshot. */
  setConnection(isLive: boolean): void {
    this.#requireActive();
    if (!isLive) this.#clearRecoverableCommandRetry();
    if (this.#isLive === isLive) return;
    this.#isLive = isLive;
    if (isLive) {
      this.#connectionGeneration += 1;
      this.#scheduleRecoverableCommandRecovery();
    }
  }

  /** Number of persisted intentions whose delivery has not reached a terminal result. */
  countRecoverableCommands(): number {
    return [...this.#pendingCommands.values()].filter(({ isRecoverable }) => isRecoverable).length;
  }

  /** Stop local work without deleting persisted intentions needed by a later session. */
  dispose(): void {
    this.#isDisposed = true;
    this.#isLive = false;
    this.#clearRecoverableCommandRetry();
    this.#pendingCommands.clear();
  }

  #dispatchPendingCommand(
    intentKey: string,
    entry: PendingRoomCommand<TState>,
  ): Promise<RoomCommandDispatchOutcome<TState>> {
    if (entry.attemptedConnectionGeneration !== this.#connectionGeneration) {
      entry.recoveryAttemptCount = 0;
    }
    entry.attemptedConnectionGeneration = this.#connectionGeneration;
    entry.nextRecoveryAtMs = null;
    const inFlight = this.#deps
      .send(entry.prepared, entry.label)
      .then((outcome) => {
        if (this.#pendingCommands.get(intentKey) === entry) {
          if (outcome.kind === 'decided' || outcome.kind === 'notDecided') {
            if (entry.isRecoverable) {
              this.#deps.repository.remove(
                entry.prepared.roomId,
                this.#deps.identity.userId,
                entry.prepared.commandId,
              );
            }
            this.#pendingCommands.delete(intentKey);
            this.#publishPendingCommandCount();
          } else if (entry.isRecoverable) {
            const delayIndex = Math.min(
              entry.recoveryAttemptCount,
              RECOVERABLE_COMMAND_RETRY_DELAYS_MS.length - 1,
            );
            entry.recoveryAttemptCount += 1;
            entry.nextRecoveryAtMs = Date.now() + RECOVERABLE_COMMAND_RETRY_DELAYS_MS[delayIndex]!;
          }
        }
        return outcome;
      })
      .finally(() => {
        if (this.#pendingCommands.get(intentKey) !== entry) return;
        entry.inFlight = null;
        if (
          entry.isRecoverable &&
          entry.attemptedConnectionGeneration < this.#connectionGeneration &&
          this.#isLive
        ) {
          this.#scheduleRecoverableCommandRecovery();
        } else if (entry.isRecoverable) {
          this.#scheduleRecoverableCommandRetry();
        }
      });
    entry.inFlight = inFlight;
    return inFlight;
  }

  #scheduleRecoverableCommandRecovery(): void {
    this.#clearRecoverableCommandRetry();
    if (this.#isDisposed || this.#isCommandRecoveryScheduled) return;
    this.#isCommandRecoveryScheduled = true;
    const generation = this.#connectionGeneration;
    void this.#recoverCommandsForConnection(generation)
      .catch((error: unknown) => {
        handleError(error, {
          label: '恢复待确认房间操作',
          logger: roomSessionLog,
          feedback: false,
        });
      })
      .finally(() => {
        this.#isCommandRecoveryScheduled = false;
        if (this.#isDisposed) return;
        if ([...this.#pendingCommands.values()].some((entry) => this.#isReadyForRecovery(entry))) {
          this.#scheduleRecoverableCommandRecovery();
        } else {
          this.#scheduleRecoverableCommandRetry();
        }
      });
  }

  async #recoverCommandsForConnection(connectionGeneration: number): Promise<void> {
    while (
      !this.#isDisposed &&
      this.#isLive &&
      this.#connectionGeneration === connectionGeneration
    ) {
      const pending = [...this.#pendingCommands.entries()].find(([, entry]) =>
        this.#isReadyForRecovery(entry),
      );
      if (pending === undefined) return;
      const outcome = await this.#dispatchPendingCommand(...pending);
      if (this.#isDisposed) return;
      if (outcome.kind !== 'decided') {
        if (outcome.kind === 'notDecided') {
          this.#deps.onRecoveredCommandRejection(outcome.commandId, outcome.reason);
          continue;
        }
        return;
      }
      const decision = outcome.decision;
      const reason =
        decision.kind === 'rejected'
          ? decision.reason
          : decision.outcome.kind === 'domainRejected'
            ? decision.outcome.reason
            : null;
      if (reason !== null) {
        this.#deps.onRecoveredCommandRejection(decision.commandId, reason);
      }
    }
  }

  #isReadyForRecovery(entry: PendingRoomCommand<TState>): boolean {
    return (
      this.#isLive &&
      entry.isRecoverable &&
      entry.inFlight === null &&
      (entry.attemptedConnectionGeneration < this.#connectionGeneration ||
        (entry.attemptedConnectionGeneration === this.#connectionGeneration &&
          entry.nextRecoveryAtMs !== null &&
          entry.nextRecoveryAtMs <= Date.now()))
    );
  }

  #scheduleRecoverableCommandRetry(): void {
    if (
      this.#isDisposed ||
      this.#commandRecoveryRetryTimer !== null ||
      this.#isCommandRecoveryScheduled ||
      !this.#isLive
    ) {
      return;
    }
    const retryTimes = [...this.#pendingCommands.values()].flatMap((entry) => {
      if (
        !entry.isRecoverable ||
        entry.inFlight !== null ||
        entry.attemptedConnectionGeneration !== this.#connectionGeneration ||
        entry.nextRecoveryAtMs === null
      ) {
        return [];
      }
      return [entry.nextRecoveryAtMs];
    });
    if (retryTimes.length === 0) return;
    const retryAtMs = Math.min(...retryTimes);
    this.#commandRecoveryRetryTimer = setTimeout(
      () => {
        this.#commandRecoveryRetryTimer = null;
        this.#scheduleRecoverableCommandRecovery();
      },
      Math.max(0, retryAtMs - Date.now()),
    );
  }

  #clearRecoverableCommandRetry(): void {
    if (this.#commandRecoveryRetryTimer === null) return;
    clearTimeout(this.#commandRecoveryRetryTimer);
    this.#commandRecoveryRetryTimer = null;
  }

  #publishPendingCommandCount(): void {
    this.#deps.onPendingCommandCount(this.countRecoverableCommands());
  }

  #requireActive(): void {
    if (this.#isDisposed) {
      throw new Error('[FAIL-FAST] Room command recovery belongs to a disposed session');
    }
  }
}
