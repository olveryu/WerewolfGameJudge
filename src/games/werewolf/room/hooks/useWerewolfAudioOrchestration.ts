/**
 * useWerewolfAudioOrchestration — the shared room audio core
 * (`RoomAudioOrchestrator`) bound to the Werewolf session, as a hook.
 *
 * What is Werewolf's here, and only this:
 * - player port: night / night-end / step-beginning / step-ending clips on
 *   the WerewolfAudioRuntime; a missing clip is a fail-fast asset error.
 * - ack port: `werewolf.audio.ack` as a durable command, replayed by the
 *   RoomLink across connections until the server decides.
 * - rejoin mark: a new link epoch for the host mid-night marks playback
 *   interrupted (the device has no gesture for audio after a reconnect);
 *   `resumeAfterRejoin` replays the current step's beginning clip under the
 *   core's re-entry guard, acks the interrupted batch and chains on.
 *
 * Lifecycle: one core per mounted room; `session.epoch` changes reset it
 * (the link reconnected), and unmount disposes it and stops narration.
 * The hook reads the authoritative queue from the session snapshot, never
 * from a React prop, so the ack-then-recheck chain sees the cleared queue.
 */

import type { AudioEffect, GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  getStepSpec,
  resolveSeerAudioKey,
} from '@game-judge/game-engine/games/werewolf/public';
import { NIGHT_END_AUDIO_KEY } from '@game-judge/game-engine/platform/audio';
import { useCallback, useEffect, useRef } from 'react';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '@/features/room/audio/RoomAudioOrchestrator';
import { MissingWerewolfAudioError } from '@/games/werewolf/audio/audioRegistry';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { handleError } from '@/utils/errorPipeline';
import { werewolfRuntimeLog } from '@/utils/logger';

interface UseWerewolfAudioOrchestrationDeps {
  readonly session: WerewolfRoomSession;
  readonly isHost: boolean;
  readonly audio: WerewolfAudioRuntime;
}

export interface WerewolfAudioOrchestration {
  /** The core's interruption mark, read fresh (not React state). */
  readonly readWasAudioInterrupted: () => boolean;
  /** Replay the current step after a host rejoin and ack the interrupted batch. */
  readonly resumeAfterRejoin: () => Promise<void>;
}

type WerewolfAudioCore = RoomAudioOrchestrator<AudioEffect, GameState>;

function readQueueSnapshot(
  session: WerewolfRoomSession,
): RoomAudioQueueSnapshot<AudioEffect> | null {
  const current = session.getSnapshot();
  if (current.phase !== 'ready') return null;
  return {
    pendingAudioEffects: current.room.state.pendingAudioEffects,
    audioBatchId: current.room.state.audioBatchId,
  };
}

export function useWerewolfAudioOrchestration({
  session,
  isHost,
  audio,
}: UseWerewolfAudioOrchestrationDeps): WerewolfAudioOrchestration {
  const isHostRef = useRef(isHost);
  const abortedRef = useRef(false);
  const coreRef = useRef<WerewolfAudioCore | null>(null);
  const epochRef = useRef<number | null>(null);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // One core per session; rebuilt on a new link epoch (reconnect), which is
  // also where the host's rejoin interruption mark is set.
  useEffect(() => {
    const queueSource: RoomAudioQueueSource<AudioEffect> = {
      getSnapshot: () => readQueueSnapshot(session),
      subscribe: (listener) => session.subscribe(() => listener(readQueueSnapshot(session))),
    };
    const core = new RoomAudioOrchestrator<AudioEffect, GameState>({
      queueSource,
      player: {
        playEffect: async (effect) => {
          if (effect.isEndAudio) await audio.playEnding(effect.audioKey);
          else if (effect.audioKey === 'night') await audio.playNight();
          else if (effect.audioKey === NIGHT_END_AUDIO_KEY) await audio.playNightEnd();
          else await audio.playBeginning(effect.audioKey);
        },
        stopBgm: audio.stopBgm,
        isMissingAssetError: (error) => error instanceof MissingWerewolfAudioError,
      },
      ack: {
        dispatch: (audioBatchId) =>
          session.dispatch(
            { type: 'werewolf.audio.ack', audioBatchId },
            { controlledSeat: null, label: '播报确认', durable: true },
          ),
      },
      isHost: () => isHostRef.current,
      isAborted: () => abortedRef.current,
      logger: werewolfRuntimeLog,
      onError: (error, label) =>
        handleError(error, { label, logger: werewolfRuntimeLog, feedback: false }),
    });
    coreRef.current = core;
    abortedRef.current = false;

    // Per epoch, once the first ready snapshot arrives: reset the core and
    // mark a reconnecting host mid-night as interrupted (the device has no
    // audio gesture), so the resume gate — not the queue — replays the batch.
    const syncEpoch = () => {
      const snapshot = session.getSnapshot();
      if (snapshot.phase !== 'ready' || epochRef.current === snapshot.epoch) return;
      epochRef.current = snapshot.epoch;
      core.reset();
      core.setWasAudioInterrupted(
        snapshot.identity.room.hostUserId === snapshot.identity.userId &&
          snapshot.room.state.status === GameStatus.Ongoing,
      );
    };
    syncEpoch();
    const unsubscribe = session.subscribe(syncEpoch);

    return () => {
      abortedRef.current = true;
      unsubscribe();
      core.dispose();
      coreRef.current = null;
      epochRef.current = null;
      audio.stopNarration();
    };
  }, [audio, session]);

  const readWasAudioInterrupted = useCallback(
    () => coreRef.current?.wasAudioInterrupted ?? false,
    [],
  );

  const resumeAfterRejoin = useCallback(async (): Promise<void> => {
    const core = coreRef.current;
    const snapshot = session.getSnapshot();
    if (core === null || snapshot.phase !== 'ready') return;
    const state = snapshot.room.state;
    if (!state.isAudioPlaying) {
      core.setWasAudioInterrupted(false);
      return;
    }
    // Outside a night step (night end) the gate closes on a batch with nothing to replay here.
    const stepId = state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : null;
    const stepSpec = stepId === null ? null : getStepSpec(stepId);
    if (stepSpec === undefined) throw new Error(`[FAIL-FAST] Night step has no spec: ${stepId}`);
    const replay =
      stepSpec === null
        ? async () => undefined
        : async () => {
            werewolfRuntimeLog.info('Replaying current step audio after rejoin', {
              audioKey: stepSpec.audioKey,
            });
            await audio.playBeginning(resolveSeerAudioKey(stepSpec.audioKey, state.seerLabelMap));
          };
    try {
      await core.resumeInterrupted(replay, state.audioBatchId);
    } catch (error) {
      handleError(error, {
        label: 'resumeAfterRejoin',
        logger: werewolfRuntimeLog,
        feedback: false,
      });
    }
  }, [audio, session]);

  return { readWasAudioInterrupted, resumeAfterRejoin };
}
