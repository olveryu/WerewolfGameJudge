/**
 * 阿瓦隆第一晚播报 — 共享房间音频运行核（RoomAudioOrchestrator）的 React 薄绑定。
 *
 * 生命周期（队列身份识别、顺序播放、prepared envelope ack、三层连接恢复、
 * 重连整队重播、ack 后 recheck 链式续播）已搬入共享核心
 * （src/features/room/audio/RoomAudioOrchestrator），全平台只此一份。本 hook
 * 只做适配，不再自维护 ack/重试/去重逻辑：
 * - queue source：直接读 session 权威快照（连接状态 + state.pendingAudioEffects）。
 *   必须读快照而非 React prop：ack 提交后 session 先应用新快照再返回结果，
 *   核心的 ack 后 recheck 只有读快照才能同步看到已清的队列（读 prop 会因
 *   重渲染滞后而重播已确认的队列）。session 非 ready 或播放器未就绪时
 *   快照为 null（核心静默）。
 * - player port：AvalonAudioPlayer 的 playEffect；prepareQueue 承接原队列
 *   播放前的整批 preload（失败只告警、不阻塞播放，与原行为一致）；
 *   MissingAvalonAudioError 仍是 fail-fast。
 * - ack port：session.prepare/dispatchPrepared 制 `avalon.audio.ack`，
 *   envelope 由核心保留至终局决定（服务端按 commandId 幂等）。
 *
 * 入参 pendingAudioEffects 与快照里的同一字段是同一个数组（调用方
 * useAvalonRoomState 正是从快照取出后传入），保留在签名上供调用方表达
 * 队列输入；绑定本身以快照为准。
 *
 * 与原自维护实现的口径变化（按狼人杀基准，对齐方案 E3 §4）：队列已播完但
 * ack 未确认时，重连不再只重试 ack——核心按队列仍在权威状态中为准，整队
 * 重播后再 ack，避免播放被打断时未播完的播报被 ack 清掉。
 */

import type {
  AudioEffect,
  AvalonPublicCommand,
  AvalonState,
} from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef } from 'react';

import {
  RoomAudioOrchestrator,
  type RoomAudioQueueSnapshot,
  type RoomAudioQueueSource,
} from '@/features/room/audio/RoomAudioOrchestrator';
import type { PreparedRoomCommand } from '@/features/room/session/types';
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

type AvalonAudioCore = RoomAudioOrchestrator<
  AudioEffect,
  PreparedRoomCommand<AvalonPublicCommand>,
  AvalonState
>;

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
        pendingAudioEffects: current.snapshot.state.pendingAudioEffects,
        connection: current.connection,
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
      coreRef.current = new RoomAudioOrchestrator<
        AudioEffect,
        PreparedRoomCommand<AvalonPublicCommand>,
        AvalonState
      >({
        queueSource,
        player: {
          playEffect: (effect) => {
            const player = audioRef.current;
            if (player === null) {
              throw new Error('[FAIL-FAST] Avalon audio playback requires a ready audio runtime');
            }
            return player.playEffect(effect.audioKey, effect.isEndAudio);
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
          prepare: () => sessionRef.current.prepare({ type: 'avalon.audio.ack' }, null),
          dispatch: (prepared) => sessionRef.current.dispatchPrepared(prepared, '播报确认'),
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

  // Unmount: stop the lifecycle (timers, subscriptions, retained ack) and
  // stop any in-flight narration, mirroring the previous hook's cleanup.
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
