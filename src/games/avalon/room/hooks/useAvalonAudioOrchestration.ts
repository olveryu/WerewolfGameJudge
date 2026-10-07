/**
 * 阿瓦隆第一晚播报 orchestration — 对齐狼人杀 WerewolfAudioOrchestrator（简化版）。
 *
 * 职责：监听 state.pendingAudioEffects，非空且为房主时按序播放，播完提交
 * `avalon.audio.ack`。非房主静默忽略。
 *
 * 简化点（vs 狼人杀 523 行版）：
 * - 断线重连：若 ack 已成功，队列已清空不重播；若 ack 未发出，重连后会重播当前队列（ack 成功前队列保留）。
 * - 无 BGM 联动：阿瓦隆无 BGM。
 * - 保留：重入 guard、单段失败跳过继续、空队列不 ack。
 */

import type { AvalonAudioEffect } from '@game-judge/game-engine/games/avalon/public';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!isHost || audio === null || pendingAudioEffects.length === 0) return;
    // 同一批队列只播一次（state 未变时 effect 重跑不重复播）。
    const queueKey = pendingAudioEffects
      .map((e) => `${e.audioKey}:${e.isEndAudio === true ? 'end' : 'begin'}`)
      .join('|');
    if (isPlayingRef.current || lastQueuedRef.current === queueKey) {
      // 队列已播完但 ack 失败时，只重试 ack，不重播（QA Bug 4）。
      if (lastQueuedRef.current === queueKey && ackedRef.current !== queueKey) {
        void session
          .dispatch({ type: 'avalon.audio.ack' }, { controlledSeat: null, label: '播报确认' })
          .then(() => {
            ackedRef.current = queueKey;
          })
          .catch((error: unknown) => {
            avalonAudioLog.warn('avalon audio ack retry failed', { error });
          });
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
      // 播完（或全部跳过）后 ack，释放服务端门控。
      try {
        await session.dispatch(
          { type: 'avalon.audio.ack' },
          { controlledSeat: null, label: '播报确认' },
        );
        ackedRef.current = queueKey;
      } catch (error) {
        avalonAudioLog.warn('avalon audio ack failed', { error });
        // ack 失败不重置 lastQueuedRef，下次 effect 重跑时只重试 ack（QA Bug 4）。
      }
    };

    void playQueue();

    // Unmount 或队列变化时停止播放（QA Bug 5）。
    return () => {
      cancelled = true;
      audio.stopNarration();
    };
  }, [session, isHost, pendingAudioEffects, audio]);
}
