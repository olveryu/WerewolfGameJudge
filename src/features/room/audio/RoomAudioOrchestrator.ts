/**
 * RoomAudioOrchestrator — framework-agnostic host audio lifecycle core.
 *
 * The single implementation of the client audio protocol for every game with narration audio.
 * Games supply a player port (what sound an effect makes) and an ack port (their durable
 * `audio.ack` dispatch); all lifecycle decisions live here.
 *
 * Responsibilities:
 * - Reactively watch the queue source → play pending effects in order → ack.
 * - The ack is one durable room command: `RoomLink` persists it, replays it across sockets and
 *   settles the promise only with the server decision. The orchestrator therefore has no
 *   retry, reconnect or online-event logic of its own.
 * - After a successful ack, re-check the queue source and chain-play any new queue the ack's
 *   progression produced.
 * - Rejoin bookkeeping: `wasAudioInterrupted` marks that playback was interrupted; the game-side
 *   resume flow replays and acks through `dispatchAudioAck`.
 *
 * Boundary constraints:
 * - Only active for the host (plays only when isHost() === true).
 * - Not reusable after dispose(); create a new instance per link epoch.
 *
 * @remarks #isPlayingEffects re-entry guard: one effect queue plays at a time, and the guard
 *   stays held while a durable ack awaits its decision so a reconnect cannot start a second
 *   playback of the same queue. MAX iterations = 20 bounds chained queues.
 */

import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import {
  getRoomCommandFailureReason,
  isSuccessfulRoomCommand,
} from '@/features/room/link/roomCommandResult';
import type { DispatchOutcome } from '@/platform/realtime/types';

/** The queue view of room state the lifecycle reads from a snapshot. */
export interface RoomAudioQueueSnapshot<TEffect> {
  readonly pendingAudioEffects: readonly TEffect[];
  /** Id of the batch in `pendingAudioEffects`; the ack names it so a replayed ack cannot clear a later batch. */
  readonly audioBatchId: number;
}

/** Queue source port (adapts a game's room link). */
export interface RoomAudioQueueSource<TEffect> {
  getSnapshot(): RoomAudioQueueSnapshot<TEffect> | null;
  subscribe(listener: (snapshot: RoomAudioQueueSnapshot<TEffect> | null) => void): () => void;
}

/**
 * Player port: game-owned playback. `playEffect` resolves when the clip finished (or was
 * skipped by the platform player). A missing-asset error is a programming error and must be
 * reported through `isMissingAssetError` so the core fails fast instead of skipping it.
 * `stopBgm` is the shared dawn timing hook, called right before NIGHT_END_AUDIO_KEY plays.
 */
export interface RoomAudioPlayerPort<TEffect> {
  playEffect(effect: TEffect): Promise<void>;
  /** Stops host background music immediately; must be idempotent. */
  stopBgm(): void;
  /** Optional batch preparation (asset preload) before sequential playback. */
  prepareQueue?(effects: readonly TEffect[]): Promise<void>;
  /** Whether an error is a missing-asset failure (fail-fast, never skipped). */
  isMissingAssetError?(error: unknown): boolean;
}

/** Ack port: dispatches the game's durable audio ack command for one batch. */
export interface RoomAudioAckPort<TState extends BaseGameState<string>> {
  dispatch(audioBatchId: number): Promise<DispatchOutcome<TState>>;
}

/** Logger port: the game's named runtime logger. */
export interface RoomAudioLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface RoomAudioOrchestratorDeps<TEffect, TState extends BaseGameState<string>> {
  queueSource: RoomAudioQueueSource<TEffect>;
  player: RoomAudioPlayerPort<TEffect>;
  ack: RoomAudioAckPort<TState>;
  /** Whether currently host (lazy-evaluated). */
  isHost: () => boolean;
  /** Whether the owning link epoch is torn down (lazy-evaluated). */
  isAborted: () => boolean;
  logger: RoomAudioLogger;
  /** Error pipeline hook for playback failures caught by the core. */
  onError?: (error: unknown, label: string) => void;
}

const MAX_CHAINED_QUEUES = 20;

export class RoomAudioOrchestrator<
  TEffect extends { readonly audioKey: string },
  TState extends BaseGameState<string>,
