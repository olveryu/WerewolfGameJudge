/**
 * Tests for useRoomHostDialogs hook
 */
import { act, renderHook } from '@testing-library/react-native';
import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';

import { useRoomHostDialogs } from '@/screens/RoomScreen/useRoomHostDialogs';
import type { LocalGameState, LocalPlayer } from '@/types/GameStateTypes';
import { showAlert } from '@/utils/alert';

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
    currentStepIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    pendingRevealAcks: [],
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

  // ─────────────────────────────────────────────────────────────────────────
  // Double-click protection (submittingRef + isHostActionSubmitting)
  // ─────────────────────────────────────────────────────────────────────────

  describe('double-click protection', () => {
    it('isHostActionSubmitting should start as false', () => {
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

      expect(result.current.isHostActionSubmitting).toBe(false);
    });

    it('showPrepareToFlipDialog confirm should call assignRoles once and reject second press', async () => {
      const gameState = createMockGameState(4);
      let resolveAssign!: () => void;
      const mockAssignRoles = jest.fn(
        () => new Promise<void>((resolve) => (resolveAssign = resolve)),
      );

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: mockAssignRoles,
          startGame: jest.fn(),
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      // Trigger the dialog
      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      // Get the confirm button callback
      const alertCall = mockShowAlert.mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;
      const confirmBtn = buttons.find((b) => b.text === '确定');
      expect(confirmBtn).toBeDefined();

      // First press: should call assignRoles
      act(() => {
        confirmBtn?.onPress?.();
      });
      expect(mockAssignRoles).toHaveBeenCalledTimes(1);
      expect(result.current.isHostActionSubmitting).toBe(true);

      // Second press while first still in-flight: should be rejected
      act(() => {
        confirmBtn?.onPress?.();
      });
      expect(mockAssignRoles).toHaveBeenCalledTimes(1); // still 1

      // Resolve the first call
      await act(async () => {
        resolveAssign();
      });
      expect(result.current.isHostActionSubmitting).toBe(false);
    });

    it('showRestartDialog confirm should call restartGame once and reject double press', async () => {
      const gameState = createMockGameState(4);
      let resolveRestart!: () => void;
      const mockRestartGame = jest.fn(
        () => new Promise<void>((resolve) => (resolveRestart = resolve)),
      );

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: mockRestartGame,
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      act(() => {
        result.current.showRestartDialog();
      });

      const alertCall = mockShowAlert.mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;
      const confirmBtn = buttons.find((b) => b.text === '确定');

      // First press
      act(() => {
        confirmBtn?.onPress?.();
      });
      expect(mockRestartGame).toHaveBeenCalledTimes(1);
      expect(result.current.isHostActionSubmitting).toBe(true);

      // Second press rejected
      act(() => {
        confirmBtn?.onPress?.();
      });
      expect(mockRestartGame).toHaveBeenCalledTimes(1);

      // Resolve
      await act(async () => {
        resolveRestart();
      });
      expect(result.current.isHostActionSubmitting).toBe(false);
    });

    it('handleStartGame should reject double press', async () => {
      const gameState = createMockGameState(4);
      let resolveStart!: () => void;
      const mockStartGame = jest.fn(() => new Promise<void>((resolve) => (resolveStart = resolve)));

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: mockStartGame,
          restartGame: jest.fn(),
          getLastNightInfo: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomNumber: '1234',
        }),
      );

      // showStartGameDialog calls showAlert, we need to press confirm
      act(() => {
        result.current.showStartGameDialog();
      });

      const alertCall = mockShowAlert.mock.calls[0];
      const buttons = alertCall[2] as Array<{ text: string; onPress?: () => void }>;
      const confirmBtn = buttons.find((b) => b.text === '确定');

      // First press via dialog confirm
      await act(async () => {
        confirmBtn?.onPress?.();
      });
      expect(mockStartGame).toHaveBeenCalledTimes(1);

      // Trigger dialog again and press confirm — should be rejected (still in-flight)
      mockShowAlert.mockClear();
      act(() => {
        result.current.showStartGameDialog();
      });
      const alertCall2 = mockShowAlert.mock.calls[0];
      const buttons2 = alertCall2[2] as Array<{ text: string; onPress?: () => void }>;
      const confirmBtn2 = buttons2.find((b) => b.text === '确定');

      await act(async () => {
        confirmBtn2?.onPress?.();
      });
      expect(mockStartGame).toHaveBeenCalledTimes(1); // still 1

      // Resolve
      await act(async () => {
        resolveStart();
      });
      expect(result.current.isHostActionSubmitting).toBe(false);
    });
  });
});
