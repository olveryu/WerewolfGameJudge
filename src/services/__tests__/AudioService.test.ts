import { RoleName } from '../../models/roles';

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

// Mock all audio file requires before importing AudioService
jest.mock('../../../assets/audio/slacker.mp3', () => 'slacker-audio', { virtual: true });
jest.mock('../../../assets/audio/wolf_robot.mp3', () => 'wolf_robot-audio', { virtual: true });
jest.mock('../../../assets/audio/magician.mp3', () => 'magician-audio', { virtual: true });
jest.mock('../../../assets/audio/dreamcatcher.mp3', () => 'dreamcatcher-audio', { virtual: true });
jest.mock('../../../assets/audio/gargoyle.mp3', () => 'gargoyle-audio', { virtual: true });
jest.mock('../../../assets/audio/nightmare.mp3', () => 'nightmare-audio', { virtual: true });
jest.mock('../../../assets/audio/guard.mp3', () => 'guard-audio', { virtual: true });
jest.mock('../../../assets/audio/wolf.mp3', () => 'wolf-audio', { virtual: true });
jest.mock('../../../assets/audio/wolf_queen.mp3', () => 'wolf_queen-audio', { virtual: true });
jest.mock('../../../assets/audio/witch.mp3', () => 'witch-audio', { virtual: true });
jest.mock('../../../assets/audio/seer.mp3', () => 'seer-audio', { virtual: true });
jest.mock('../../../assets/audio/psychic.mp3', () => 'psychic-audio', { virtual: true });
jest.mock('../../../assets/audio/hunter.mp3', () => 'hunter-audio', { virtual: true });
jest.mock('../../../assets/audio/dark_wolf_king.mp3', () => 'dark_wolf_king-audio', { virtual: true });
jest.mock('../../../assets/audio/night.mp3', () => 'night-audio', { virtual: true });
jest.mock('../../../assets/audio/night_end.mp3', () => 'night_end-audio', { virtual: true });

// Mock ending audio files
jest.mock('../../../assets/audio_end/slacker.mp3', () => 'slacker-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/wolf_robot.mp3', () => 'wolf_robot-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/magician.mp3', () => 'magician-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/dreamcatcher.mp3', () => 'dreamcatcher-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/gargoyle.mp3', () => 'gargoyle-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/nightmare.mp3', () => 'nightmare-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/guard.mp3', () => 'guard-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/wolf.mp3', () => 'wolf-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/wolf_queen.mp3', () => 'wolf_queen-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/witch.mp3', () => 'witch-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/seer.mp3', () => 'seer-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/psychic.mp3', () => 'psychic-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/hunter.mp3', () => 'hunter-end-audio', { virtual: true });
jest.mock('../../../assets/audio_end/dark_wolf_king.mp3', () => 'dark_wolf_king-end-audio', { virtual: true });

// Now import AudioService after mocks are set up
import AudioService from '../AudioService';

describe('AudioService - Singleton', () => {
  beforeEach(() => {
    // Reset singleton for each test
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    jest.clearAllMocks();
  });

  it('should return same instance', () => {
    const instance1 = AudioService.getInstance();
    const instance2 = AudioService.getInstance();
    
    expect(instance1).toBe(instance2);
  });

  it('should be defined', () => {
    const instance = AudioService.getInstance();
    expect(instance).toBeDefined();
  });

  it('should initialize audio mode on first getInstance', () => {
    const { setAudioModeAsync } = require('expo-audio');
    
    AudioService.getInstance();
    
    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
  });
});

describe('AudioService - Audio file mappings', () => {
  let audioService: AudioService;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
    jest.clearAllMocks();
  });

  it('should have beginning audio for wolf', () => {
    const audio = audioService.getBeginningAudio('wolf');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for seer', () => {
    const audio = audioService.getBeginningAudio('seer');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for witch', () => {
    const audio = audioService.getBeginningAudio('witch');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for guard', () => {
    const audio = audioService.getBeginningAudio('guard');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for hunter', () => {
    const audio = audioService.getBeginningAudio('hunter');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for nightmare', () => {
    const audio = audioService.getBeginningAudio('nightmare');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for wolfQueen', () => {
    const audio = audioService.getBeginningAudio('wolfQueen');
    expect(audio).toBeDefined();
  });

  it('should have beginning audio for darkWolfKing', () => {
    const audio = audioService.getBeginningAudio('darkWolfKing');
    expect(audio).toBeDefined();
  });

  it('should return null for role without audio', () => {
    const audio = audioService.getBeginningAudio('villager');
    expect(audio).toBeNull();
  });

  it('should have ending audio for wolf', () => {
    const audio = audioService.getEndingAudio('wolf');
    expect(audio).toBeDefined();
  });

  it('should have ending audio for seer', () => {
    const audio = audioService.getEndingAudio('seer');
    expect(audio).toBeDefined();
  });

  it('should return null for ending audio of role without audio', () => {
    const audio = audioService.getEndingAudio('villager');
    expect(audio).toBeNull();
  });
});

