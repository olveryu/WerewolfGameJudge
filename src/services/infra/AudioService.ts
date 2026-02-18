import type { RoleId } from '@werewolf/game-engine/models/roles';
import { AudioPlayer, AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { audioLog } from '@/utils/logger';

/**
 * Maximum time to wait for audio playback completion before auto-resolving.
 * This prevents the night flow from getting stuck if audio fails to play or
 * the completion event is never fired (e.g., Web autoplay blocked, app backgrounded).
 */
const AUDIO_TIMEOUT_MS = 15000;

const isWeb = Platform.OS === 'web';

const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

/**
 * Metro bundler `require()` returns a number (asset ID) on native,
 * a string URL on Web. expo-audio also accepts { uri: string }.
 */
type AudioAsset = number | string | { uri: string };

export function audioAssetToUrl(audioFile: number | string | { uri: string }): string {
  if (typeof audioFile === 'string') return audioFile;
  if (typeof audioFile === 'number') return String(audioFile);
  return audioFile.uri;
}

// Audio file mappings matching Flutter's JudgeAudioProvider
const AUDIO_FILES: Partial<Record<RoleId, AudioAsset>> = {
  slacker: require('../../../assets/audio/slacker.mp3'),
  wolfRobot: require('../../../assets/audio/wolf_robot.mp3'),
  magician: require('../../../assets/audio/magician.mp3'),
  dreamcatcher: require('../../../assets/audio/dreamcatcher.mp3'),
  gargoyle: require('../../../assets/audio/gargoyle.mp3'),
  nightmare: require('../../../assets/audio/nightmare.mp3'),
  guard: require('../../../assets/audio/guard.mp3'),
  wolf: require('../../../assets/audio/wolf.mp3'),
  wolfQueen: require('../../../assets/audio/wolf_queen.mp3'),
  witch: require('../../../assets/audio/witch.mp3'),
  seer: require('../../../assets/audio/seer.mp3'),
  psychic: require('../../../assets/audio/psychic.mp3'),
  hunter: require('../../../assets/audio/hunter.mp3'),
  darkWolfKing: require('../../../assets/audio/dark_wolf_king.mp3'),
};

const AUDIO_END_FILES: Partial<Record<RoleId, AudioAsset>> = {
  slacker: require('../../../assets/audio_end/slacker.mp3'),
  wolfRobot: require('../../../assets/audio_end/wolf_robot.mp3'),
  magician: require('../../../assets/audio_end/magician.mp3'),
  dreamcatcher: require('../../../assets/audio_end/dreamcatcher.mp3'),
  gargoyle: require('../../../assets/audio_end/gargoyle.mp3'),
  nightmare: require('../../../assets/audio_end/nightmare.mp3'),
  guard: require('../../../assets/audio_end/guard.mp3'),
  wolf: require('../../../assets/audio_end/wolf.mp3'),
  wolfQueen: require('../../../assets/audio_end/wolf_queen.mp3'),
  witch: require('../../../assets/audio_end/witch.mp3'),
  seer: require('../../../assets/audio_end/seer.mp3'),
  psychic: require('../../../assets/audio_end/psychic.mp3'),
  hunter: require('../../../assets/audio_end/hunter.mp3'),
  darkWolfKing: require('../../../assets/audio_end/dark_wolf_king.mp3'),
};

// Night audio
const NIGHT_AUDIO: AudioAsset = require('../../../assets/audio/night.mp3');
const NIGHT_END_AUDIO: AudioAsset = require('../../../assets/audio/night_end.mp3');

/**
 * Exported for contract testing — verifies audio coverage of NIGHT_STEPS.
 * @internal Do not use outside __tests__/.
 */
export const _AUDIO_ROLE_IDS: readonly RoleId[] = Object.keys(AUDIO_FILES) as RoleId[];
export const _AUDIO_END_ROLE_IDS: readonly RoleId[] = Object.keys(AUDIO_END_FILES) as RoleId[];

// Background music
const BGM_NIGHT: AudioAsset = require('../../../assets/audio/bgm_night.mp3');

/** BGM volume (0.0 to 1.0) - keep low so TTS narration is clearly audible */
const BGM_VOLUME = 0.08;

/**
 * AudioService - 音频播放引擎
 *
 * 职责：
 * - 管理角色语音 TTS 播放（play / stop / 超时兜底）
 * - 管理夜晚 BGM 播放（start / stop / fade）
 * - 提供 playAndWait() 接口供 Facade 编排音频时序
 *
 * ✅ 允许：音频播放 IO（expo-audio API）+ 超时/错误处理
 * ❌ 禁止：决定"何时播什么音频"（由 Handler 声明、Facade 编排）
 * ❌ 禁止：游戏逻辑 / 状态修改
 */
export class AudioService {
  private player: AudioPlayer | null = null;
  private playerSubscription: ReturnType<AudioPlayer['addListener']> | null = null;
  private bgmPlayer: AudioPlayer | null = null;
  private isPlaying = false;
  private isBgmPlaying = false;
  // Resolve function for current playback - called when audio finishes or times out
  private currentPlaybackResolve: (() => void) | null = null;
  private currentTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private wasPlayingBeforeHidden = false;
  private wasBgmPlayingBeforeHidden = false;

  // Web-only: Single HTML Audio element that we reuse (iOS Safari requires this)
  private webAudioElement: HTMLAudioElement | null = null;
  private webBgmElement: HTMLAudioElement | null = null;

  // Preload cache: keeps pre-decoded audio players alive to skip first-play decode latency
  private preloadedPlayers: Map<string, AudioPlayer> = new Map();
  private preloadedWebAudios: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    // Fire-and-forget: initializes audio mode + Web visibility handler
    void this.initAudio();
  }

  private async initAudio(): Promise<void> {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false, // Stop when app goes to background
        interruptionMode: 'duckOthers',
      });

      // Web: Listen for visibility change to pause/resume audio when browser goes to background
      if (typeof document !== 'undefined') {
        this.visibilityHandler = () => {
          if (document.hidden) {
            // Page hidden - pause all audio
            audioLog.debug('[visibility] page hidden, pausing all audio');
            this.wasPlayingBeforeHidden = this.isPlaying;
            this.wasBgmPlayingBeforeHidden = this.isBgmPlaying;

            if (this.player) {
              try {
                this.player.pause();
              } catch (e) {
                audioLog.warn('[visibility] error pausing player', e);
              }
            }
            if (this.webBgmElement) {
              try {
                this.webBgmElement.pause();
              } catch (e) {
                audioLog.warn('[visibility] error pausing web bgm', e);
              }
            } else if (this.bgmPlayer) {
              try {
                this.bgmPlayer.pause();
              } catch (e) {
                audioLog.warn('[visibility] error pausing bgm', e);
              }
            }
          } else {
            // Page visible again - resume audio if it was playing before
            audioLog.debug(
              `[visibility] page visible, wasPlaying=${this.wasPlayingBeforeHidden}, wasBgmPlaying=${this.wasBgmPlayingBeforeHidden}`,
            );

            if (this.wasPlayingBeforeHidden && this.player) {
              try {
                this.player.play();
                audioLog.debug('[visibility] resumed main audio');
              } catch (e) {
                audioLog.warn('[visibility] error resuming player', e);
              }
            }
            if (this.wasBgmPlayingBeforeHidden) {
              if (this.webBgmElement) {
                try {
                  this.webBgmElement.play();
                  audioLog.debug('[visibility] resumed web BGM');
                } catch (e) {
                  audioLog.warn('[visibility] error resuming web bgm', e);
                }
              } else if (this.bgmPlayer) {
                try {
                  this.bgmPlayer.play();
                  audioLog.debug('[visibility] resumed BGM');
                } catch (e) {
                  audioLog.warn('[visibility] error resuming bgm', e);
                }
              }
            }
          }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);
      }
    } catch (error) {
      audioLog.error('Failed to initialize audio:', error);
    }
  }

  private stopCurrentPlayer(): void {
    // Cancel any pending playback
    if (this.currentPlaybackResolve) {
      audioLog.debug('[stopCurrentPlayer] resolving pending playback');
      this.currentPlaybackResolve();
      this.currentPlaybackResolve = null;
    }
    if (this.currentTimeoutId) {
      clearTimeout(this.currentTimeoutId);
      this.currentTimeoutId = null;
    }
    // Just pause, don't remove - we want to reuse the player for iOS Safari
    if (this.player) {
      audioLog.debug('stopCurrentPlayer: pausing current player (keeping for reuse)');
      try {
        this.player.pause();
      } catch (e) {
        audioLog.warn('stopCurrentPlayer: error pausing player', e);
      }
      this.isPlaying = false;
    } else {
      audioLog.debug('stopCurrentPlayer: no player to stop');
    }
  }

  /**
   * Safe wrapper for audio playback that guarantees resolution.
   *
   * iOS Safari fix: On Web, use a single reusable HTML Audio element.
   * The key insight is that iOS Safari allows an Audio element created
   * during a user gesture to play multiple times by changing its src.
   *
   * Guarantees:
   * - Always returns a Promise that resolves (never rejects)
   * - Resolves on: normal completion, timeout, or any error
   * - Logs warnings on fallback scenarios for debugging
   */
  private async safePlayAudioFile(audioFile: AudioAsset, label = 'audio'): Promise<void> {
    audioLog.debug(`[${label}] safePlayAudioFile START`);

    // On Web, use native HTML Audio API for iOS Safari compatibility
    if (isWeb && typeof document !== 'undefined') {
      return this.safePlayAudioFileWeb(audioFile, label);
    }

    // Native platforms: use expo-audio
    return this.safePlayAudioFileNative(audioFile, label);
  }

  /**
   * Web-specific audio playback using HTML Audio element.
   * Reuses a single Audio element to maintain iOS Safari user gesture authorization.
   */
  private async safePlayAudioFileWeb(audioFile: AudioAsset, label = 'audio'): Promise<void> {
    audioLog.debug(`[${label}] [WEB] starting playback`);

    return new Promise<void>((resolve) => {
      try {
        // Stop any current playback
        if (this.webAudioElement) {
          this.webAudioElement.pause();
          this.webAudioElement.onended = null;
          this.webAudioElement.onerror = null;
        }
        if (this.currentTimeoutId) {
          clearTimeout(this.currentTimeoutId);
          this.currentTimeoutId = null;
        }

        // Get the audio URL from the audioFile (expo asset)
        const audioUrl = audioAssetToUrl(audioFile);
        audioLog.debug(`[${label}] [WEB] audioUrl=${audioUrl}`);

        // Create or reuse Audio element
        if (this.webAudioElement) {
          audioLog.debug(`[${label}] [WEB] reusing existing Audio element`);
        } else {
          audioLog.debug(`[${label}] [WEB] creating new Audio element`);
          this.webAudioElement = new Audio();
        }

        const audio = this.webAudioElement;
        this.isPlaying = true;

        // Set up event handlers
        audio.onended = () => {
          audioLog.debug(`[${label}] [WEB] onended fired`);
          this.isPlaying = false;
          if (this.currentTimeoutId) {
            clearTimeout(this.currentTimeoutId);
            this.currentTimeoutId = null;
          }
          resolve();
        };

        audio.onerror = () => {
          audioLog.warn(`[WEB] Audio error for ${label}`);
          this.isPlaying = false;
          if (this.currentTimeoutId) {
            clearTimeout(this.currentTimeoutId);
            this.currentTimeoutId = null;
          }
          resolve(); // Resolve anyway to not block the flow
        };

        // Timeout fallback
        this.currentTimeoutId = setTimeout(() => {
          audioLog.warn(`[WEB] Playback timeout for ${label}`);
          this.isPlaying = false;
          audio.pause();
          resolve();
        }, AUDIO_TIMEOUT_MS);

        // Set source and play
        audio.src = audioUrl;
        audioLog.debug(`[${label}] [WEB] calling audio.play()`);

        audio
          .play()
          .then(() => {
            audioLog.debug(`[${label}] [WEB] play() promise resolved`);
          })
          .catch((err) => {
            audioLog.warn(`[WEB] play() failed for ${label}:`, err);
            this.isPlaying = false;
            if (this.currentTimeoutId) {
              clearTimeout(this.currentTimeoutId);
              this.currentTimeoutId = null;
            }
            resolve(); // Resolve anyway
          });
      } catch (error) {
        audioLog.warn(`[WEB] Audio playback failed for ${label}:`, error);
        this.isPlaying = false;
        resolve();
      }
    });
  }

  /**
   * Native platform audio playback using expo-audio.
   */
  private async safePlayAudioFileNative(audioFile: AudioAsset, label = 'audio'): Promise<void> {
    try {
      // Stop any current playback but keep old player alive (just paused)
      this.stopCurrentPlayer();

      // Remove old listener if exists
      if (this.playerSubscription) {
        try {
          this.playerSubscription.remove();
        } catch {
          // Ignore
        }
        this.playerSubscription = null;
      }

      // iOS Safari fix: Always create a new player for each audio file.
      // Don't remove() the old player - just pause it and let it exist.
      // This seems to work better than replace() which doesn't fire events.
      audioLog.debug(`[${label}] creating player and starting playback`);
      const player = createAudioPlayer(audioFile);
      // Keep reference to old player (don't remove it), just replace reference
      this.player = player;
      audioLog.debug(`[${label}] player created OK`);

      // Add listener for the new player
      this.playerSubscription = player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          this.handlePlaybackStatus(status);
        },
      );
      audioLog.debug(`[${label}] listener added`);

      this.isPlaying = true;

      return new Promise<void>((resolve) => {
        // Store resolve function so status handler can call it
        this.currentPlaybackResolve = resolve;
        this.currentLabel = label;
        this.currentStatusCount = 0;

        // Timeout fallback - resolve after max time even if audio didn't finish
        this.currentTimeoutId = setTimeout(() => {
          audioLog.debug(
            `[${label}] TIMEOUT after ${AUDIO_TIMEOUT_MS}ms, statusCount=${this.currentStatusCount}`,
          );
          if (isJest) {
            audioLog.debug(' Playback timeout - proceeding without waiting for completion');
          } else {
            audioLog.warn(' Playback timeout - proceeding without waiting for completion');
          }
          this.finishCurrentPlayback();
        }, AUDIO_TIMEOUT_MS);

        audioLog.debug(`[${label}] calling player.play()`);
        player.play();
        audioLog.debug(`[${label}] player.play() returned`);
      });
    } catch (error) {
      audioLog.warn(`[${label}] Audio playback failed, resolving anyway:`, error);
      this.isPlaying = false;
      return;
    }
  }

  // Shared state for current playback
  private currentLabel = 'audio';
  private currentStatusCount = 0;

  private handlePlaybackStatus(status: AudioStatus): void {
    this.currentStatusCount++;
    const label = this.currentLabel;
    audioLog.debug(
      `[${label}] status #${this.currentStatusCount}: playing=${status.playing} loaded=${status.isLoaded} duration=${status.duration} didJustFinish=${status.didJustFinish}`,
    );

    try {
      if (status.isLoaded && status.duration === 0) {
        audioLog.warn(' Audio duration is 0 - may be invalid, waiting for timeout fallback');
      }
      if (status.didJustFinish) {
        audioLog.debug(`[${label}] didJustFinish=true, calling finishCurrentPlayback`);
        this.finishCurrentPlayback();
      }
    } catch {
      audioLog.warn(' Error in playback status listener - resolving');
      this.finishCurrentPlayback();
    }
  }

  private finishCurrentPlayback(): void {
    if (this.currentTimeoutId) {
      clearTimeout(this.currentTimeoutId);
      this.currentTimeoutId = null;
    }
    this.isPlaying = false;
    if (this.currentPlaybackResolve) {
      audioLog.debug(
        `[${this.currentLabel}] finishCurrentPlayback called, statusCount=${this.currentStatusCount}`,
      );
      this.currentPlaybackResolve();
      this.currentPlaybackResolve = null;
    }
  }

  // Play night start audio
  async playNightAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_AUDIO, 'night');
  }

  // Alias for playNightAudio
  async playNightBeginAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_AUDIO, 'night');
  }

  // Play night end audio
  async playNightEndAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_END_AUDIO, 'night_end');
  }

  // Play role beginning audio (when role's turn starts)
  async playRoleBeginningAudio(role: RoleId): Promise<void> {
    const audioFile = AUDIO_FILES[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      audioLog.debug(`playRoleBeginningAudio: no audio file for role "${role}", skipping`);
      return;
    }
    audioLog.debug(`playRoleBeginningAudio: playing audio for role "${role}"`);
    return this.safePlayAudioFile(audioFile, `role_begin_${role}`);
  }

  // Play role ending audio (when role's turn ends)
  async playRoleEndingAudio(role: RoleId): Promise<void> {
    const audioFile = AUDIO_END_FILES[role];
    if (!audioFile) {
      // Normal case: some roles (e.g. villager) intentionally have no narration.
      audioLog.debug(`playRoleEndingAudio: no audio file for role "${role}", skipping`);
      return;
    }
    audioLog.debug(`playRoleEndingAudio: playing audio for role "${role}"`);
    return this.safePlayAudioFile(audioFile, `role_end_${role}`);
  }

  // Get beginning audio for role
  getBeginningAudio(role: RoleId): AudioAsset | null {
    return AUDIO_FILES[role] ?? null;
  }

  // Get ending audio for role
  getEndingAudio(role: RoleId): AudioAsset | null {
    return AUDIO_END_FILES[role] ?? null;
  }

  // Stop all audio (not BGM)
  stop(): void {
    this.stopCurrentPlayer();
  }

  // Check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Clean up all audio including BGM
  cleanup(): void {
    audioLog.debug('cleanup: stopping all audio');
    this.stopCurrentPlayer();
    this.stopBgm();
    // Remove visibilitychange listener if registered (web only)
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // ============ BGM Methods ============

  /**
   * Start playing background music in a loop.
   * Does nothing if BGM is already playing.
   */
  async startBgm(): Promise<void> {
    if (this.isBgmPlaying || this.bgmPlayer || this.webBgmElement) {
      audioLog.debug('BGM already playing, skipping');
      return; // Already playing
    }

    try {
      audioLog.debug('Starting BGM...');

      // Web: use HTML Audio for stable volume control across loop iterations
      if (isWeb && typeof document !== 'undefined') {
        const audioUrl = audioAssetToUrl(BGM_NIGHT);
        const audio = new Audio(audioUrl);
        audio.volume = BGM_VOLUME;
        audio.loop = true;
        this.webBgmElement = audio;
        this.isBgmPlaying = true;
        audio.play();
        audioLog.debug('BGM started successfully (Web HTML Audio)');
        return;
      }

      // Native: use expo-audio player
      const player = createAudioPlayer(BGM_NIGHT);
      this.bgmPlayer = player;
      this.isBgmPlaying = true;

      // Set volume lower so TTS is audible
      player.volume = BGM_VOLUME;

      // Loop BGM
      player.loop = true;

      player.play();
      audioLog.debug('BGM started successfully');
    } catch (error) {
      audioLog.warn('Failed to start BGM:', error);
      this.isBgmPlaying = false;
      this.bgmPlayer = null;
      this.webBgmElement = null;
    }
  }

  /**
   * Stop background music.
   */
  stopBgm(): void {
    if (this.webBgmElement) {
      try {
        this.webBgmElement.pause();
        this.webBgmElement.src = '';
      } catch {
        // Ignore errors
      }
      this.webBgmElement = null;
      this.isBgmPlaying = false;
      audioLog.debug('BGM stopped (Web)');
    }
    if (this.bgmPlayer) {
      try {
        this.bgmPlayer.pause();
        this.bgmPlayer.remove();
      } catch {
        // Ignore errors
      }
      this.bgmPlayer = null;
      this.isBgmPlaying = false;
      audioLog.debug('BGM stopped');
    }
  }

  /**
   * Check if BGM is currently playing.
   */
  getIsBgmPlaying(): boolean {
    return this.isBgmPlaying;
  }

  // ============ Preload Methods ============

  /**
   * Preload audio files for the given roles to eliminate first-play decode latency.
   *
   * Fire-and-forget: failures are silently logged and do not affect gameplay.
   * Call this when entering night phase (e.g., startNight) so audio is ready
   * before the first role's turn.
   *
   * Preloads:
   * - NIGHT_AUDIO + NIGHT_END_AUDIO (always)
   * - AUDIO_FILES[role] + AUDIO_END_FILES[role] for each role in the template
   */
  async preloadForRoles(roles: RoleId[]): Promise<void> {
    audioLog.debug('preloadForRoles: starting', { roles });

    // Collect all audio files to preload
    const filesToPreload: Array<{ key: string; file: AudioAsset }> = [
      { key: 'night', file: NIGHT_AUDIO },
      { key: 'night_end', file: NIGHT_END_AUDIO },
    ];

    for (const role of roles) {
      const beginFile = AUDIO_FILES[role];
      if (beginFile) {
        filesToPreload.push({ key: `begin_${role}`, file: beginFile });
      }
      const endFile = AUDIO_END_FILES[role];
      if (endFile) {
        filesToPreload.push({ key: `end_${role}`, file: endFile });
      }
    }

    const promises = filesToPreload.map(({ key, file }) =>
      this.preloadSingleFile(key, file).catch((err) => {
        audioLog.warn(`preloadForRoles: failed to preload ${key}`, err);
      }),
    );

    await Promise.all(promises);
    audioLog.debug('preloadForRoles: done', { count: filesToPreload.length });
  }

  private async preloadSingleFile(key: string, audioFile: AudioAsset): Promise<void> {
    if (isWeb && typeof document !== 'undefined') {
      // Web: create an Audio element, set preload='auto' to trigger decode
      if (this.preloadedWebAudios.has(key)) return;
      const audioUrl = audioAssetToUrl(audioFile);
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = audioUrl;
      // Load but don't play
      audio.load();
      this.preloadedWebAudios.set(key, audio);
    } else if (!isJest) {
      // Native: create a player to pre-decode the audio asset
      if (this.preloadedPlayers.has(key)) return;
      const player = createAudioPlayer(audioFile);
      this.preloadedPlayers.set(key, player);
    }
  }

  /**
   * Clear all preloaded audio (call on restartGame / leaveRoom to free memory).
   */
  clearPreloaded(): void {
    for (const player of this.preloadedPlayers.values()) {
      try {
        player.remove();
      } catch {
        // ignore
      }
    }
    this.preloadedPlayers.clear();

    // Web: just clear references, browser GC handles the rest
    this.preloadedWebAudios.clear();

    audioLog.debug('clearPreloaded: all preloaded audio released');
  }
}
