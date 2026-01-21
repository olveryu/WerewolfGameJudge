/**
 * Audio - 音频服务
 *
 * 职责：
 * - 角色音频播放
 * - 夜晚开始/结束音频
 * - 播放状态管理
 *
 * 不做的事：
 * - 业务逻辑
 * - 游戏流程控制
 * - 状态管理
 */

import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import type { RoleId } from '../../../models/roles';
import { audioLog } from '../../../utils/logger';

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum time to wait for audio playback completion before auto-resolving.
 * This prevents the night flow from getting stuck if audio fails to play or
 * the completion event is never fired (e.g., Web autoplay blocked, app backgrounded).
 */
const AUDIO_TIMEOUT_MS = 15000;

const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

// Audio file mappings matching Flutter's JudgeAudioProvider
const AUDIO_FILES: Partial<Record<RoleId, ReturnType<typeof require>>> = {
  slacker: require('../../../../assets/audio/slacker.mp3'),
  wolfRobot: require('../../../../assets/audio/wolf_robot.mp3'),
  magician: require('../../../../assets/audio/magician.mp3'),
  dreamcatcher: require('../../../../assets/audio/dreamcatcher.mp3'),
  gargoyle: require('../../../../assets/audio/gargoyle.mp3'),
  nightmare: require('../../../../assets/audio/nightmare.mp3'),
  guard: require('../../../../assets/audio/guard.mp3'),
  wolf: require('../../../../assets/audio/wolf.mp3'),
  wolfQueen: require('../../../../assets/audio/wolf_queen.mp3'),
  witch: require('../../../../assets/audio/witch.mp3'),
  seer: require('../../../../assets/audio/seer.mp3'),
  psychic: require('../../../../assets/audio/psychic.mp3'),
  hunter: require('../../../../assets/audio/hunter.mp3'),
  darkWolfKing: require('../../../../assets/audio/dark_wolf_king.mp3'),
};

const AUDIO_END_FILES: Partial<Record<RoleId, ReturnType<typeof require>>> = {
  slacker: require('../../../../assets/audio_end/slacker.mp3'),
  wolfRobot: require('../../../../assets/audio_end/wolf_robot.mp3'),
  magician: require('../../../../assets/audio_end/magician.mp3'),
  dreamcatcher: require('../../../../assets/audio_end/dreamcatcher.mp3'),
  gargoyle: require('../../../../assets/audio_end/gargoyle.mp3'),
  nightmare: require('../../../../assets/audio_end/nightmare.mp3'),
  guard: require('../../../../assets/audio_end/guard.mp3'),
  wolf: require('../../../../assets/audio_end/wolf.mp3'),
  wolfQueen: require('../../../../assets/audio_end/wolf_queen.mp3'),
  witch: require('../../../../assets/audio_end/witch.mp3'),
  seer: require('../../../../assets/audio_end/seer.mp3'),
  psychic: require('../../../../assets/audio_end/psychic.mp3'),
  hunter: require('../../../../assets/audio_end/hunter.mp3'),
  darkWolfKing: require('../../../../assets/audio_end/dark_wolf_king.mp3'),
};

// Night audio
const NIGHT_AUDIO = require('../../../../assets/audio/night.mp3');
const NIGHT_END_AUDIO = require('../../../../assets/audio/night_end.mp3');

// =============================================================================
// Audio Implementation
// =============================================================================

export class Audio {
  private static instance: Audio;
  private static initPromise: Promise<void> | null = null;
  private player: AudioPlayer | null = null;
  private _isPlaying = false;

  private constructor() {
    // Constructor does not call async methods
  }

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  static getInstance(): Audio {
    if (!Audio.instance) {
      Audio.instance = new Audio();
      // Initialize audio asynchronously outside constructor
      Audio.initPromise = Audio.instance.initAudio();
    }
    return Audio.instance;
  }

