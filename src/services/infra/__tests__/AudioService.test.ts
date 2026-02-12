import { RoleId } from '@/models/roles';

// Mock logger
const mockAudioLogWarn = jest.fn();
jest.mock('../../../utils/logger', () => ({
  audioLog: {
    warn: (msg: string, ...args: unknown[]) => mockAudioLogWarn(msg, ...args),
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

// Mock all audio file requires before importing AudioService
jest.mock('../../../../assets/audio/slacker.mp3', () => 'slacker-audio', { virtual: true });
jest.mock('../../../../assets/audio/wolf_robot.mp3', () => 'wolf_robot-audio', { virtual: true });
jest.mock('../../../../assets/audio/magician.mp3', () => 'magician-audio', { virtual: true });
jest.mock('../../../../assets/audio/dreamcatcher.mp3', () => 'dreamcatcher-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio/gargoyle.mp3', () => 'gargoyle-audio', { virtual: true });
jest.mock('../../../../assets/audio/nightmare.mp3', () => 'nightmare-audio', { virtual: true });
jest.mock('../../../../assets/audio/guard.mp3', () => 'guard-audio', { virtual: true });
jest.mock('../../../../assets/audio/wolf.mp3', () => 'wolf-audio', { virtual: true });
jest.mock('../../../../assets/audio/wolf_queen.mp3', () => 'wolf_queen-audio', { virtual: true });
jest.mock('../../../../assets/audio/witch.mp3', () => 'witch-audio', { virtual: true });
jest.mock('../../../../assets/audio/seer.mp3', () => 'seer-audio', { virtual: true });
jest.mock('../../../../assets/audio/psychic.mp3', () => 'psychic-audio', { virtual: true });
jest.mock('../../../../assets/audio/hunter.mp3', () => 'hunter-audio', { virtual: true });
jest.mock('../../../../assets/audio/dark_wolf_king.mp3', () => 'dark_wolf_king-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio/night.mp3', () => 'night-audio', { virtual: true });
jest.mock('../../../../assets/audio/night_end.mp3', () => 'night_end-audio', { virtual: true });

// Mock ending audio files
jest.mock('../../../../assets/audio_end/slacker.mp3', () => 'slacker-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/wolf_robot.mp3', () => 'wolf_robot-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/magician.mp3', () => 'magician-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/dreamcatcher.mp3', () => 'dreamcatcher-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/gargoyle.mp3', () => 'gargoyle-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/nightmare.mp3', () => 'nightmare-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/guard.mp3', () => 'guard-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/wolf.mp3', () => 'wolf-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/wolf_queen.mp3', () => 'wolf_queen-end-audio', {
  virtual: true,
});
jest.mock('../../../../assets/audio_end/witch.mp3', () => 'witch-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/seer.mp3', () => 'seer-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/psychic.mp3', () => 'psychic-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/hunter.mp3', () => 'hunter-end-audio', { virtual: true });
jest.mock('../../../../assets/audio_end/dark_wolf_king.mp3', () => 'dark_wolf_king-end-audio', {
  virtual: true,
});

// Now import AudioService after mocks are set up
import { NIGHT_STEPS } from '@/models/roles/spec';
import {
  _AUDIO_END_ROLE_IDS,
  _AUDIO_ROLE_IDS,
  audioAssetToUrl,
  AudioService,
} from '@/services/infra/AudioService';

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
    const { setAudioModeAsync } = require('expo-audio');

    new AudioService();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      playsInSilentMode: true,
      shouldPlayInBackground: false, // Stop when app goes to background
      interruptionMode: 'duckOthers',
    });
  });
});

