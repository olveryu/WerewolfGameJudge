/**
 * useRoomAudioOrchestration — the shared room audio core (`RoomAudioOrchestrator`)
 * bound to a ready room session, as a hook. One core per mounted room.
 *
 * A game supplies only its ports: the player (clips for its effects), the
 * ack command, the narrated-phase predicate and the rejoin replay. The
 * lifecycle, the queue source (the authoritative session snapshot, never a
 * React prop, so the ack-then-recheck chain sees the cleared queue), the
 * host-rejoin interruption mark and the resume-under-guard sequence are the
 * platform's, once.
 *
 * Rejoin mark: the room mounts only on a ready link (`RoomEntryBoundary`), and
 * a link epoch change re-enters the room, so the first snapshot this hook
 * sees is the one that tells whether the host arrived mid-narration. A host
 * mounting in a narrated phase is marked interrupted — the device has no
 * audio gesture after a reconnect — and the queue subscription stays
 * silent until `resumeAfterRejoin` (the resume-gate gesture) replays the
 * game's clip for the current step under the core's re-entry guard, acks
 * the interrupted batch by id and chains on.
 */

import type { AudioEffect } from '@game-judge/game-engine/platform/audio';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useEffect, useRef } from 'react';

import type { DispatchOutcome, RoomLink } from '@/platform/realtime/types';
import { handleError } from '@/utils/errorPipeline';
import type { log } from '@/utils/logger';

import {
  RoomAudioOrchestrator,
  type RoomAudioPlayerPort,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from './RoomAudioOrchestrator';

/** The audio-queue slice every narrated game's state carries (platform `audioQueue`). */
export interface RoomAudioQueueState {
  readonly pendingAudioEffects: readonly AudioEffect[];
  readonly isAudioPlaying: boolean;
  readonly audioBatchId: number;
}

/**
 * The game's ports. All of them must be stable identities (module-level
 * functions / constants, the room's audio runtime instance): a change
 * rebinds the core.
 */
export interface RoomAudioOrchestrationOptions<
  TState extends BaseGameState<string> & RoomAudioQueueState,
  TCommand extends object,
> {
  readonly session: RoomLink<TState, TCommand>;
  readonly isHost: boolean;
  readonly player: RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void };
  /** The game's durable audio ack for one batch. */
  readonly ackCommand: (audioBatchId: number) => TCommand;
  readonly ackLabel: string;
  /** The game is in a phase with host narration (the night; the dawn batch). */
  readonly isNarratedPhase: (state: TState) => boolean;
  /**
   * The clip to replay for the current step after a host rejoin; `null`
   * when the interrupted batch has nothing to re-hear (e.g. the dawn batch),
   * in which case the resume only acks.
   */
  readonly resolveReplayAudioKey: (state: TState) => string | null;
  /** The game's named runtime logger (also the error-pipeline logger). */
  readonly logger: ReturnType<typeof log.extend>;
}

export interface RoomAudioOrchestration {
  /** The core's interruption mark, read fresh (not React state). */
  readonly readWasAudioInterrupted: () => boolean;
  /** Replay the current step's clip after a host rejoin and ack the interrupted batch. */
  readonly resumeAfterRejoin: () => Promise<void>;
}

export function useRoomAudioOrchestration<
  TState extends BaseGameState<string> & RoomAudioQueueState,
  TCommand extends object,
>({
  session,
  isHost,
  player,
  ackCommand,
  ackLabel,
  isNarratedPhase,
  resolveReplayAudioKey,
  logger,
}: RoomAudioOrchestrationOptions<TState, TCommand>): RoomAudioOrchestration {
  const isHostRef = useRef(isHost);
  const abortedRef = useRef(false);
  const coreRef = useRef<RoomAudioOrchestrator<AudioEffect, TState> | null>(null);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const readQueueSnapshot = (): RoomAudioQueueSnapshot<AudioEffect> | null => {
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return null;
      return {
        pendingAudioEffects: current.room.state.pendingAudioEffects,
        audioBatchId: current.room.state.audioBatchId,
      };
    };
    const queueSource: RoomAudioQueueSource<AudioEffect> = {
      getSnapshot: readQueueSnapshot,
      subscribe: (listener) => session.subscribe(() => listener(readQueueSnapshot())),
    };
    const core = new RoomAudioOrchestrator<AudioEffect, TState>({
      queueSource,
      player,
      ack: {
        dispatch: (audioBatchId): Promise<DispatchOutcome<TState>> =>
          session.dispatch(ackCommand(audioBatchId), {
            controlledSeat: null,
            label: ackLabel,
            durable: true,
          }),
      },
      isHost: () => isHostRef.current,
      isAborted: () => abortedRef.current,
      logger,
      onError: (error, label) => handleError(error, { label, logger, feedback: false }),
    });
    coreRef.current = core;
    abortedRef.current = false;

    // The room mounts only on a ready link: this snapshot is the rejoin fact.
    const snapshot = session.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Room audio orchestration mounted without a ready session');
    }
    core.setWasAudioInterrupted(isHostRef.current && isNarratedPhase(snapshot.room.state));

    return () => {
      abortedRef.current = true;
      core.dispose();
      coreRef.current = null;
      player.stopNarration();
    };
  }, [ackCommand, ackLabel, isNarratedPhase, logger, player, session]);

  // Read from effects declared after this hook (useRoomAudioResume), so the
  // core exists; a null core is a call-order bug.
  const readWasAudioInterrupted = useCallback(() => {
    const core = coreRef.current;
    if (core === null) throw new Error('[FAIL-FAST] Audio core read before it was bound');
    return core.wasAudioInterrupted;
  }, []);

  const resumeAfterRejoin = useCallback(async (): Promise<void> => {
    const core = coreRef.current;
    const snapshot = session.getSnapshot();
    if (core === null || snapshot.phase !== 'ready') return;
    const state = snapshot.room.state;
    if (!state.isAudioPlaying) {
      core.setWasAudioInterrupted(false);
      return;
    }
    const audioKey = resolveReplayAudioKey(state);
    const replay =
      audioKey === null
        ? async () => undefined
        : async () => {
            logger.info('Replaying current step audio after rejoin', { audioKey });
            await player.playEffect({ audioKey });
          };
    try {
      await core.resumeInterrupted(replay, state.audioBatchId);
    } catch (error) {
      handleError(error, { label: 'resumeAfterRejoin', logger, feedback: false });
    }
  }, [logger, player, resolveReplayAudioKey, session]);

  return { readWasAudioInterrupted, resumeAfterRejoin };
}