> {
  readonly #deps: RoomAudioOrchestratorDeps<TEffect, TState>;
  #isPlayingEffects = false;
  #wasAudioInterrupted = false;
  #unsubscribeRoom: (() => void) | null = null;

  constructor(deps: RoomAudioOrchestratorDeps<TEffect, TState>) {
    this.#deps = deps;
    this.#unsubscribeRoom = deps.queueSource.subscribe((snapshot) => {
      if (snapshot === null || !deps.isHost()) return;
      if (snapshot.pendingAudioEffects.length > 0 && !this.#wasAudioInterrupted) {
        void this.#playPendingAudioEffects(snapshot).catch((error: unknown) => {
          this.#deps.onError?.(error, '音频效果队列');
        });
      }
    });
  }

  /** Whether audio was interrupted after host rejoin (cached isAudioPlaying === true). */
  get wasAudioInterrupted(): boolean {
    return this.#wasAudioInterrupted;
  }

  setWasAudioInterrupted(value: boolean): void {
    this.#wasAudioInterrupted = value;
  }

  /** Reset for a new room. */
  reset(): void {
    this.#isPlayingEffects = false;
    this.#wasAudioInterrupted = false;
  }

  /** Stop observing the queue when the link epoch ends. */
  dispose(): void {
    this.#unsubscribeRoom?.();
    this.#unsubscribeRoom = null;
  }

  /**
   * Dispatch the durable audio ack for `audioBatchId` and wait for the server decision. Used by
   * the playback loop and by game-side resume flows that replay audio themselves and then
   * release the gate for the batch they replayed.
   */
  async dispatchAudioAck(source: string, audioBatchId: number): Promise<DispatchOutcome<TState>> {
    const outcome = await this.#deps.ack.dispatch(audioBatchId);
    if (outcome.kind === 'cancelled') {
      this.#deps.logger.info('Audio ack cancelled with its link epoch', { source, audioBatchId });
    } else if (!isSuccessfulRoomCommand(outcome)) {
      this.#deps.logger.warn('Audio ack was rejected', {
        source,
        audioBatchId,
        commandId: outcome.commandId,
        reason: getRoomCommandFailureReason(outcome),
      });
    }
    return outcome;
  }

  /**
   * Host reactively plays the pending batch, acks it by id, then re-checks for a chained
   * batch produced by the ack's progression (the source emission during playback was skipped
   * by the re-entry guard).
   */
  async #playPendingAudioEffects(batch: RoomAudioQueueSnapshot<TEffect>): Promise<void> {
    if (this.#isPlayingEffects) return;
    this.#isPlayingEffects = true;

    const { player } = this.#deps;
    try {
      let current: RoomAudioQueueSnapshot<TEffect> | null = batch;
      let iteration = 0;

      while (current !== null && current.pendingAudioEffects.length > 0) {
        if (++iteration > MAX_CHAINED_QUEUES) {
          this.#deps.logger.warn('playPendingAudioEffects exceeded max iterations, breaking', {
            maxIterations: MAX_CHAINED_QUEUES,
          });
          break;
        }
        if (player.prepareQueue) await player.prepareQueue(current.pendingAudioEffects);
        for (const effect of current.pendingAudioEffects) {
          if (this.#deps.isAborted()) break;
          try {
            if (effect.audioKey === NIGHT_END_AUDIO_KEY) player.stopBgm();
            await player.playEffect(effect);
          } catch (error) {
            if (player.isMissingAssetError?.(error) === true) throw error;
            this.#deps.logger.warn('Audio effect playback failed, continuing', {
              audioKey: effect.audioKey,
              error,
            });
          }
        }

        if (this.#deps.isAborted()) break;
        const ackResult = await this.dispatchAudioAck('playback', current.audioBatchId);
        if (!isSuccessfulRoomCommand(ackResult)) break;

        const postAckSnapshot = this.#deps.queueSource.getSnapshot();
        current =
          postAckSnapshot !== null &&
          postAckSnapshot.audioBatchId > current.audioBatchId &&
          this.#deps.isHost() &&
          !this.#wasAudioInterrupted
            ? postAckSnapshot
            : null;
      }
    } finally {
      this.#isPlayingEffects = false;
    }
  }
}