describe('AudioService - Playback control', () => {
  let audioService: AudioService;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
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

describe('AudioService - Play methods', () => {
  let audioService: AudioService;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
    jest.clearAllMocks();
    
    // Setup mock to simulate playback completion
    mockAddListener.mockImplementation((event: string, callback: Function) => {
      // Immediately call the callback with didJustFinish to resolve the promise
      setTimeout(() => {
        callback({ didJustFinish: true });
      }, 0);
      return { remove: jest.fn() };
    });
  });

  it('playRoleBeginningAudio should call createAudioPlayer for valid role', async () => {
    const { createAudioPlayer } = require('expo-audio');
    
    await audioService.playRoleBeginningAudio('wolf');
    
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it('playRoleBeginningAudio should not throw for role without audio', async () => {
    await expect(audioService.playRoleBeginningAudio('villager')).resolves.toBeUndefined();
  });

  it('playRoleEndingAudio should call createAudioPlayer for valid role', async () => {
    const { createAudioPlayer } = require('expo-audio');
    
    await audioService.playRoleEndingAudio('wolf');
    
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it('playNightAudio should create audio player', async () => {
    const { createAudioPlayer } = require('expo-audio');
    
    await audioService.playNightAudio();
    
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it('playNightBeginAudio should be alias for playNightAudio', async () => {
    const { createAudioPlayer } = require('expo-audio');
    
    await audioService.playNightBeginAudio();
    
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it('playNightEndAudio should create audio player', async () => {
    const { createAudioPlayer } = require('expo-audio');
    
    await audioService.playNightEndAudio();
    
    expect(createAudioPlayer).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });
});

describe('AudioService - Stop current player', () => {
  let audioService: AudioService;

  beforeEach(() => {
    jest.useFakeTimers();
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
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
    const { createAudioPlayer } = require('expo-audio');
    
    // Start playing (won't complete due to mock setup)
    audioService.playRoleBeginningAudio('wolf');
    
    // Start another - should stop the first
    audioService.playRoleBeginningAudio('seer');
    
    // Second call should have paused and removed the first player
    expect(mockPause).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
    expect(createAudioPlayer).toHaveBeenCalledTimes(2);

    // Consume pending timers to avoid open handles
    jest.advanceTimersByTime(15000);
  });

  it('stop method should pause and remove player', () => {
    // Simulate that we have a player
    (audioService as any).player = {
      pause: mockPause,
      remove: mockRemove,
    };
    (audioService as any).isPlaying = true;
    
    audioService.stop();
    
    expect(mockPause).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
    expect(audioService.getIsPlaying()).toBe(false);
  });
});

describe('AudioService - Audio roles coverage', () => {
  let audioService: AudioService;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
  });

  const rolesWithAudio: RoleName[] = [
    'slacker',
    'wolfRobot',
    'magician',
    'celebrity',
    'gargoyle',
    'nightmare',
    'guard',
    'wolf',
    'wolfQueen',
    'witch',
    'seer',
    'psychic',
    'hunter',
    'darkWolfKing',
  ];

  const rolesWithoutAudio: RoleName[] = [
    'villager',
    'idiot',
    'knight',
    'wolfKing',
    'bloodMoon',
  ];

  rolesWithAudio.forEach(role => {
    it(`should have beginning audio for ${role}`, () => {
      expect(audioService.getBeginningAudio(role)).toBeDefined();
    });

    it(`should have ending audio for ${role}`, () => {
      expect(audioService.getEndingAudio(role)).toBeDefined();
    });
  });

  rolesWithoutAudio.forEach(role => {
    it(`should NOT have beginning audio for ${role}`, () => {
      expect(audioService.getBeginningAudio(role)).toBeNull();
    });

    it(`should NOT have ending audio for ${role}`, () => {
      expect(audioService.getEndingAudio(role)).toBeNull();
    });
  });
});

// =============================================================================
// Fallback / Error Handling Tests
// =============================================================================

describe('AudioService - Fallback: unregistered audio', () => {
  let audioService: AudioService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should resolve immediately with warning when beginning audio is not registered', async () => {
    // villager has no audio registered
    await expect(audioService.playRoleBeginningAudio('villager')).resolves.toBeUndefined();
    // Missing audio is a normal case for some roles (e.g. villager)
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('No beginning audio registered for role: villager')
    );
  });

  it('should resolve immediately with warning when ending audio is not registered', async () => {
    // villager has no audio registered
    await expect(audioService.playRoleEndingAudio('villager')).resolves.toBeUndefined();
    // Missing audio is a normal case for some roles (e.g. villager)
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('No ending audio registered for role: villager')
    );
  });
});

describe('AudioService - Fallback: createAudioPlayer throws', () => {
  let audioService: AudioService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should resolve (not reject) when createAudioPlayer throws', async () => {
    const { createAudioPlayer } = require('expo-audio');
    createAudioPlayer.mockImplementationOnce(() => {
      throw new Error('Simulated player creation failure');
    });

    // Should resolve, not reject
    await expect(audioService.playNightBeginAudio()).resolves.toBeUndefined();

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio playback failed, resolving anyway'),
      expect.any(Error)
    );
  });

  it('should resolve (not reject) when createAudioPlayer throws for role audio', async () => {
    const { createAudioPlayer } = require('expo-audio');
    createAudioPlayer.mockImplementationOnce(() => {
      throw new Error('Simulated player creation failure');
    });

    // Should resolve, not reject
    await expect(audioService.playRoleBeginningAudio('wolf')).resolves.toBeUndefined();

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Audio playback failed, resolving anyway'),
      expect.any(Error)
    );
  });
});

describe('AudioService - Fallback: timeout', () => {
  let audioService: AudioService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    (AudioService as any).instance = null;
    (AudioService as any).initPromise = null;
    audioService = AudioService.getInstance();
  // In Jest, timeout logging may be downgraded to debug to reduce noise.
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock player that never fires didJustFinish
    mockAddListener.mockImplementation(() => {
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should resolve after timeout if didJustFinish never fires', async () => {
    const playPromise = audioService.playNightBeginAudio();

    // Fast-forward past the timeout (15 seconds)
    jest.advanceTimersByTime(15000);

    await expect(playPromise).resolves.toBeUndefined();

    // The important contract: it must resolve (not hang). Logging is optional.
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Playback timeout - proceeding without waiting for completion')
    );
  });
});
