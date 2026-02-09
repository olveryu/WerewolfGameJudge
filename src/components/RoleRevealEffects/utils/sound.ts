/**
 * sound - 揭示动画音效工具
 *
 * 管理 tick/confirm/whoosh 音效的预加载与播放，优雅降级。
 *
 * ✅ 允许：音频播放 IO
 * ❌ 禁止：import service / 游戏业务逻辑
 */
import { createAudioPlayer } from 'expo-audio';

/**
 * Sound types available
 */
export type SoundType = 'tick' | 'confirm' | 'whoosh';


/**
 * Play a sound effect with graceful degradation
 *
 * NOTE: 当前禁用音效，因为没有合适的 UI 音效文件。
 * 原来错误地使用了游戏语音（night.mp3, night_end.mp3）作为 tick/confirm 音效，
 * 导致"查看身份"时反复播放"天亮了"等语音。
 *
 * @see https://github.com/example/issue/123 添加真正的 UI 音效文件后启用
 */
export async function playSound(_type: SoundType, _volume?: number): Promise<void> {
  // 禁用音效 - 避免错误使用游戏语音
  return;
}

/**
 * Create a rhythmic tick player for roulette
 * Returns a controller object for starting/stopping
 */
export function createTickPlayer(enabled: boolean): {
  start: (intervalMs: number) => void;
  updateInterval: (intervalMs: number) => void;
  stop: () => void;
} {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentInterval = 0;

  return {
    start: (intervalMs: number) => {
      if (!enabled) return;
      currentInterval = intervalMs;
      intervalId = setInterval(() => {
        playSound('tick');
      }, intervalMs);
    },
    updateInterval: (intervalMs: number) => {
      if (!enabled || !intervalId) return;
      if (intervalMs === currentInterval) return;
      clearInterval(intervalId);
      currentInterval = intervalMs;
      intervalId = setInterval(() => {
        playSound('tick');
      }, intervalMs);
    },
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}
