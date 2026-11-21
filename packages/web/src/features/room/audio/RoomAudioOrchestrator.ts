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
 * - Re-entry and playback failures require a gesture to resume the authoritative batch.
 *   Every cue must finish before its batch can be acknowledged, regardless of game phase.
 *
 * Boundary constraints:
 * - Only active for the host (plays only when isHost() === true).
 * - Not reusable after dispose(); create a new instance per mounted room.
 *
 * @remarks #isPlayingEffects re-entry guard: one playback runs at a time — reactive or resumed —
 *   and the guard stays held while a durable ack awaits its decision so a reconnect or a snapshot
 *   republish cannot start a second playback of the same batch. MAX iterations = 20 bounds
 *   chained queues.
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
  readonly isAudioPlaying: boolean;
  /** Id of the batch in `pendingAudioEffects`; the ack names it so a replayed ack cannot clear a later batch. */
  readonly audioBatchId: number;
}

/** Queue source port (adapts a game's room link). */
export interface RoomAudioQueueSource<TEffect> {
  getSnapshot(): RoomAudioQueueSnapshot<TEffect> | null;
  subscribe(listener: (snapshot: RoomAudioQueueSnapshot<TEffect> | null) => void): () => void;
}

/**
 * Player port: game-owned playback. `playEffect` resolves only when the clip finished,
 * and rejects on cancellation, missing assets or playback failure.
 * `stopBgm` is the shared dawn timing hook, called right before NIGHT_END_AUDIO_KEY plays.
 */
export interface RoomAudioPlayerPort<TEffect> {
  playEffect(effect: TEffect): Promise<void>;
  /** Stops host background music immediately; must be idempotent. */
  stopBgm(): void;
  /** Optional batch preparation (asset preload) before sequential playback. */
  prepareQueue?(effects: readonly TEffect[]): Promise<void>;
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
  readonly roomCode: string;
  logger: RoomAudioLogger;
  /** Error pipeline hook for playback failures caught by the core. */
  onError: (error: unknown, label: string) => void;
  onResumeRequiredChange: () => void;
}

const MAX_CHAINED_QUEUES = 20;

export class RoomAudioOrchestrator<
  TEffect extends { readonly audioKey: string },
  TState extends BaseGameState<string>,
