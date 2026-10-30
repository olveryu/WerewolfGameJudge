/**
 * 阿瓦隆第一晚播报 — 共享房间音频运行核（RoomAudioOrchestrator）的 React 薄绑定。
 *
 * 与狼人杀 useWerewolfAudioOrchestration 同形：每个 link epoch 一个核心；新 epoch 的
 * 首个 ready 快照到达时重置核心，若此时本端是房主且播报仍在进行（isAudioPlaying），
 * 则标记为「播报被打断」——重连后的设备没有音频手势，由 RoomAudioResumeDialog 的
 * 继续手势（resumeAfterRejoin）重放整批待播队列并 ack，而不是让队列订阅自动起播。
 *
 * - queue source：读 link 权威快照的 state.pendingAudioEffects（ack 后 recheck 需同步看到
 *   已清的队列，React prop 做不到）。
 * - player port：AvalonAudioPlayer.playEffect；prepareQueue 承接整批 preload（失败只告警）；
 *   stopBgm 供核心在 night_end 前停 BGM；MissingAvalonAudioError 仍 fail-fast。
 * - ack port：`avalon.audio.ack` 以 durable 命令发送，由 RoomLink 跨连接重放直到服务端裁决。
 */

import type { AudioEffect, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useEffect, useRef } from 'react';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '@/features/room/audio/RoomAudioOrchestrator';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { MissingAvalonAudioError } from '../../audio/avalonAudioRegistry';
import type { AvalonRoomSession } from '../../model/AvalonRoomSession';

const avalonAudioLog = log.extend('AvalonAudio');

interface UseAvalonAudioOrchestrationDeps {
  readonly session: AvalonRoomSession;
  readonly isHost: boolean;
  readonly audio: AvalonAudioRuntime;
}

export interface AvalonAudioOrchestration {
  /** The core's interruption mark, read fresh (not React state). */
  readonly readWasAudioInterrupted: () => boolean;
  /** Replay the pending batch after a host rejoin and ack it. */
  readonly resumeAfterRejoin: () => Promise<void>;
}

type AvalonAudioCore = RoomAudioOrchestrator<AudioEffect, AvalonState>;

function readQueueSnapshot(session: AvalonRoomSession): RoomAudioQueueSnapshot<AudioEffect> | null {
  const current = session.getSnapshot();
  if (current.phase !== 'ready') return null;
  return {
    pendingAudioEffects: current.room.state.pendingAudioEffects,
    audioBatchId: current.room.state.audioBatchId,
  };
}

export function useAvalonAudioOrchestration({
  session,
  isHost,
  audio,
}: UseAvalonAudioOrchestrationDeps): AvalonAudioOrchestration {
  const isHostRef = useRef(isHost);
  const abortedRef = useRef(false);
  const coreRef = useRef<AvalonAudioCore | null>(null);
  const epochRef = useRef<number | null>(null);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    const queueSource: RoomAudioQueueSource<AudioEffect> = {
      getSnapshot: () => readQueueSnapshot(session),
      subscribe: (listener) => session.subscribe(() => listener(readQueueSnapshot(session))),
    };
    const core = new RoomAudioOrchestrator<AudioEffect, AvalonState>({
      queueSource,
      player: {
        playEffect: (effect) => audio.playEffect(effect.audioKey, effect.isEndAudio),
        stopBgm: audio.stopBgm,
        prepareQueue: async () => {
          try {
            await audio.preload();
          } catch (error) {
            avalonAudioLog.warn('avalon audio preload failed', { error });
          }
        },
        isMissingAssetError: (error) => error instanceof MissingAvalonAudioError,
      },
      ack: {
        dispatch: (audioBatchId) =>
          session.dispatch(
            { type: 'avalon.audio.ack', audioBatchId },
            { controlledSeat: null, label: '播报确认', durable: true },
          ),
      },
      isHost: () => isHostRef.current,
      isAborted: () => abortedRef.current,
      logger: avalonAudioLog,
      onError: (error, label) =>
        avalonAudioLog.warn('avalon audio orchestration failed', { label, error }),
    });
    coreRef.current = core;
    abortedRef.current = false;

    // Per epoch, once the first ready snapshot arrives: reset the core and mark
    // a reconnecting host mid-narration as interrupted, so the resume gate —
    // not the queue subscription — replays the batch.
    const syncEpoch = () => {
      const snapshot = session.getSnapshot();
      if (snapshot.phase !== 'ready' || epochRef.current === snapshot.epoch) return;
      epochRef.current = snapshot.epoch;
      core.reset();
      core.setWasAudioInterrupted(isHostRef.current && snapshot.room.state.isAudioPlaying);
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

  // The interrupted batch is still the authoritative pending queue (unacked),
  // so the replay is the queue itself, in order.
  const resumeAfterRejoin = useCallback(async (): Promise<void> => {
    const core = coreRef.current;
    const snapshot = session.getSnapshot();
    if (core === null || snapshot.phase !== 'ready') return;
    const state = snapshot.room.state;
    if (!state.isAudioPlaying) {
      core.setWasAudioInterrupted(false);
      return;
    }
    const batch = state.pendingAudioEffects;
    const replay = async () => {
      avalonAudioLog.info('Replaying pending narration after rejoin', {
        audioBatchId: state.audioBatchId,
        count: batch.length,
      });
      for (const effect of batch) await audio.playEffect(effect.audioKey, effect.isEndAudio);
    };
    try {
      await core.resumeInterrupted(replay, state.audioBatchId);
    } catch (error) {
      handleError(error, { label: 'resumeAfterRejoin', logger: avalonAudioLog, feedback: false });
    }
  }, [audio, session]);

  return { readWasAudioInterrupted, resumeAfterRejoin };
}
