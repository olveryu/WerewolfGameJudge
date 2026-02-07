/**
 * Tests for useRoomHostDialogs hook
 */
import { renderHook, act } from '@testing-library/react-native';
import { useRoomHostDialogs } from '../useRoomHostDialogs';
import { showAlert } from '../../../utils/alert';
import type { LocalGameState, LocalPlayer } from '../../../services/types/GameStateTypes';
import { GameStatus } from '../../../models/GameStatus';
import type { RoleId } from '../../../models/roles';
import type { RoleAction } from '../../../models/actions/RoleAction';

// Mock showAlert
jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
} as unknown as Parameters<typeof useRoomHostDialogs>[0]['navigation'];

// Create mock game state
const createMockGameState = (playerCount: number): LocalGameState => {
  const players = new Map<number, LocalPlayer | null>();
  for (let i = 1; i <= playerCount; i++) {
    players.set(i, {
      uid: `test-uid-${i}`,
      seatNumber: i,
      displayName: `Player ${i}`,
      role: null,
      hasViewedRole: false,
    });
  }

  return {
    roomCode: '1234',
    hostUid: 'host-uid',
    status: GameStatus.ongoing,
    template: {
      roles: new Array(playerCount).fill('villager' as RoleId),
      name: 'Test Template',
      numberOfPlayers: playerCount,
    },
    players,
    actions: new Map<RoleId, RoleAction>(),
    wolfVotes: new Map<number, number>(),
    currentActionerIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
  };
};

describe('useRoomHostDialogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showSpeakOrderDialog', () => {
    it('should not show dialog when gameState is null', () => {
      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState: null,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showSpeakOrderDialog();
      });

      expect(mockShowAlert).not.toHaveBeenCalled();
    });

    it('should show dialog with random speaking order when gameState exists', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showSpeakOrderDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledTimes(1);
      expect(mockShowAlert).toHaveBeenCalledWith(
        '发言顺序',
        expect.stringMatching(/从 \d+ 号玩家开始，(顺时针|逆时针) 发言。/),
        [{ text: '知道了', style: 'default' }],
      );
    });

    it('should generate start seat within valid range (1 to playerCount)', () => {
      const playerCount = 12;
      const gameState = createMockGameState(playerCount);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      // Call multiple times to test randomness stays in range
      for (let i = 0; i < 20; i++) {
        mockShowAlert.mockClear();

        act(() => {
          result.current.showSpeakOrderDialog();
        });

        const callArg = mockShowAlert.mock.calls[0][1] as string;
        const regex = /从 (\d+) 号玩家开始/;
        const match = regex.exec(callArg);
        expect(match).not.toBeNull();

        const startSeat = Number.parseInt(match![1], 10);
        expect(startSeat).toBeGreaterThanOrEqual(1);
        expect(startSeat).toBeLessThanOrEqual(playerCount);
      }
    });

    it('should use either 顺时针 or 逆时针 direction', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      const directions = new Set<string>();

      // Call multiple times to collect both directions (probabilistic)
      for (let i = 0; i < 50; i++) {
        mockShowAlert.mockClear();

        act(() => {
          result.current.showSpeakOrderDialog();
        });

        const callArg = mockShowAlert.mock.calls[0][1] as string;
        if (callArg.includes('顺时针')) {
          directions.add('顺时针');
        }
        if (callArg.includes('逆时针')) {
          directions.add('逆时针');
        }
      }

      // With 50 iterations, probability of not seeing both is (0.5)^50 ≈ 0
      expect(directions.has('顺时针')).toBe(true);
      expect(directions.has('逆时针')).toBe(true);
    });
  });

  describe('showPrepareToFlipDialog', () => {
    it('should show error when not all seats are occupied', () => {
      const gameState = createMockGameState(8);
      // Set some players to null to simulate empty seats
      gameState.players.set(1, null);
      gameState.players.set(2, null);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith('无法开始游戏', '有座位尚未被占用。', [
        { text: '知道了', style: 'default' },
      ]);
    });

    it('should show confirmation when all seats are occupied', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '允许看牌？',
        '所有座位已被占用。将洗牌并分配角色。',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });
  });

  describe('showRestartDialog', () => {
    it('should show restart confirmation dialog', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showRestartDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '重新开始游戏？',
        '使用相同板子开始新一局游戏。',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });
  });

  describe('handleSettingsPress', () => {
    it('should navigate to Config screen with roomNumber', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '5678',
        }),
      );

      act(() => {
        result.current.handleSettingsPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith('Config', { existingRoomNumber: '5678' });
    });
  });
});
