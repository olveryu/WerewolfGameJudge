/**
 * WerewolfAudioOrchestrator — Werewolf binding of the shared room audio core.
 *
 * The lifecycle (reactive playback, prepared-envelope ack, three-layer
 * reconnect recovery, ack recheck chaining) lives in the shared
 * `RoomAudioOrchestrator` (src/features/room/audio). This class keeps only
 * the Werewolf-owned parts:
 * - Player adapter: maps an AudioEffect to the Werewolf runtime's play
 *   methods (night / night_end BGM stop / beginning / ending) and treats
 *   MissingWerewolfAudioError as fail-fast.
 * - Ack adapter: prepares/dispatches `werewolf.audio.ack` through
 *   werewolfGameActions.
 * - Rejoin resume extension: replays the current step's beginning audio
 *   (seer label resolution is Werewolf-owned) and releases the gate
 *   through the core's retained ack envelope.
 *
 * Boundary constraints:
 * - Only active for Host role (the core plays/retries only when isHost())
 * - Not reusable after dispose(), must create a new instance
 */

import type { AudioEffect, GameState } from '@game-judge/game-engine/games/werewolf/public';
import { getStepSpec } from '@game-judge/game-engine/games/werewolf/public';
import { resolveSeerAudioKey } from '@game-judge/game-engine/games/werewolf/public';

import {
  RoomAudioOrchestrator,
  type RoomAudioPlayerPort,
  type RoomAudioQueueSnapshot,
} from '@/features/room/audio/RoomAudioOrchestrator';
import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import { MissingWerewolfAudioError } from '@/games/werewolf/audio/audioRegistry';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { handleError } from '@/utils/errorPipeline';
import { werewolfRuntimeLog } from '@/utils/logger';

import type { GameActionsContext, PreparedAudioAck } from './werewolfGameActions';
import * as gameActions from './werewolfGameActions';

/** WerewolfAudioOrchestrator injectable dependencies. */
export interface WerewolfAudioRoomSnapshot {
  readonly state: GameState;
  readonly connection: RoomConnectionStatus;
}

export interface WerewolfAudioRoomSource {
  getSnapshot(): WerewolfAudioRoomSnapshot | null;
  subscribe(listener: (snapshot: WerewolfAudioRoomSnapshot | null) => void): () => void;
}

export interface WerewolfAudioOrchestratorDeps {
  /** Combined Werewolf room state + connection source. */
  roomSource: WerewolfAudioRoomSource;
  /** Game-owned narration runtime. */
  audio: WerewolfAudioRuntime;
  /** Get current GameActionsContext (lazy-evaluated to avoid constructor cycles) */
  getActionsContext: () => GameActionsContext;
  /** Whether currently Host (lazy-evaluated) */
  isHost: () => boolean;
  /** Whether currently aborted (lazy-evaluated) */
  isAborted: () => boolean;
}

function toQueueSnapshot(
  snapshot: WerewolfAudioRoomSnapshot | null,
): RoomAudioQueueSnapshot<AudioEffect> | null {
  if (snapshot === null) return null;
  return {
    pendingAudioEffects: snapshot.state.pendingAudioEffects,
    connection: snapshot.connection,
  };
}

/** Werewolf player adapter: effect -> WerewolfAudioRuntime play methods. */
function createWerewolfPlayerPort(audio: WerewolfAudioRuntime): RoomAudioPlayerPort<AudioEffect> {
  return {
    playEffect: async (effect) => {
      if (effect.isEndAudio) {
        await audio.playEnding(effect.audioKey);
      } else if (effect.audioKey === 'night') {
        await audio.playNight();
      } else if (effect.audioKey === 'night_end') {
        // Audio timing: stop BGM immediately before dawn audio to avoid BGM overlapping with "dawn" voice.
        audio.stopBgm();
        await audio.playNightEnd();
      } else {
        await audio.playBeginning(effect.audioKey);
      }
    },
    isMissingAssetError: (error) => error instanceof MissingWerewolfAudioError,
  };
}

/**
 * WerewolfAudioOrchestrator — host audio orchestration + rejoin resume.
 *
 * Lifecycle execution is delegated to the shared RoomAudioOrchestrator;
 * this wrapper owns the Werewolf player/ack adapters and the step-audio
 * replay used after host rejoin.
 */
