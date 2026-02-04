/**
 * Sound utilities for RoleRevealEffects
 *
 * Handles audio playback with graceful degradation.
 */
import { createAudioPlayer } from 'expo-audio';
import { CONFIG } from '../config';

// Audio player cache
interface AudioCache {
  tick?: ReturnType<typeof createAudioPlayer>;
  confirm?: ReturnType<typeof createAudioPlayer>;
  whoosh?: ReturnType<typeof createAudioPlayer>;
}

const audioCache: AudioCache = {};

/**
 * Sound types available
 */
export type SoundType = 'tick' | 'confirm' | 'whoosh';

/**
 * Preload audio files for faster playback
 * Call this early in the app lifecycle if possible
 */
export async function preloadSounds(): Promise<void> {
  try {
    // We'll use simple audio assets
    // In a real implementation, these would be actual audio files
    // For now, we'll silently skip if assets don't exist
  } catch {
    // Silent fail - audio is optional
  }
}

/**
 * Play a sound effect with graceful degradation
 *
 * NOTE: 当前禁用音效，因为没有合适的 UI 音效文件。
 * 原来错误地使用了游戏语音（night.mp3, night_end.mp3）作为 tick/confirm 音效，
 * 导致"查看身份"时反复播放"天亮了"等语音。
 *
 * @see https://github.com/example/issue/123 添加真正的 UI 音效文件后启用
 */
export async function playSound(
  _type: SoundType,
  _volume?: number
): Promise<void> {
  // 禁用音效 - 避免错误使用游戏语音
  return;
}

/**
 * Get volume for a sound type from config
 */
function getSoundVolume(type: SoundType): number {
  switch (type) {
    case 'tick':
      return CONFIG.sound.tickVolume;
    case 'confirm':
      return CONFIG.sound.confirmVolume;
    case 'whoosh':
      return CONFIG.sound.whooshVolume;
    default:
      return 0.5;
  }
}

/**
 * Create a rhythmic tick player for roulette
 * Returns a controller object for starting/stopping
 */
export function createTickPlayer(
  enabled: boolean
): {
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

/**
 * Cleanup all cached audio players
 */
export function cleanupSounds(): void {
  Object.values(audioCache).forEach((player) => {
    try {
      player?.remove();
    } catch {
      // Ignore cleanup errors
    }
  });
}
