/**
 * Audio subsystem types — shared by all audio modules.
 *
 * Defines playback adapter contracts and conversion helpers. Product-owned asset
 * value types live in features/product/model/AudioClip.
 */

import type { AudioAsset } from '@/features/product/model/AudioClip';

/** Resolve an AudioAsset to a URL string. */
export function audioAssetToUrl(asset: AudioAsset): string {
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'number') return String(asset);
  return asset.uri;
}

/**
 * Maximum time to wait for native audio playback completion before auto-resolving.
 *
 * Native-only safety net: expo-audio on buggy Android firmware may never fire
 * `didJustFinish`. Web uses a separate bounded load deadline before relying on
 * `onended` once data is fully buffered.
 */
export const NATIVE_AUDIO_TIMEOUT_MS = 15000;

/** Maximum time to buffer Web narration before reporting a load failure. */
export const WEB_AUDIO_LOAD_TIMEOUT_MS = 15000;

/**
 * Platform-specific audio playback strategy.
 *
 * Implementors handle play / stop / preload using their platform's audio API
 * (HTML Audio on Web, expo-audio on Native). `AudioService` selects the
 * appropriate strategy at construction time and delegates all IO through it.
 */
export interface AudioPlaybackStrategy {
  /** Play `asset` and settle when playback completes, is cancelled, or fails. */
  play(asset: AudioAsset, label: string): Promise<void>;
  /** Stop current playback and settle any pending promise. */
  stop(): void;
  /** Whether audio is currently playing. */
  getIsPlaying(): boolean;
  /** Pause current playback (for visibility change). */
  pause(): void;
  /** Resume playback if it was active before pause. */
  resume(): void;
  /** Preload a single audio file for faster first-play. */
  preloadFile(key: string, asset: AudioAsset): Promise<void>;
  /** Set playback volume (0.0–1.0). Applied to current and future playback. */
  setVolume(volume: number): void;
  /** Release all preloaded audio resources. */
  clearPreloaded(): void;
  /** Release all resources (players, listeners, preloaded cache). */
  cleanup(): void;
}
