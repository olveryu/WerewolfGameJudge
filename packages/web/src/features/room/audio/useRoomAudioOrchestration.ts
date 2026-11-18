/**
 * useRoomAudioOrchestration — the shared room audio core (`RoomAudioOrchestrator`) bound to a
 * ready room session, as a hook. One core per mounted room.
 *
 * Games supply playback and acknowledgement ports, never phase predicates or replay queues.
 * The authoritative audio slice controls both normal playback and gesture-based recovery.
 *
 * Rejoin mark: the room mounts only on a ready link (`RoomEntryBoundary`), and a link epoch change
 * re-enters the room, so the first snapshot this hook sees tells whether the host arrived
 * mid-narration. A host mounting with an active batch is marked interrupted — the page has no audio
 * gesture after a reconnect — and the queue subscription stays silent until `resumeAfterRejoin`
 * (the resume-gate gesture) replays the complete authoritative batch under the core's
 * re-entry guard, acks the interrupted batch by id and chains on.
 */

import type { AudioEffect, AudioQueueSlice } from '@game-judge/game-engine/platform/audio';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { DispatchOutcome, RoomLink } from '@/platform/realtime/types';
import { handleError } from '@/utils/errorPipeline';
import type { Logger } from '@/utils/logger';

import {
  RoomAudioOrchestrator,
  type RoomAudioPlayerPort,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from './RoomAudioOrchestrator';

/**
 * The game's ports. All of them must be stable identities (module-level functions and constants,
 * the room's audio runtime instance): a change rebinds the core.
 */
interface RoomAudioOrchestrationOptions<
  TState extends BaseGameState<string> & AudioQueueSlice,
  TCommand extends object,
> {
  readonly session: RoomLink<TState, TCommand>;
  readonly isHost: boolean;
  readonly player: RoomAudioPlayerPort<AudioEffect> & { readonly stopNarration: () => void };
  /** The game's durable audio ack for one batch. */
  readonly ackCommand: (audioBatchId: number) => TCommand;
  readonly ackLabel: string;
  /** The game's named runtime logger (also the error-pipeline logger). */
  readonly logger: Logger;
}

export interface RoomAudioOrchestration {
  /** Reactive recovery signal for re-entry and playback failure, not connection-status changes. */
  readonly isResumeRequired: boolean;
  /** Retry the authoritative batch and acknowledge it only after every cue completes. */
  readonly resumeAfterRejoin: () => Promise<void>;
}

export function useRoomAudioOrchestration<
  TState extends BaseGameState<string> & AudioQueueSlice,
  TCommand extends object,
>({
  session,
  isHost,
  player,
  ackCommand,
  ackLabel,
  logger,
}: RoomAudioOrchestrationOptions<TState, TCommand>): RoomAudioOrchestration {
  const isHostRef = useRef(isHost);
  const coreRef = useRef<RoomAudioOrchestrator<AudioEffect, TState> | null>(null);
  const listenersRef = useRef(new Set<() => void>());
  const notifyResumeChange = useCallback(() => {
    for (const listener of listenersRef.current) listener();
  }, []);
  const subscribe = useCallback(
    (listener: () => void) => {
      listenersRef.current.add(listener);
      const unsubscribe = session.subscribe(listener);
      return () => {
        listenersRef.current.delete(listener);
        unsubscribe();
      };
    },
    [session],
  );
  const readResumeRequired = useCallback(() => {
    const snapshot = session.getSnapshot();
    return (
      isHost &&
      snapshot.phase === 'ready' &&
      snapshot.room.state.isAudioPlaying &&
      coreRef.current?.needsResume === true
    );
  }, [isHost, session]);
  const isResumeRequired = useSyncExternalStore(subscribe, readResumeRequired);
  const reportPlaybackError = useCallback(
    (error: unknown, label: string) => {
      handleError(error, {
        label,
        logger,
        feedback: 'toast',
        alertMessage: '播报失败，游戏未推进。请点击「继续游戏」重试。',
      });
    },
    [logger],
  );

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const snapshot = session.getSnapshot();
    if (snapshot.phase !== 'ready') {
      throw new Error('[FAIL-FAST] Room audio orchestration mounted without a ready session');
    }
    const readQueueSnapshot = (): RoomAudioQueueSnapshot<AudioEffect> | null => {
      const current = session.getSnapshot();
      if (current.phase !== 'ready') return null;
      return {
        pendingAudioEffects: current.room.state.pendingAudioEffects,
        isAudioPlaying: current.room.state.isAudioPlaying,
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
      roomCode: snapshot.identity.room.roomCode,
      logger,
      onError: reportPlaybackError,
      onResumeRequiredChange: notifyResumeChange,
    });
    coreRef.current = core;
    core.setNeedsResume(isHostRef.current && snapshot.room.state.isAudioPlaying);
    notifyResumeChange();

    return () => {
      core.dispose();
      coreRef.current = null;
      player.stopNarration();
    };
  }, [ackCommand, ackLabel, logger, notifyResumeChange, player, reportPlaybackError, session]);

  const resumeAfterRejoin = useCallback(async (): Promise<void> => {
    const core = coreRef.current;
    if (core === null) {
      logger.info('Narration resume ignored after room teardown');
      return;
    }
    try {
      await core.resumeInterrupted();
    } catch (error) {
      reportPlaybackError(error, '恢复语音播报');
    }
  }, [logger, reportPlaybackError]);

  return { isResumeRequired, resumeAfterRejoin };
}
