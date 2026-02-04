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
 */
export async function playSound(
  type: SoundType,
  volume?: number
): Promise<void> {
  try {
    // Get volume from config if not specified
    const soundVolume = volume ?? getSoundVolume(type);

    // For now, we'll create a simple beep-like effect using the existing audio
    // In production, you'd have proper sound files
    const soundAssets: Record<SoundType, number> = {
      tick: require('../../../../assets/audio/night.mp3'),
      confirm: require('../../../../assets/audio/night_end.mp3'),
      whoosh: require('../../../../assets/audio/bgm_night.mp3'),
    };

    const asset = soundAssets[type];
    if (!asset) return;

    const player = createAudioPlayer(asset);
    player.volume = soundVolume;
    player.play();

    // Clean up after a short delay
    setTimeout(() => {
      try {
        player.remove();
      } catch {
        // Ignore cleanup errors
      }
    }, 1000);
  } catch {
    // Silent fail - audio is optional
  }
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