  /** Reset singleton for testing */
  static resetInstance(): void {
    Audio.instance = undefined as unknown as Audio;
    Audio.initPromise = null;
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private async initAudio(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
      });
    } catch (error) {
      audioLog.error('Failed to initialize audio:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private stopCurrentPlayer(): void {
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // Ignore errors when stopping
      }
      this.player = null;
      this._isPlaying = false;
    }
  }

  /**
   * Safe wrapper for audio playback that guarantees resolution.
   * This is the outermost fallback layer - it catches all possible errors
   * from player creation, loading, playback, and listener callbacks.
   *
   * Guarantees:
   * - Always returns a Promise that resolves (never rejects)
   * - Resolves on: normal completion, timeout, or any error
   * - Logs warnings on fallback scenarios for debugging
   */
  private async safePlayAudioFile(
    audioFile: ReturnType<typeof require>,
  ): Promise<void> {
    try {
      this.stopCurrentPlayer();

      const player = createAudioPlayer(audioFile);
      this.player = player;
      this._isPlaying = true;

      return new Promise<void>((resolve) => {
        let resolved = false;

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          this._isPlaying = false;
          try {
            subscription?.remove();
            player?.remove();
          } catch {
            // Ignore cleanup errors
          }
          this.player = null;
          resolve();
        };

        // Timeout fallback - resolve after max time even if audio didn't finish
        const timeoutId = setTimeout(() => {
          // In Jest we frequently don't get a real "didJustFinish" event from mocks.
          // Keep the fallback, but avoid noisy test output.
          if (isJest) {
            audioLog.debug(' Playback timeout - proceeding without waiting for completion');
          } else {
            audioLog.warn(' Playback timeout - proceeding without waiting for completion');
          }
          cleanup();
        }, AUDIO_TIMEOUT_MS);

        const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          try {
            // Warn if duration is 0 (possible invalid audio), but let timeout handle it
            if (status.isLoaded && status.duration === 0) {
              audioLog.warn(' Audio duration is 0 - may be invalid, waiting for timeout fallback');
            }
            if (status.didJustFinish) {
              clearTimeout(timeoutId);
              cleanup();
            }
          } catch {
            // Listener callback error - cleanup and resolve
            audioLog.warn(' Error in playback status listener - resolving');
            clearTimeout(timeoutId);
            cleanup();
          }
        });

        player.play();
      });
    } catch (error) {
      // Catch any error from createAudioPlayer, addListener, play, etc.
      audioLog.warn(' Audio playback failed, resolving anyway:', error);
      this._isPlaying = false;
      // Explicitly resolve - do not throw (return from async function resolves)
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Night Audio
  // ---------------------------------------------------------------------------

  /** Play night start audio (天黑请闭眼) */
  async playNightBegin(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_AUDIO);
  }

  /** Play night end audio (天亮了) */
  async playNightEnd(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_END_AUDIO);
  }

  // ---------------------------------------------------------------------------
  // Role Audio
  // ---------------------------------------------------------------------------

  /** Play role's beginning audio (when role's turn starts) */
  async playRoleBegin(role: RoleId): Promise<void> {
    const audioFile = AUDIO_FILES[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      return;
    }
    return this.safePlayAudioFile(audioFile);
  }

  /** Play role's ending audio (when role's turn ends) */
  async playRoleEnd(role: RoleId): Promise<void> {
    const audioFile = AUDIO_END_FILES[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      return;
    }
    return this.safePlayAudioFile(audioFile);
  }

  // ---------------------------------------------------------------------------
  // Control
  // ---------------------------------------------------------------------------

  /** Stop all audio playback */
  stop(): void {
    this.stopCurrentPlayer();
  }

  /** Check if audio is currently playing */
  isPlaying(): boolean {
    return this._isPlaying;
  }

  /** Cleanup resources */
  cleanup(): void {
    this.stopCurrentPlayer();
  }
}

export default Audio;
