/**
 * 秘密希特勒播报 — 共享房间音频运行核（RoomAudioOrchestrator）的 React 薄绑定。
 *
 * 生命周期（队列识别、顺序播放、durable ack、ack 后 recheck 链式续播）已搬入共享核心
 * （packages/web/src/features/room/audio/RoomAudioOrchestrator），全平台只此一份。本 hook 只做适配：
 * - queue source：直接读 link 权威快照的 state.pendingAudioEffects。必须读快照而非 React
 *   prop：ack 提交后 link 先应用新快照再返回结果，核心的 ack 后 recheck 只有读快照才能同步
 *   看到已清的队列。link 非 ready 时快照为 null（核心静默）。
 * - player port：本游戏音频运行时（SecrethitlerAudioRuntime）的 playEffect；
 *   stopBgm 供核心在 night_end 播报前停 BGM（天亮时序，全游戏统一）；
 *   本游戏模块注入 player，prepareQueue 在每批播报前预加载固定的 MP3 资源清单。
 * - ack port：`secrethitler.audio.ack` 以 durable 命令发送，由 RoomLink 跨连接重放直到服务端裁决。
 */

import type {
  AudioEffect,
  SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { useEffect, useRef } from 'react';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '@/features/room/audio/RoomAudioOrchestrator';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';

import type { SecrethitlerAudioRuntime } from '../../audio/secrethitlerAudioRuntime';
import type { SecrethitlerRoomSession } from '../../model/SecrethitlerRoomSession';

const secrethitlerAudioLog = log.extend('SecrethitlerAudio');

interface UseSecrethitlerAudioOrchestrationDeps {
  readonly session: SecrethitlerRoomSession;
  readonly isHost: boolean;
  readonly audio: SecrethitlerAudioRuntime;
}

type SecrethitlerAudioCore = RoomAudioOrchestrator<AudioEffect, SecrethitlerState>;

export function useSecrethitlerAudioOrchestration(
  deps: UseSecrethitlerAudioOrchestrationDeps,
): void {
  const { session, isHost, audio } = deps;
  const sessionRef = useRef(session);
  const isHostRef = useRef(isHost);
  const audioRef = useRef(audio);
  const abortedRef = useRef(false);
  const coreRef = useRef<SecrethitlerAudioCore | null>(null);
  const listenersRef = useRef(
    new Set<(snapshot: RoomAudioQueueSnapshot<AudioEffect> | null) => void>(),
  );

  // Sync latest inputs and poke the core with the current snapshot on every
  // render: host/player changes arrive as props, queue/connection changes
  // arrive through the queue source's session forwarding below.
  useEffect(() => {
    abortedRef.current = false;
    sessionRef.current = session;
    isHostRef.current = isHost;
    audioRef.current = audio;

    const readSnapshot = (): RoomAudioQueueSnapshot<AudioEffect> | null => {
      const current = sessionRef.current.getSnapshot();
      if (current.phase !== 'ready') return null;
      return {
        pendingAudioEffects: current.room.state.pendingAudioEffects,
        audioBatchId: current.room.state.audioBatchId,
      };
    };

    if (coreRef.current === null) {
      const queueSource: RoomAudioQueueSource<AudioEffect> = {
        getSnapshot: readSnapshot,
        subscribe: (listener) => {
          listenersRef.current.add(listener);
          const unsubscribeSession = sessionRef.current.subscribe(() => listener(readSnapshot()));
          return () => {
            listenersRef.current.delete(listener);
            unsubscribeSession();
          };
        },
      };
      coreRef.current = new RoomAudioOrchestrator<AudioEffect, SecrethitlerState>({
        queueSource,
        player: {
          stopOnPlaybackError: true,
          playEffect: (effect) => audioRef.current.playEffect(effect),
          stopBgm: () => audioRef.current.stopBgm(),
          prepareQueue: () => {
            audioRef.current.preload();
            return Promise.resolve();
          },
        },
        ack: {
          dispatch: (audioBatchId) =>
            sessionRef.current.dispatch(
              { type: 'secrethitler.audio.ack', audioBatchId },
              { controlledSeat: null, label: '播报确认', durable: true },
            ),
        },
        isHost: () => isHostRef.current,
        isAborted: () => abortedRef.current,
        logger: secrethitlerAudioLog,
        onError: (error) =>
          handleError(error, {
            label: '首夜播报',
            logger: secrethitlerAudioLog,
            feedback: 'toast',
            alertMessage:
              '电子主持播报失败，首夜已暂停。请检查设备音频输出和媒体播放权限后刷新重试。',
          }),
      });
    }

    const snapshot = readSnapshot();
    for (const listener of listenersRef.current) listener(snapshot);
  });

  // Unmount: stop the lifecycle (timers, subscriptions, retained ack) and
  // stop any in-flight narration, mirroring the shipped bindings' cleanup.
  useEffect(() => {
    return () => {
      abortedRef.current = true;
      coreRef.current?.dispose();
      coreRef.current = null;
      audioRef.current.stopNarration();
    };
  }, []);
}
