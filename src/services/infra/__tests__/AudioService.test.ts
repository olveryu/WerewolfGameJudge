// Mock logger
const mockAudioLogWarn = jest.fn();
jest.mock('../../../utils/logger', () => ({
  audioLog: {
    warn: (msg: string, ...args: unknown[]): void => {
      mockAudioLogWarn(msg, ...args);
    },
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock expo-audio
const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockRemove = jest.fn();
const mockAddListener = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: mockPlay,
    pause: mockPause,
    remove: mockRemove,
    addListener: mockAddListener,
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// Now import AudioService after mocks are set up
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { BGM_VOLUME } from '@/features/product/model/BgmCatalog';
import { audioAssetToUrl } from '@/services/infra/audio/types';
import { AudioService } from '@/services/infra/AudioService';

describe('audioAssetToUrl', () => {
  it('should passthrough string URL', () => {
    expect(audioAssetToUrl('night.mp3')).toBe('night.mp3');
  });

  it('should read uri from { uri } object', () => {
    expect(audioAssetToUrl({ uri: 'night.mp3' })).toBe('night.mp3');
  });

  it('should stringify number asset id', () => {
    expect(audioAssetToUrl(123)).toBe('123');
  });
});

describe('AudioService - Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize audio mode on construction', () => {
    new AudioService();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: false, // Stop when app goes to background
      interruptionMode: 'duckOthers',
    });
  });
});

describe('AudioService - Playback control', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();
  });

  it('should track playing state', () => {
    // Initially not playing
    expect(audioService.getIsPlaying()).toBe(false);
  });

  it('stop should not throw when no audio playing', () => {
    expect(() => audioService.stop()).not.toThrow();
  });

  it('cleanup should not throw when no audio playing', () => {
    expect(() => audioService.cleanup()).not.toThrow();
  });
});

describe('AudioService - foreground playback', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();

    // Setup mock to simulate playback completion
    mockAddListener.mockImplementation(
      (event: string, callback: (status: { didJustFinish?: boolean }) => void) => {
        // Immediately call the callback with didJustFinish to resolve the promise
        setTimeout(() => {
          callback({ didJustFinish: true });
        }, 0);
        return { remove: jest.fn() };
      },
    );
  });

  it('delegates an owning feature clip to the platform strategy', async () => {
    await audioService.playClip({ key: 'sample', asset: 'sample-audio' });

    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });
});

describe('AudioService - Stop current player', () => {
  let audioService: AudioService;

  beforeEach(() => {
    jest.useFakeTimers();
    audioService = new AudioService();
    jest.clearAllMocks();

    // Setup mock to NOT auto-complete (so we can test stop)
    mockAddListener.mockImplementation(() => {
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should stop current player when playing new audio', async () => {
    // Start playing (won't complete due to mock setup)
    void audioService.playClip({ key: 'first', asset: 'first-audio' });

    // Start another - should stop the first
    void audioService.playClip({ key: 'second', asset: 'second-audio' });

    // Second call should have paused the first player (player kept for reuse on iOS Safari)
    expect(mockPause).toHaveBeenCalled();
    // Note: remove() is no longer called - player is reused for iOS Safari compatibility
    expect(createAudioPlayer).toHaveBeenCalledTimes(2);

    // Consume pending timers to avoid open handles
    jest.advanceTimersByTime(15000);
  });
});

describe('AudioService - Fallback: createAudioPlayer throws', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    mockAudioLogWarn.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve (not reject) when createAudioPlayer throws', async () => {
    jest.mocked(createAudioPlayer).mockImplementationOnce(() => {
      throw new Error('Simulated player creation failure');
    });

    await expect(
      audioService.playClip({ key: 'sample', asset: 'sample-audio' }),
    ).resolves.toBeUndefined();

    // Should have logged a warning
    expect(mockAudioLogWarn).toHaveBeenCalledWith(
      'Audio playback failed, resolving anyway',
      expect.objectContaining({ label: 'sample' }),
      expect.any(Error),
    );
  });
});

describe('AudioService - Fallback: timeout', () => {
  let audioService: AudioService;

  beforeEach(() => {
    jest.useFakeTimers();
    audioService = new AudioService();
    mockAudioLogWarn.mockClear();

    // Mock player that never fires didJustFinish
    mockAddListener.mockImplementation(() => {
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should resolve after timeout if didJustFinish never fires', async () => {
    const playPromise = audioService.playClip({ key: 'sample', asset: 'sample-audio' });

    // Fast-forward past the timeout (15 seconds)
    jest.advanceTimersByTime(15000);

    await expect(playPromise).resolves.toBeUndefined();

    // The important contract: it must resolve (not hang). Logging is optional.
    // We don't assert on logging here as timeout logging may be debug-level.
  });
});

// =============================================================================
// BGM Methods
// =============================================================================

describe('AudioService - BGM (native path)', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();
  });

  it('startBgm should create player with loop and low volume', async () => {
    const mockPlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      volume: 1,
      loop: false,
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    };
    jest.mocked(createAudioPlayer).mockReturnValueOnce(mockPlayer as never);

    await audioService.startBgm(['test-asset']);

    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlayer.volume).toBe(BGM_VOLUME);
    expect(mockPlayer.loop).toBe(true);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('startBgm should be idempotent (skip if already playing)', async () => {
    const mockPlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      volume: 1,
      loop: false,
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    };
    jest.mocked(createAudioPlayer).mockReturnValue(mockPlayer as never);

    await audioService.startBgm(['test-asset']);
    jest.mocked(createAudioPlayer).mockClear();

    // Second call should be no-op
    await audioService.startBgm(['test-asset']);
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });

  it('startBgm should swallow errors and not throw', async () => {
    jest.mocked(createAudioPlayer).mockImplementationOnce(() => {
      throw new Error('player creation failed');
    });

    await expect(audioService.startBgm(['test-asset'])).resolves.toBeUndefined();
  });

  it('stopBgm should pause and remove bgm player', async () => {
    const mockPlayer = {
      play: jest.fn(),
      pause: mockPause,
      remove: mockRemove,
      volume: 1,
      loop: false,
      addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    };
    jest.mocked(createAudioPlayer).mockReturnValueOnce(mockPlayer as never);

    await audioService.startBgm(['test-asset']);
    jest.clearAllMocks();

    audioService.stopBgm();

    expect(mockPause).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('stopBgm should be safe when no bgm playing', () => {
    expect(() => audioService.stopBgm()).not.toThrow();
  });
});

// =============================================================================
// Preload Methods
// =============================================================================

describe('AudioService - preloadClips (native)', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();
  });

  it('preloads clips supplied by the owning feature', async () => {
    await expect(
      audioService.preloadClips([
        { key: 'first', asset: 'first-audio' },
        { key: 'second', asset: 'second-audio' },
      ]),
    ).resolves.toBeUndefined();
  });

  it('accepts an empty clip list', async () => {
    await expect(audioService.preloadClips([])).resolves.toBeUndefined();
  });
});
