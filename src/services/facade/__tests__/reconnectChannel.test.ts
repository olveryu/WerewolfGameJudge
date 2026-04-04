/**
 * GameFacade.reconnectChannel — promise dedup + aborted guard 单元测试
 *
 * 覆盖：并发调用 dedup、#aborted 早退、trigger/sessionId 在日志中传递。
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAudioServiceInstance = {
  playNightAudio: jest.fn().mockResolvedValue(undefined),
  playNightEndAudio: jest.fn().mockResolvedValue(undefined),
  playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
  playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
  preloadForRoles: jest.fn().mockResolvedValue(undefined),
  clearPreloaded: jest.fn(),
  cleanup: jest.fn(),
  stop: jest.fn(),
};
jest.mock('../../infra/AudioService', () => ({
  __esModule: true,
  AudioService: jest.fn(() => mockAudioServiceInstance),
}));

const mockRoomService = () => ({
  getGameState: jest.fn().mockResolvedValue(null),
  createRoom: jest.fn().mockResolvedValue(undefined),
});

jest.mock('../../../utils/logger', () => ({
  facadeLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

import { GameFacade } from '../GameFacade';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockRealtimeService {
  joinRoom: jest.Mock;
  leaveRoom: jest.Mock;
  markAsLive: jest.Mock;
  addStatusListener: jest.Mock;
  rejoinCurrentRoom: jest.Mock;
}

function createFacade(): { facade: GameFacade; mockRealtime: MockRealtimeService } {
  const mockRealtime: MockRealtimeService = {
    joinRoom: jest.fn().mockResolvedValue(undefined),
    leaveRoom: jest.fn().mockResolvedValue(undefined),
    markAsLive: jest.fn(),
    addStatusListener: jest.fn().mockReturnValue(() => {}),
    rejoinCurrentRoom: jest.fn().mockResolvedValue(undefined),
  };

  const facade = new GameFacade({
    store: new GameStore(),
    realtimeService: mockRealtime as any,
    audioService: mockAudioServiceInstance as any,
    roomService: mockRoomService() as any,
  });

  return { facade, mockRealtime };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameFacade.reconnectChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('promise dedup', () => {
    it('only calls rejoinCurrentRoom once for concurrent calls', async () => {
      const { facade, mockRealtime } = createFacade();

      // Simulate being in an active room by creating one first
      await facade.createRoom('ABCD', 'host-uid', {
        name: 'Test',
        numberOfPlayers: 6,
        roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
      });

      // Make rejoinCurrentRoom take some time
      let resolveRejoin!: () => void;
      mockRealtime.rejoinCurrentRoom.mockReturnValue(
        new Promise<void>((r) => {
          resolveRejoin = r;
        }),
      );

      // Fire three concurrent reconnectChannel calls
      const p1 = facade.reconnectChannel('deadChannel');
      const p2 = facade.reconnectChannel('foreground');
      const p3 = facade.reconnectChannel('online');

      resolveRejoin();
      await Promise.all([p1, p2, p3]);

      // rejoinCurrentRoom should only be called once
      expect(mockRealtime.rejoinCurrentRoom).toHaveBeenCalledTimes(1);
    });

    it('allows a new call after previous completes', async () => {
      const { facade, mockRealtime } = createFacade();
      await facade.createRoom('ABCD', 'host-uid', {
        name: 'Test',
        numberOfPlayers: 6,
        roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
      });

      await facade.reconnectChannel('deadChannel');
      await facade.reconnectChannel('foreground');

      // Two sequential calls — each should trigger rejoin
      expect(mockRealtime.rejoinCurrentRoom).toHaveBeenCalledTimes(2);
    });
  });

  describe('aborted guard', () => {
    it('early returns when #aborted is true (after leaveRoom)', async () => {
      const { facade, mockRealtime } = createFacade();
      await facade.createRoom('ABCD', 'host-uid', {
        name: 'Test',
        numberOfPlayers: 6,
        roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
      });

      // Leave room sets #aborted = true
      await facade.leaveRoom();

      // reconnectChannel should be no-op
      await facade.reconnectChannel('deadChannel');
      // the rejoinCurrentRoom from leaveRoom cleanup should have been called once,
      // but the reconnectChannel call after leaveRoom should NOT call rejoinCurrentRoom again
      // leaveRoom calls leaveRoom on realtimeService, not rejoinCurrentRoom
      expect(mockRealtime.rejoinCurrentRoom).not.toHaveBeenCalled();
    });
  });

  describe('trigger parameter', () => {
    it('passes trigger through to rejoinCurrentRoom call', async () => {
      const { facade } = createFacade();
      await facade.createRoom('ABCD', 'host-uid', {
        name: 'Test',
        numberOfPlayers: 6,
        roles: ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager'] as any[],
      });

      const { facadeLog } = jest.requireMock('../../../utils/logger') as {
        facadeLog: { info: jest.Mock };
      };

      await facade.reconnectChannel('deadChannel');

      // Verify trigger appears in log calls
      const startLog = facadeLog.info.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('starting dead channel recovery'),
      );
      expect(startLog).toBeDefined();
      expect(startLog![1]).toMatchObject({ trigger: 'deadChannel', layer: 'L5' });
    });
  });
});
