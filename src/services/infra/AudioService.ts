import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { Platform } from 'react-native';
import { RoleId } from '../../models/roles';
import { audioLog } from '../../utils/logger';
import { mobileDebug } from '../../utils/mobileDebug';

/**
 * Maximum time to wait for audio playback completion before auto-resolving.
 * This prevents the night flow from getting stuck if audio fails to play or
 * the completion event is never fired (e.g., Web autoplay blocked, app backgrounded).
 */
const AUDIO_TIMEOUT_MS = 15000;

const isWeb = Platform.OS === 'web';

const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

// Audio file mappings matching Flutter's JudgeAudioProvider
const AUDIO_FILES: Partial<Record<RoleId, any>> = {
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

const AUDIO_END_FILES: Partial<Record<RoleId, any>> = {
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
const NIGHT_AUDIO = require('../../../assets/audio/night.mp3');
const NIGHT_END_AUDIO = require('../../../assets/audio/night_end.mp3');

// Background music
const BGM_NIGHT = require('../../../assets/audio/bgm_night.mp3');

/** BGM volume (0.0 to 1.0) - lower so TTS narration is clearly audible */
const BGM_VOLUME = 0.15;

class AudioService {
  private static instance: AudioService;
  private static initPromise: Promise<void> | null = null;
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

  private constructor() {
    // Constructor does not call async methods
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
      // Initialize audio asynchronously outside constructor
      AudioService.initPromise = AudioService.instance.initAudio();
    }
    return AudioService.instance;
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
            mobileDebug.log('[visibility] page hidden, pausing all audio');
            this.wasPlayingBeforeHidden = this.isPlaying;
            this.wasBgmPlayingBeforeHidden = this.isBgmPlaying;

            if (this.player) {
              try {
                this.player.pause();
              } catch (e) {
                audioLog.warn('[visibility] error pausing player', e);
              }
            }
            if (this.bgmPlayer) {
              try {
                this.bgmPlayer.pause();
              } catch (e) {
                audioLog.warn('[visibility] error pausing bgm', e);
              }
            }
          } else {
            // Page visible again - resume audio if it was playing before
            mobileDebug.log(
              `[visibility] page visible, wasPlaying=${this.wasPlayingBeforeHidden}, wasBgmPlaying=${this.wasBgmPlayingBeforeHidden}`,
            );

            if (this.wasPlayingBeforeHidden && this.player) {
              try {
                this.player.play();
                mobileDebug.log('[visibility] resumed main audio');
              } catch (e) {
                audioLog.warn('[visibility] error resuming player', e);
              }
            }
            if (this.wasBgmPlayingBeforeHidden && this.bgmPlayer) {
              try {
                this.bgmPlayer.play();
                mobileDebug.log('[visibility] resumed BGM');
              } catch (e) {
                audioLog.warn('[visibility] error resuming bgm', e);
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
      mobileDebug.log('[stopCurrentPlayer] resolving pending playback');
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
  private async safePlayAudioFile(audioFile: any, label = 'audio'): Promise<void> {
    mobileDebug.log(`[${label}] safePlayAudioFile START`);

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
  private async safePlayAudioFileWeb(audioFile: any, label = 'audio'): Promise<void> {
    mobileDebug.log(`[${label}] [WEB] starting playback`);

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
        const audioUrl = typeof audioFile === 'string' ? audioFile : audioFile?.uri || audioFile;
        mobileDebug.log(`[${label}] [WEB] audioUrl=${audioUrl}`);

        // Create or reuse Audio element
        if (this.webAudioElement) {
          mobileDebug.log(`[${label}] [WEB] reusing existing Audio element`);
        } else {
          mobileDebug.log(`[${label}] [WEB] creating new Audio element`);
          this.webAudioElement = new Audio();
        }

        const audio = this.webAudioElement;
        this.isPlaying = true;

        // Set up event handlers
        audio.onended = () => {
          mobileDebug.log(`[${label}] [WEB] onended fired`);
          this.isPlaying = false;
          if (this.currentTimeoutId) {
            clearTimeout(this.currentTimeoutId);
            this.currentTimeoutId = null;
          }
          resolve();
        };

        audio.onerror = () => {
          mobileDebug.log(`[${label}] [WEB] onerror fired`);
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
          mobileDebug.log(`[${label}] [WEB] TIMEOUT after ${AUDIO_TIMEOUT_MS}ms`);
          audioLog.warn(`[WEB] Playback timeout for ${label}`);
          this.isPlaying = false;
          audio.pause();
          resolve();
        }, AUDIO_TIMEOUT_MS);

        // Set source and play
        audio.src = audioUrl;
        mobileDebug.log(`[${label}] [WEB] calling audio.play()`);

        audio
          .play()
          .then(() => {
            mobileDebug.log(`[${label}] [WEB] play() promise resolved`);
          })
          .catch((err) => {
            mobileDebug.log(`[${label}] [WEB] play() promise rejected: ${err}`);
            audioLog.warn(`[WEB] play() failed for ${label}:`, err);
            this.isPlaying = false;
            if (this.currentTimeoutId) {
              clearTimeout(this.currentTimeoutId);
              this.currentTimeoutId = null;
            }
            resolve(); // Resolve anyway
          });
      } catch (error) {
        mobileDebug.log(`[${label}] [WEB] ERROR: ${error}`);
        audioLog.warn(`[WEB] Audio playback failed for ${label}:`, error);
        this.isPlaying = false;
        resolve();
      }
    });
  }

  /**
   * Native platform audio playback using expo-audio.
   */
  private async safePlayAudioFileNative(audioFile: any, label = 'audio'): Promise<void> {
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
      mobileDebug.log(`[${label}] creating new player...`);
      audioLog.debug('safePlayAudioFile: creating player and starting playback');
      const player = createAudioPlayer(audioFile);
      // Keep reference to old player (don't remove it), just replace reference
      this.player = player;
      mobileDebug.log(`[${label}] player created OK`);

      // Add listener for the new player
      this.playerSubscription = player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          this.handlePlaybackStatus(status);
        },
      );
      mobileDebug.log(`[${label}] listener added`);

      this.isPlaying = true;

      return new Promise<void>((resolve) => {
        // Store resolve function so status handler can call it
        this.currentPlaybackResolve = resolve;
        this.currentLabel = label;
        this.currentStatusCount = 0;

        // Timeout fallback - resolve after max time even if audio didn't finish
        this.currentTimeoutId = setTimeout(() => {
          mobileDebug.log(
            `[${label}] TIMEOUT after ${AUDIO_TIMEOUT_MS}ms, statusCount=${this.currentStatusCount}`,
          );
          if (isJest) {
            audioLog.debug(' Playback timeout - proceeding without waiting for completion');
          } else {
            audioLog.warn(' Playback timeout - proceeding without waiting for completion');
          }
          this.finishCurrentPlayback();
        }, AUDIO_TIMEOUT_MS);

        mobileDebug.log(`[${label}] calling player.play()`);
        player.play();
        mobileDebug.log(`[${label}] player.play() returned`);
      });
    } catch (error) {
      mobileDebug.log(`[${label}] ERROR: ${error}`);
      audioLog.warn(' Audio playback failed, resolving anyway:', error);
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
    mobileDebug.log(
      `[${label}] status #${this.currentStatusCount}: playing=${status.playing} loaded=${status.isLoaded} duration=${status.duration} didJustFinish=${status.didJustFinish}`,
    );

    try {
      if (status.isLoaded && status.duration === 0) {
        audioLog.warn(' Audio duration is 0 - may be invalid, waiting for timeout fallback');
      }
      if (status.didJustFinish) {
        mobileDebug.log(`[${label}] didJustFinish=true, calling finishCurrentPlayback`);
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
      mobileDebug.log(
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
  getBeginningAudio(role: RoleId): number | null {
    return AUDIO_FILES[role] ?? null;
  }

  // Get ending audio for role
  getEndingAudio(role: RoleId): number | null {
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
  }

  // ============ BGM Methods ============

  /**
   * Start playing background music in a loop.
   * Does nothing if BGM is already playing.
   */
  async startBgm(): Promise<void> {
    if (this.isBgmPlaying || this.bgmPlayer) {
      audioLog.debug('BGM already playing, skipping');
      return; // Already playing
    }

    try {
      audioLog.debug('Starting BGM...');
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
    }
  }

  /**
   * Stop background music.
   */
  stopBgm(): void {
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
}

export default AudioService;