> {
  readonly #deps: RoomAudioOrchestratorDeps<TEffect, TState>;
  #isPlayingEffects = false;
  #needsResume = false;
  #disposed = false;
  #playedBatchId: number | null = null;
  #acknowledgedBatchId: number | null = null;
  #unsubscribeRoom: (() => void) | null = null;

  constructor(deps: RoomAudioOrchestratorDeps<TEffect, TState>) {
    this.#deps = deps;
    this.#unsubscribeRoom = deps.queueSource.subscribe((snapshot) => {
      if (snapshot === null || !this.#isActive()) return;
      if (!snapshot.isAudioPlaying) {
        this.#playedBatchId = null;
        this.#acknowledgedBatchId = null;
        this.setNeedsResume(false);
      } else if (!this.#needsResume) {
        void this.#playPendingAudioEffects(snapshot).catch((error: unknown) => {
          this.#deps.onError(error, '语音播报');
        });
      }
    });
  }

  /** Whether re-entry or a failed batch requires a new playback gesture. */
  get needsResume(): boolean {
    return this.#needsResume;
  }

  /** Initializes recovery on entry and publishes subsequent recovery transitions. */
  setNeedsResume(value: boolean): void {
    if (this.#needsResume === value) return;
    this.#needsResume = value;
    this.#deps.onResumeRequiredChange();
  }

  /** Stop observing the queue when the link epoch ends. */
  dispose(): void {
    this.#disposed = true;
    this.#unsubscribeRoom?.();
    this.#unsubscribeRoom = null;
  }

  /**
   * Dispatch the durable audio ack for `audioBatchId` and wait for the server decision.
   */
  async #dispatchAudioAck(audioBatchId: number): Promise<DispatchOutcome<TState>> {
    const context = { roomCode: this.#deps.roomCode, audioBatchId };
    this.#deps.logger.info('Acknowledging completed narration batch', context);
    const outcome = await this.#deps.ack.dispatch(audioBatchId);
    if (outcome.kind === 'cancelled') {
      this.#deps.logger.info('Audio ack cancelled with its link epoch', context);
    } else if (!isSuccessfulRoomCommand(outcome)) {
      this.#deps.logger.warn('Audio ack was rejected', {
        ...context,
        commandId: outcome.commandId,
        reason: getRoomCommandFailureReason(outcome),
      });
    }
    return outcome;
  }

  /**
   * Resumes the current authoritative batch under the same guard as normal playback.
   * A completed batch awaiting a successful acknowledgement is not played a second time.
   */
  async resumeInterrupted(): Promise<void> {
    if (!this.#needsResume || !this.#isActive()) return;
    const snapshot = this.#deps.queueSource.getSnapshot();
    if (snapshot === null || !snapshot.isAudioPlaying) {
      this.setNeedsResume(false);
      this.#deps.logger.info('Narration already cleared before resume', {
        roomCode: this.#deps.roomCode,
      });
      return;
    }
    await this.#playPendingAudioEffects(snapshot);
  }

  /**
   * Host reactively plays the pending batch, acks it by id, then re-checks for a chained
   * batch produced by the ack's progression (the source emission during playback was skipped
   * by the re-entry guard).
   */
  async #playPendingAudioEffects(batch: RoomAudioQueueSnapshot<TEffect>): Promise<void> {
    if (
      this.#isPlayingEffects ||
      !this.#isActive() ||
      this.#acknowledgedBatchId === batch.audioBatchId
    )
      return;
    this.#isPlayingEffects = true;
    this.setNeedsResume(false);
    try {
      await this.#playBatches(batch);
    } catch (error) {
      if (!this.#isActive()) return;
      this.setNeedsResume(this.#deps.queueSource.getSnapshot()?.isAudioPlaying === true);
      throw error;
    } finally {
      this.#isPlayingEffects = false;
    }
  }

  #isActive(): boolean {
    return !this.#disposed && this.#deps.isHost();
  }

  async #playBatch(batch: RoomAudioQueueSnapshot<TEffect>): Promise<void> {
    const { player, logger, roomCode } = this.#deps;
    const context = { roomCode, audioBatchId: batch.audioBatchId };
    let audioKey: string | null = null;
    try {
      if (batch.pendingAudioEffects.length === 0) {
        throw new Error(
          `[FAIL-FAST] Active narration batch is empty: ${roomCode}/${batch.audioBatchId}`,
        );
      }
      logger.info('Playing narration batch', {
        ...context,
        audioKeys: batch.pendingAudioEffects.map((effect) => effect.audioKey),
      });
      await player.prepareQueue?.(batch.pendingAudioEffects);
      for (const effect of batch.pendingAudioEffects) {
        if (!this.#isActive()) return;
        audioKey = effect.audioKey;
        if (audioKey === NIGHT_END_AUDIO_KEY) player.stopBgm();
        await player.playEffect(effect);
      }
      if (!this.#isActive()) return;
      this.#playedBatchId = batch.audioBatchId;
      logger.info('Narration batch completed', context);
    } catch (error) {
      if (!this.#isActive()) return;
      logger.warn('Narration failed; batch remains unacknowledged', {
        ...context,
        audioKey,
        error,
      });
      throw error;
    }
  }

  /** Guard must already be held. Plays `batch`, acks it, chains strictly newer batches. */
  async #playBatches(batch: RoomAudioQueueSnapshot<TEffect>): Promise<void> {
    let current: RoomAudioQueueSnapshot<TEffect> | null = batch;
    let iteration = 0;

    while (current !== null && current.isAudioPlaying && this.#isActive()) {
      if (++iteration > MAX_CHAINED_QUEUES) {
        throw new Error(
          `[FAIL-FAST] Narration chain exceeded ${MAX_CHAINED_QUEUES} batches: ${this.#deps.roomCode}/${current.audioBatchId}`,
        );
      }
      if (this.#playedBatchId !== current.audioBatchId) {
        await this.#playBatch(current);
      }
      if (!this.#isActive()) return;
      const ackResult = await this.#dispatchAudioAck(current.audioBatchId);
      if (!this.#isActive()) return;
      if (!isSuccessfulRoomCommand(ackResult)) {
        throw new Error(
          `Narration acknowledgement failed: ${this.#deps.roomCode}/${current.audioBatchId}: ${getRoomCommandFailureReason(ackResult)}`,
        );
      }
      this.#acknowledgedBatchId = current.audioBatchId;
      current = this.#nextBatchAfter(current.audioBatchId);
    }
  }

  /** The batch to chain into after acking `ackedBatchId`, or null when nothing newer is pending. */
  #nextBatchAfter(ackedBatchId: number): RoomAudioQueueSnapshot<TEffect> | null {
    const snapshot = this.#deps.queueSource.getSnapshot();
    return snapshot !== null &&
      snapshot.audioBatchId > ackedBatchId &&
      snapshot.isAudioPlaying &&
      this.#isActive() &&
      !this.#needsResume
      ? snapshot
      : null;
  }
}
