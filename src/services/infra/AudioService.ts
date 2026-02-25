import * as Sentry from '@sentry/react-native';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { audioLog } from '@/utils/logger';

import {
  AUDIO_REGISTRY,
  NIGHT_AUDIO,
  NIGHT_END_AUDIO,
  SEER_LABEL_AUDIO,
  SEER_LABEL_AUDIO_END,
} from './audio/audioRegistry';
import { BgmPlayer } from './audio/BgmPlayer';
import { NativeAudioStrategy } from './audio/NativeAudioStrategy';
import type { AudioAsset, AudioPlaybackStrategy } from './audio/types';
import { WebAudioStrategy } from './audio/WebAudioStrategy';

// Re-export for backward compatibility (consumers import from AudioService)
export { _AUDIO_END_ROLE_IDS, _AUDIO_ROLE_IDS } from './audio/audioRegistry';
export type { AudioAsset } from './audio/types';
export { audioAssetToUrl } from './audio/types';

const isWeb = Platform.OS === 'web';

/**
 * AudioService — audio playback engine (composition root).
 *
 * Delegates platform-specific TTS playback to `AudioPlaybackStrategy`
 * (WebAudioStrategy / NativeAudioStrategy) and BGM lifecycle to `BgmPlayer`.
 * Provides the same public API surface consumed by GameFacade / gameActions.
 * Does not decide "when to play what" — that's declared by Handlers and
 * orchestrated by Facade.
 */
export class AudioService {
  readonly #strategy: AudioPlaybackStrategy;
  readonly #bgm: BgmPlayer;
  #visibilityHandler: (() => void) | null = null;

  constructor() {
    this.#strategy = isWeb ? new WebAudioStrategy() : new NativeAudioStrategy();
    this.#bgm = new BgmPlayer();
    // Fire-and-forget: initializes audio mode + Web visibility handler
    void this.#initAudio();
  }

  async #initAudio(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false, // Stop when app goes to background
        interruptionMode: 'duckOthers',
      });

      // Web: Listen for visibility change to pause/resume audio
      if (typeof document !== 'undefined') {
        this.#visibilityHandler = () => {
          if (document.hidden) {
            audioLog.debug('[visibility] page hidden, pausing all audio');
            this.#strategy.pause();
            this.#bgm.pause();
          } else {
            audioLog.debug('[visibility] page visible, resuming audio');
            this.#strategy.resume();
            this.#bgm.resume();
          }
        };
        document.addEventListener('visibilitychange', this.#visibilityHandler);
      }
    } catch (error) {
      audioLog.error('Failed to initialize audio:', error);
      Sentry.captureException(error);
    }
  }

  // ============ Night audio ============

  async playNightAudio(): Promise<void> {
    return this.#strategy.play(NIGHT_AUDIO, 'night');
  }

  async playNightBeginAudio(): Promise<void> {
    return this.#strategy.play(NIGHT_AUDIO, 'night');
  }

  async playNightEndAudio(): Promise<void> {
    return this.#strategy.play(NIGHT_END_AUDIO, 'night_end');
  }

  // ============ Role audio ============

  async playRoleBeginningAudio(role: string): Promise<void> {
    const entry = AUDIO_REGISTRY[role as RoleId];
    const audioFile = entry?.begin ?? SEER_LABEL_AUDIO[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      audioLog.debug(`playRoleBeginningAudio: no audio file for role "${role}", skipping`);
      return;
    }
    audioLog.debug(`playRoleBeginningAudio: playing audio for role "${role}"`);
    return this.#strategy.play(audioFile, `role_begin_${role}`);
  }

  async playRoleEndingAudio(role: string): Promise<void> {
    const entry = AUDIO_REGISTRY[role as RoleId];
    const audioFile = entry?.end ?? SEER_LABEL_AUDIO_END[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      audioLog.debug(`playRoleEndingAudio: no audio file for role "${role}", skipping`);
      return;
    }
    audioLog.debug(`playRoleEndingAudio: playing audio for role "${role}"`);
    return this.#strategy.play(audioFile, `role_end_${role}`);
  }

  getBeginningAudio(role: RoleId): AudioAsset | null {
    return AUDIO_REGISTRY[role]?.begin ?? null;
  }

  getEndingAudio(role: RoleId): AudioAsset | null {
    return AUDIO_REGISTRY[role]?.end ?? null;
  }

  // ============ Playback control ============

  stop(): void {
    this.#strategy.stop();
  }

  getIsPlaying(): boolean {
    return this.#strategy.getIsPlaying();
  }

  cleanup(): void {
    audioLog.debug('cleanup: stopping all audio');
    this.#strategy.cleanup();
    this.#bgm.stop();
    // Remove visibilitychange listener if registered (web only)
    if (this.#visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
  }

  // ============ BGM ============

  async startBgm(): Promise<void> {
    return this.#bgm.start();
  }

  stopBgm(): void {
    this.#bgm.stop();
  }

  // ============ Preload ============

  /**
   * Preload audio files for the given roles to eliminate first-play decode latency.
   *
   * Fire-and-forget: failures are silently logged and do not affect gameplay.
   * Call this when entering night phase so audio is ready before the first role's turn.
   */
  async preloadForRoles(roles: RoleId[]): Promise<void> {
    audioLog.debug('preloadForRoles: starting', { roles });

    const filesToPreload: Array<{ key: string; file: AudioAsset }> = [
      { key: 'night', file: NIGHT_AUDIO },
      { key: 'night_end', file: NIGHT_END_AUDIO },
    ];

    for (const role of roles) {
      const entry = AUDIO_REGISTRY[role];
      if (entry) {
        filesToPreload.push({ key: `begin_${role}`, file: entry.begin });
        filesToPreload.push({ key: `end_${role}`, file: entry.end });
      }
    }

    const promises = filesToPreload.map(({ key, file }) =>
      this.#strategy.preloadFile(key, file).catch((err) => {
        audioLog.warn(`preloadForRoles: failed to preload ${key}`, err);
      }),
    );

    await Promise.all(promises);
    audioLog.debug('preloadForRoles: done', { count: filesToPreload.length });
  }

  clearPreloaded(): void {
    this.#strategy.clearPreloaded();
  }
}
