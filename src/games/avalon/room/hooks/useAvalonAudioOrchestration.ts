/**
 * 阿瓦隆第一晚播报 orchestration — 对齐狼人杀 WerewolfAudioOrchestrator（简化版）。
 *
 * 职责：监听 state.pendingAudioEffects，非空且为房主时按序播放，播完提交
 * `avalon.audio.ack`。非房主静默忽略。
 *
 * 与狼人杀的差异（产品差异，保留）：
 * - 无 BGM 联动：阿瓦隆无 BGM；无 ack 后链式续播。
 *
 * ack 可靠性（AU-33，对齐狼人杀核心）：ack 命令预制备一次，同一
 * envelope 复用至确认或终局拒绝（服务端按 commandId 幂等）；ack 未
 * 确认时，会话重连（connection 回到 live）即重试同一命令，不重播整队。
 * 保留：重入 guard、单段失败跳过继续、空队列不 ack。
 */

import type { AvalonAudioEffect, AvalonCommand } from '@game-judge/game-engine/games/avalon/public';
import { useCallback, useEffect, useRef } from 'react';

import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { PreparedRoomCommand } from '@/features/room/session/types';
import { log } from '@/utils/logger';

import type { AvalonAudioRuntime } from '../../audio/AvalonAudioPlayer';
import { MissingAvalonAudioError } from '../../audio/avalonAudioRegistry';
import type { AvalonRoomSession } from '../../model/AvalonRoomSession';

const avalonAudioLog = log.extend('AvalonAudio');

interface UseAvalonAudioOrchestrationDeps {
  readonly session: AvalonRoomSession;
  readonly isHost: boolean;
  readonly pendingAudioEffects: readonly AvalonAudioEffect[];
  readonly audio: AvalonAudioRuntime | null;
}

export function useAvalonAudioOrchestration({
  session,
  isHost,
  pendingAudioEffects,
  audio,
}: UseAvalonAudioOrchestrationDeps): void {
  const isPlayingRef = useRef(false);
  const lastQueuedRef = useRef<string | null>(null);
  const ackedRef = useRef<string | null>(null);
  const pendingAckRef = useRef<{
    queueKey: string;
    prepared: PreparedRoomCommand<AvalonCommand>;
  } | null>(null);
  const queueKeyRef = useRef<string | null>(null);

  /**
   * Send the ack for a queue through one prepared envelope, reused
   * across retries until the server commits or terminally rejects it.
   * Never throws: failures stay pending for the next retry trigger
   * (effect re-run or reconnect).
   */
  const sendAck = useCallback(
    async (queueKey: string): Promise<void> => {
      try {
        let pending = pendingAckRef.current;
        if (pending === null || pending.queueKey !== queueKey) {
          pending = {
            queueKey,
            prepared: session.prepare({ type: 'avalon.audio.ack' }, null),
          };
          pendingAckRef.current = pending;
        }
        const outcome = await session.dispatchPrepared(pending.prepared, '播报确认');
        if (isSuccessfulRoomCommand(outcome)) {
          ackedRef.current = queueKey;
          if (pendingAckRef.current?.queueKey === queueKey) pendingAckRef.current = null;
          return;
        }
        if (outcome.kind === 'decided') {
          // Terminal rejection: the state has moved on; stop retrying
          // this queue instead of resending a decided command forever.
          avalonAudioLog.warn('avalon audio ack rejected; dropping pending ack', { queueKey });
          ackedRef.current = queueKey;
          if (pendingAckRef.current?.queueKey === queueKey) pendingAckRef.current = null;
          return;
        }
        avalonAudioLog.warn('avalon audio ack undecided; will retry', {
          queueKey,
          outcomeKind: outcome.kind,
        });
      } catch (error) {
        avalonAudioLog.warn('avalon audio ack failed; will retry', { error });
      }
    },
    [session],
  );

  // Reconnect (L2): a pending ack retries as soon as the session is
  // live again, with the same prepared envelope - no queue replay.
  useEffect(() => {
    let wasLive = session.getSnapshot().connection === 'live';
    return session.subscribe(() => {
      const snapshot = session.getSnapshot();
      const isLive = snapshot.connection === 'live';
      const reconnected = isLive && !wasLive;
      wasLive = isLive;
      if (!reconnected || snapshot.phase !== 'ready') return;
      const pending = pendingAckRef.current;
      if (pending !== null && pending.queueKey === queueKeyRef.current) {
        void sendAck(pending.queueKey);
      }
    });
  }, [session, sendAck]);

  useEffect(() => {
    if (pendingAudioEffects.length === 0) {
      pendingAckRef.current = null;
      queueKeyRef.current = null;
      return;
    }
    if (!isHost || audio === null) return;
    // 同一批队列只播一次（state 未变时 effect 重跑不重复播）。
    const queueKey = pendingAudioEffects
      .map((e) => `${e.audioKey}:${e.isEndAudio === true ? 'end' : 'begin'}`)
      .join('|');
    queueKeyRef.current = queueKey;
    if (isPlayingRef.current || lastQueuedRef.current === queueKey) {
      // 队列已播完但 ack 失败时，只重试 ack，不重播（QA Bug 4）。
      if (lastQueuedRef.current === queueKey && ackedRef.current !== queueKey) {
        void sendAck(queueKey);
      }
      return;
    }
    isPlayingRef.current = true;
    lastQueuedRef.current = queueKey;

    let cancelled = false;
    const playQueue = async () => {
      try {
        // 先预加载全部 8 段，避免播放时卡顿（对齐狼人杀 startNight 后 preload）。
        await audio.preload().catch((error: unknown) => {
          avalonAudioLog.warn('avalon audio preload failed', { error });
        });
        for (const effect of pendingAudioEffects) {
          if (cancelled) break;
          try {
            await audio.playEffect(effect.audioKey, effect.isEndAudio);
          } catch (error) {
            // Registry 缺失是编程错误，fail-fast 不吞（对齐狼人杀）。
            if (error instanceof MissingAvalonAudioError) throw error;
            // 单段播放失败不阻塞队列（对齐狼人杀）。
            avalonAudioLog.warn('avalon audio effect failed, skipping', {
              audioKey: effect.audioKey,
              error,
            });
          }
        }
      } finally {
        isPlayingRef.current = false;
      }
      if (cancelled) return;
      // 播完（或全部跳过）后 ack，释放服务端门控。ack 未确认时
      // lastQueuedRef 不重置，后续 effect 重跑或重连会用同一预制备
      // 命令重试 ack（不重播，AU-33）。
      await sendAck(queueKey);
    };

    void playQueue();

    // Unmount 或队列变化时停止播放（QA Bug 5）。
    return () => {
      cancelled = true;
      audio.stopNarration();
    };
  }, [session, isHost, pendingAudioEffects, audio, sendAck]);
}
