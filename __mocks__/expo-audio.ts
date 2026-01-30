/**
 * Mock for expo-audio module
 * Used by Jest via moduleNameMapper
 */

// Mock AudioPlayer instance
const createMockPlayer = () => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  remove: jest.fn(),
  seekTo: jest.fn(),
  setVolume: jest.fn(),
  currentTime: 0,
  duration: 1000,
  playing: false,
  muted: false,
  shouldCorrectPitch: true,
  currentStatus: { isLoaded: true, didJustFinish: false },
  volume: 1,
  loop: false,
  addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
});

// Top-level exports matching expo-audio API
export const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);

export const createAudioPlayer = jest.fn().mockImplementation(() => createMockPlayer());

export const useAudioPlayer = jest.fn().mockReturnValue({
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  isPlaying: false,
  isLoaded: true,
});

// Audio namespace (expo-audio SDK 52+ API)
export const Audio = {
  Sound: {
    createAsync: jest.fn().mockResolvedValue({
      sound: {
        playAsync: jest.fn().mockResolvedValue(undefined),
        unloadAsync: jest.fn().mockResolvedValue(undefined),
        setOnPlaybackStatusUpdate: jest.fn(),
        getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, didJustFinish: false }),
      },
      status: { isLoaded: true },
    }),
  },
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
};

export default { Audio, setAudioModeAsync, createAudioPlayer, useAudioPlayer };