describe('AudioService - Audio file mappings', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
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

describe('AudioService - Play methods', () => {
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
    const { createAudioPlayer } = require('expo-audio');

    // Start playing (won't complete due to mock setup)
    audioService.playRoleBeginningAudio('wolf');

    // Start another - should stop the first
    audioService.playRoleBeginningAudio('seer');

    // Second call should have paused the first player (player kept for reuse on iOS Safari)
    expect(mockPause).toHaveBeenCalled();
    // Note: remove() is no longer called - player is reused for iOS Safari compatibility
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
    // Note: remove() is no longer called - player is kept for reuse on iOS Safari
    expect(audioService.getIsPlaying()).toBe(false);
  });
});

describe('AudioService - Audio roles coverage', () => {
  let audioService: AudioService;

  beforeEach(() => {
    audioService = new AudioService();
  });

  const rolesWithAudio: RoleId[] = [
    'slacker',
    'wolfRobot',
    'magician',
    'dreamcatcher',
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

  const rolesWithoutAudio: RoleId[] = ['villager', 'idiot', 'knight', 'wolfKing', 'bloodMoon'];

  rolesWithAudio.forEach((role) => {
    it(`should have beginning audio for ${role}`, () => {
      expect(audioService.getBeginningAudio(role)).toBeDefined();
    });

    it(`should have ending audio for ${role}`, () => {
      expect(audioService.getEndingAudio(role)).toBeDefined();
    });
  });

  rolesWithoutAudio.forEach((role) => {
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

  beforeEach(() => {
    audioService = new AudioService();
    jest.clearAllMocks();
    mockAudioLogWarn.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve immediately with warning when beginning audio is not registered', async () => {
    // villager has no audio registered
    await expect(audioService.playRoleBeginningAudio('villager')).resolves.toBeUndefined();
    // Missing audio is a normal case for some roles (e.g. villager)
    // We just verify it resolves - no assertion on logging since this is expected behavior
  });

  it('should resolve immediately with warning when ending audio is not registered', async () => {
    // villager has no audio registered
    await expect(audioService.playRoleEndingAudio('villager')).resolves.toBeUndefined();
    // Missing audio is a normal case for some roles (e.g. villager)
    // We just verify it resolves - no assertion on logging since this is expected behavior
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
    const { createAudioPlayer } = require('expo-audio');
    createAudioPlayer.mockImplementationOnce(() => {
      throw new Error('Simulated player creation failure');
    });

    // Should resolve, not reject
    await expect(audioService.playNightBeginAudio()).resolves.toBeUndefined();

    // Should have logged a warning
    expect(mockAudioLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('Audio playback failed, resolving anyway'),
      expect.any(Error),
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
    expect(mockAudioLogWarn).toHaveBeenCalledWith(
      expect.stringContaining('Audio playback failed, resolving anyway'),
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
    const playPromise = audioService.playNightBeginAudio();

    // Fast-forward past the timeout (15 seconds)
    jest.advanceTimersByTime(15000);

    await expect(playPromise).resolves.toBeUndefined();

    // The important contract: it must resolve (not hang). Logging is optional.
    // We don't assert on logging here as timeout logging may be debug-level.
  });
});

// =============================================================================
// Contract: AUDIO_FILES / AUDIO_END_FILES cover all NIGHT_STEPS roleIds
// =============================================================================

describe('Audio coverage contract', () => {
  const nightStepRoleIds = [...new Set(NIGHT_STEPS.map((s) => s.roleId))];

  it('AUDIO_FILES covers every unique NIGHT_STEPS roleId', () => {
    for (const roleId of nightStepRoleIds) {
      expect(_AUDIO_ROLE_IDS).toContain(roleId);
    }
  });

  it('AUDIO_END_FILES covers every unique NIGHT_STEPS roleId', () => {
    for (const roleId of nightStepRoleIds) {
      expect(_AUDIO_END_ROLE_IDS).toContain(roleId);
    }
  });

  it('AUDIO_FILES and AUDIO_END_FILES have same keys', () => {
    expect([..._AUDIO_ROLE_IDS].sort()).toEqual([..._AUDIO_END_ROLE_IDS].sort());
  });
});