export class WerewolfAudioOrchestrator {
  readonly #deps: WerewolfAudioOrchestratorDeps;
  readonly #core: RoomAudioOrchestrator<AudioEffect, PreparedAudioAck, GameState>;

  constructor(deps: WerewolfAudioOrchestratorDeps) {
    this.#deps = deps;

    this.#core = new RoomAudioOrchestrator<AudioEffect, PreparedAudioAck, GameState>({
      queueSource: {
        getSnapshot: () => toQueueSnapshot(deps.roomSource.getSnapshot()),
        subscribe: (listener) =>
          deps.roomSource.subscribe((snapshot) => listener(toQueueSnapshot(snapshot))),
      },
      player: createWerewolfPlayerPort(deps.audio),
      ack: {
        prepare: () => gameActions.prepareAudioAck(deps.getActionsContext()),
        dispatch: (prepared) =>
          gameActions.dispatchPreparedAudioAck(deps.getActionsContext(), prepared),
      },
      isHost: deps.isHost,
      isAborted: deps.isAborted,
      logger: werewolfRuntimeLog,
      onError: (error, label) =>
        handleError(error, { label, logger: werewolfRuntimeLog, feedback: false }),
    });
  }

  // =========================================================================
  // Public API (delegated lifecycle state)
  // =========================================================================

  /** Whether audio was interrupted after Host rejoin (cached isAudioPlaying === true) */
  get wasAudioInterrupted(): boolean {
    return this.#core.wasAudioInterrupted;
  }

  /** Set wasAudioInterrupted flag (used by joinRoom to pre-set/modify) */
  setWasAudioInterrupted(value: boolean): void {
    this.#core.setWasAudioInterrupted(value);
  }

  /** Reset for new room (createRoom / joinRoom) */
  reset(): void {
    this.#core.reset();
  }

  /** Cleanup all handlers and timers when the session epoch ends. */
  dispose(): void {
    this.#core.dispose();
  }

  // =========================================================================
  // Resume After Rejoin (Werewolf extension: current-step audio replay)
  // =========================================================================

  /**
   * Called after Host rejoin + user clicks "resume game".
   * Triggers user gesture -> unlocks Web AudioContext.
   *
   * Behavior:
   * 1. If BGM setting is on -> start BGM (called by useWerewolfRoom)
   * 2. If audio was playing when disconnected -> replay current step begin audio
   * 3. After audio ends, POST audio-ack to unlock gate
   *
   * The authoritative audio gate remains active in the persisted snapshot during replay.
   */
  async resumeAfterRejoin(): Promise<void> {
    // Early clear — prevent listener from re-setting overlay + prevent multiple click re-entry
    if (!this.#core.wasAudioInterrupted) return;
    this.#core.setWasAudioInterrupted(false);

    const state = this.#deps.roomSource.getSnapshot()?.state;
    if (!state) return;

    try {
      // If audio not playing (isAudioPlaying=false in DB), only need to restore BGM (caller already handles)
      // Server inline progression handles subsequent steps automatically
      if (!state.isAudioPlaying) {
        return;
      }

      // Replay current step audio (isAudioPlaying persists as true from DB, gate is active)
      if (state.nightStep?.kind === 'inStep') {
        const stepSpec = getStepSpec(state.nightStep.stepId);
        if (stepSpec) {
          werewolfRuntimeLog.info('Replaying current step audio after rejoin', {
            stepId: state.nightStep.stepId,
            audioKey: stepSpec.audioKey,
          });
          try {
            const resolvedKey = resolveSeerAudioKey(stepSpec.audioKey, state.seerLabelMap);
            await this.#deps.audio.playBeginning(resolvedKey);
          } finally {
            // After audio completes (or fails), POST audio-ack to release gate + trigger progression
            if (!this.#deps.isAborted()) await this.#core.dispatchAudioAck('resumeAfterRejoin');
          }
        } else {
          // No stepSpec (shouldn't happen), fallback release gate
          await this.#core.dispatchAudioAck('resumeAfterRejoin');
        }
      } else {
        // No live night step, fallback release gate
        await this.#core.dispatchAudioAck('resumeAfterRejoin');
      }
    } catch (e) {
      // Caller uses fire-and-forget `void` — catch here to prevent unhandled rejection
      handleError(e, {
        label: 'resumeAfterRejoin',
        logger: werewolfRuntimeLog,
        feedback: false,
      });
    }
  }
}
