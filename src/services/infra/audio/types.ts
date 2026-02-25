/**
 * Audio subsystem types — shared by all audio modules.
 *
 * Exports immutable value types and the playback strategy contract.
 * Contains zero platform-specific code and zero side effects.
 */

/**
 * Metro bundler `require()` returns a number (asset ID) on native,
 * a string URL on Web. expo-audio also accepts { uri: string }.
 */
export type AudioAsset = number | string | { uri: string };

/** Resolve an AudioAsset to a URL string. */
export function audioAssetToUrl(asset: AudioAsset): string {
  if (typeof asset === 'string') return asset;
  if (typeof asset === 'number') return String(asset);
  return asset.uri;
}

/**
 * Maximum time to wait for audio playback completion before auto-resolving.
 * Prevents the night flow from getting stuck if audio fails or events never fire
 * (e.g., Web autoplay blocked, app backgrounded).
 */
export const AUDIO_TIMEOUT_MS = 15000;

/**
 * Platform-specific audio playback strategy.
 *
 * Implementors handle play / stop / preload using their platform's audio API
 * (HTML Audio on Web, expo-audio on Native). `AudioService` selects the
 * appropriate strategy at construction time and delegates all IO through it.
 */
export interface AudioPlaybackStrategy {
  /** Play `asset` and resolve when playback completes (or errors / times out). */
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
  /** Release all preloaded audio resources. */
  clearPreloaded(): void;
  /** Release all resources (players, listeners, preloaded cache). */
  cleanup(): void;
}
