import { Audio, AVPlaybackStatus } from 'expo-av';
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
  private sound: Audio.Sound | null = null;
  private isPlaying = false;

  private constructor() {
    this.initAudio();
  }

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private async initAudio(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private async stopCurrentSound(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch {
        // Ignore errors when stopping
      }
      this.sound = null;
      this.isPlaying = false;
    }
  }

  private async playAudioFile(audioFile: any): Promise<void> {
    await this.stopCurrentSound();

    try {
      const { sound } = await Audio.Sound.createAsync(audioFile);
      this.sound = sound;
      this.isPlaying = true;

      // Return a promise that resolves when playback finishes
      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            this.isPlaying = false;
            resolve();
          }
        });

        sound.playAsync().catch((error) => {
          console.error('Failed to play audio:', error);
          this.isPlaying = false;
          resolve();
        });
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
  getBeginningAudio(role: RoleName): any | null {
    return AUDIO_FILES[role] || null;
  }

  // Get ending audio for role
  getEndingAudio(role: RoleName): any | null {
    return AUDIO_END_FILES[role] || null;
  }

  // Stop all audio
  async stop(): Promise<void> {
    await this.stopCurrentSound();
  }

  // Check if audio is currently playing
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  // Clean up
  async cleanup(): Promise<void> {
    await this.stopCurrentSound();
  }
}

export default AudioService;
