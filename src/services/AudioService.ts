import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import { RoleName } from '../constants/roles';

// Audio file mappings matching Flutter's JudgeAudioProvider
const AUDIO_FILES: Partial<Record<RoleName, any>> = {
  slacker: require('../../assets/audio/slacker.mp3'),
  wolfRobot: require('../../assets/audio/wolf_robot.mp3'),
  magician: require('../../assets/audio/magician.mp3'),
  celebrity: require('../../assets/audio/celebrity.mp3'),
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
  celebrity: require('../../assets/audio_end/celebrity.mp3'),
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

  private async playAudioFile(audioFile: any): Promise<void> {
    this.stopCurrentPlayer();

    try {
      const player = createAudioPlayer(audioFile);
      this.player = player;
      this.isPlaying = true;

      // Return a promise that resolves when playback finishes
      return new Promise((resolve) => {
        const subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (status.didJustFinish) {
            this.isPlaying = false;
            subscription.remove();
            player.remove();
            this.player = null;
            resolve();
          }
        });

        player.play();
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      this.isPlaying = false;
    }
  }

  // Play night start audio
  async playNightAudio(): Promise<void> {
    await this.playAudioFile(NIGHT_AUDIO);
  }

  // Alias for playNightAudio
  async playNightBeginAudio(): Promise<void> {
    await this.playNightAudio();
  }

  // Play night end audio
  async playNightEndAudio(): Promise<void> {
    await this.playAudioFile(NIGHT_END_AUDIO);
  }

  // Play role beginning audio (when role's turn starts)
  async playRoleBeginningAudio(role: RoleName): Promise<void> {
    const audioFile = AUDIO_FILES[role];
    if (audioFile) {
      await this.playAudioFile(audioFile);
    }
  }

  // Play role ending audio (when role's turn ends)
  async playRoleEndingAudio(role: RoleName): Promise<void> {
    const audioFile = AUDIO_END_FILES[role];
    if (audioFile) {
      await this.playAudioFile(audioFile);
    }
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
