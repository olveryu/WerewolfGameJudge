import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { RoleName } from '../models/roles';

/**
 * Maximum time to wait for audio playback completion before auto-resolving.
 * This prevents the night flow from getting stuck if audio fails to play or
 * the completion event is never fired (e.g., Web autoplay blocked, app backgrounded).
 */
const AUDIO_TIMEOUT_MS = 15000;

const isJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

// Audio file mappings matching Flutter's JudgeAudioProvider
const AUDIO_FILES: Partial<Record<RoleName, any>> = {
  slacker: require('../../assets/audio/slacker.mp3'),
  wolfRobot: require('../../assets/audio/wolf_robot.mp3'),
  magician: require('../../assets/audio/magician.mp3'),
  dreamcatcher: require('../../assets/audio/dreamcatcher.mp3'),
  gargoyle: require('../../assets/audio/gargoyle.mp3'),
  nightmare: require('../../assets/audio/nightmare.mp3'),
  guard: require('../../assets/audio/guard.mp3'),
  wolf: require('../../assets/audio/wolf.mp3'),
  wolfQueen: require('../../assets/audio/wolf_queen.mp3'),
  witch: require('../../assets/audio/witch.mp3'),
  seer: require('../../assets/audio/seer.mp3'),
  psychic: require('../../assets/audio/psychic.mp3'),
  hunter: require('../../assets/audio/hunter.mp3'),
  darkWolfKing: require('../../assets/audio/dark_wolf_king.mp3'),
};

const AUDIO_END_FILES: Partial<Record<RoleName, any>> = {
  slacker: require('../../assets/audio_end/slacker.mp3'),
  wolfRobot: require('../../assets/audio_end/wolf_robot.mp3'),
  magician: require('../../assets/audio_end/magician.mp3'),
  dreamcatcher: require('../../assets/audio_end/dreamcatcher.mp3'),
  gargoyle: require('../../assets/audio_end/gargoyle.mp3'),
  nightmare: require('../../assets/audio_end/nightmare.mp3'),
  guard: require('../../assets/audio_end/guard.mp3'),
  wolf: require('../../assets/audio_end/wolf.mp3'),
  wolfQueen: require('../../assets/audio_end/wolf_queen.mp3'),
  witch: require('../../assets/audio_end/witch.mp3'),
  seer: require('../../assets/audio_end/seer.mp3'),
  psychic: require('../../assets/audio_end/psychic.mp3'),
  hunter: require('../../assets/audio_end/hunter.mp3'),
  darkWolfKing: require('../../assets/audio_end/dark_wolf_king.mp3'),
};

// Night audio
const NIGHT_AUDIO = require('../../assets/audio/night.mp3');
const NIGHT_END_AUDIO = require('../../assets/audio/night_end.mp3');

class AudioService {
  private static instance: AudioService;
  private static initPromise: Promise<void> | null = null;
  private player: AudioPlayer | null = null;
  private isPlaying = false;

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
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private stopCurrentPlayer(): void {
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // Ignore errors when stopping
      }
      this.player = null;
      this.isPlaying = false;
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
  private async safePlayAudioFile(audioFile: any): Promise<void> {
    try {
      this.stopCurrentPlayer();

      const player = createAudioPlayer(audioFile);
      this.player = player;
      this.isPlaying = true;

      return new Promise<void>((resolve) => {
        let resolved = false;

        const cleanup = () => {
          if (resolved) return;
          resolved = true;
          this.isPlaying = false;
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
            console.debug('[AudioService] Playback timeout - proceeding without waiting for completion');
          } else {
            console.warn('[AudioService] Playback timeout - proceeding without waiting for completion');
          }
          cleanup();
        }, AUDIO_TIMEOUT_MS);

        const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          try {
            // Warn if duration is 0 (possible invalid audio), but let timeout handle it
            if (status.isLoaded && status.duration === 0) {
              console.warn('[AudioService] Audio duration is 0 - may be invalid, waiting for timeout fallback');
            }
            if (status.didJustFinish) {
              clearTimeout(timeoutId);
              cleanup();
            }
          } catch {
            // Listener callback error - cleanup and resolve
            console.warn('[AudioService] Error in playback status listener - resolving');
            clearTimeout(timeoutId);
            cleanup();
          }
        });

        player.play();
      });
    } catch (error) {
      // Catch any error from createAudioPlayer, addListener, play, etc.
      console.warn('[AudioService] Audio playback failed, resolving anyway:', error);
      this.isPlaying = false;
      // Explicitly resolve - do not throw (return from async function resolves)
      return;
    }
  }

  /**
   * @deprecated Use safePlayAudioFile instead. Kept for reference.
   */
  private async playAudioFile(audioFile: any): Promise<void> {
    return this.safePlayAudioFile(audioFile);
  }

  // Play night start audio
  async playNightAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_AUDIO);
  }

  // Alias for playNightAudio
  async playNightBeginAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_AUDIO);
  }

  // Play night end audio
  async playNightEndAudio(): Promise<void> {
    return this.safePlayAudioFile(NIGHT_END_AUDIO);
  }

  // Play role beginning audio (when role's turn starts)
  async playRoleBeginningAudio(role: RoleName): Promise<void> {
    const audioFile = AUDIO_FILES[role];
    if (!audioFile) {
  // Normal case: some roles (e.g. villager) intentionally have no narration.
      return;
    }
    return this.safePlayAudioFile(audioFile);
  }

  // Play role ending audio (when role's turn ends)
  async playRoleEndingAudio(role: RoleName): Promise<void> {
    const audioFile = AUDIO_END_FILES[role];
    if (!audioFile) {
  // Normal case: some roles (e.g. villager) intentionally have no narration.
      return;
    }
    return this.safePlayAudioFile(audioFile);
  }

  // Get beginning audio for role
  getBeginningAudio(role: RoleName): number | null {
    return AUDIO_FILES[role] ?? null;
  }

  // Get ending audio for role
  getEndingAudio(role: RoleName): number | null {
    return AUDIO_END_FILES[role] ?? null;
  }

  // Stop all audio
  stop(): void {
    this.stopCurrentPlayer();
  }

  // Check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Clean up
  cleanup(): void {
    this.stopCurrentPlayer();
  }
}

export default AudioService;
