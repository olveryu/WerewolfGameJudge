/**
 * 阿瓦隆第一晚播报 — 共享房间音频运行核（RoomAudioOrchestrator）的 React 薄绑定。
 *
 * 生命周期（队列识别、顺序播放、durable ack、ack 后 recheck 链式续播）已搬入共享核心
 * （src/features/room/audio/RoomAudioOrchestrator），全平台只此一份。本 hook 只做适配：
 * - queue source：直接读 link 权威快照的 state.pendingAudioEffects。必须读快照而非 React
 *   prop：ack 提交后 link 先应用新快照再返回结果，核心的 ack 后 recheck 只有读快照才能同步
 *   看到已清的队列。link 非 ready 或播放器未就绪时快照为 null（核心静默）。
 * - player port：AvalonAudioPlayer 的 playEffect；prepareQueue 承接整批 preload（失败只告警）；
 *   stopBgm 供核心在 night_end 播报前停 BGM；MissingAvalonAudioError 仍是 fail-fast。
 * - ack port：`avalon.audio.ack` 以 durable 命令发送，由 RoomLink 跨连接重放直到服务端裁决。
 *
 * 入参 pendingAudioEffects 与快照里的同一字段是同一个数组，保留在签名上供调用方表达队列输入；
 * 绑定本身以快照为准。
 */

import type { AudioEffect, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef } from 'react';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '@/features/room/audio/RoomAudioOrchestrator';
import { log } from '@/utils/logger';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { MissingAvalonAudioError } from '../../audio/avalonAudioRegistry';
import type { AvalonRoomSession } from '../../model/AvalonRoomSession';

const avalonAudioLog = log.extend('AvalonAudio');

interface UseAvalonAudioOrchestrationDeps {
  readonly session: AvalonRoomSession;
  readonly isHost: boolean;
  /** The session snapshot's queue, passed by the caller; the binding reads the authoritative queue from the session snapshot itself (see header). */
  readonly pendingAudioEffects: readonly AudioEffect[];
  readonly audio: AvalonAudioRuntime | null;
}

type AvalonAudioCore = RoomAudioOrchestrator<AudioEffect, AvalonState>;

export function useAvalonAudioOrchestration(deps: UseAvalonAudioOrchestrationDeps): void {
  const { session, isHost, audio } = deps;
  const sessionRef = useRef(session);
  const isHostRef = useRef(isHost);
  const audioRef = useRef(audio);
  const abortedRef = useRef(false);
  const coreRef = useRef<AvalonAudioCore | null>(null);
  const listenersRef = useRef(
    new Set<(snapshot: RoomAudioQueueSnapshot<AudioEffect> | null) => void>(),
  );

  // Sync latest inputs and poke the core with the current snapshot on every
  // render: host/player changes arrive as props, queue/connection changes
  // arrive through the queue source's session forwarding below.
  useEffect(() => {
    sessionRef.current = session;
    isHostRef.current = isHost;
    audioRef.current = audio;

    const readSnapshot = (): RoomAudioQueueSnapshot<AudioEffect> | null => {
      const current = sessionRef.current.getSnapshot();
      if (current.phase !== 'ready' || audioRef.current === null) return null;
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
      coreRef.current = new RoomAudioOrchestrator<AudioEffect, AvalonState>({
        queueSource,
        player: {
          playEffect: (effect) => {
            const player = audioRef.current;
            if (player === null) {
              throw new Error('[FAIL-FAST] Avalon audio playback requires a ready audio runtime');
            }
            return player.playEffect(effect.audioKey, effect.isEndAudio);
          },
          stopBgm: () => {
            const player = audioRef.current;
            if (player === null) {
              throw new Error('[FAIL-FAST] Avalon BGM stop requires a ready audio runtime');
            }
            player.stopBgm();
          },
          prepareQueue: async () => {
            const player = audioRef.current;
            if (player === null) return;
            try {
              await player.preload();
            } catch (error) {
              avalonAudioLog.warn('avalon audio preload failed', { error });
            }
          },
          isMissingAssetError: (error) => error instanceof MissingAvalonAudioError,
        },
        ack: {
          dispatch: (audioBatchId) =>
            sessionRef.current.dispatch(
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
    }

    const snapshot = readSnapshot();
    for (const listener of listenersRef.current) listener(snapshot);
  });

  // Unmount: stop the lifecycle (subscriptions) and any in-flight narration.
  useEffect(
    () => () => {
      abortedRef.current = true;
      coreRef.current?.dispose();
      coreRef.current = null;
      audioRef.current?.stopNarration();
    },
    [],
  );
}
