/**
 * Tests for useRoomHostDialogs hook
 */
import type { RoleAction } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { AlertButton } from '@/components/AlertModal';
import { useRoomHostDialogs } from '@/games/werewolf/room/useRoomHostDialogs';
import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

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
      userId: `test-uid-${i}`,
      seat: i,
      displayName: `Player ${i}`,
      role: null,
      hasViewedRole: false,
    });
  }

  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: '1234',
    hostUserId: 'host-uid',
    status: GameStatus.Ongoing,
    template: {
      roles: new Array<RoleId>(playerCount).fill('villager'),
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
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
  };
};

function getButtons(result: { current: { alert: { buttons: AlertButton[] } | null } }) {
  return result.current.alert?.buttons ?? [];
}

describe('useRoomHostDialogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      expect(result.current.alert).toMatchObject({
        title: '无法开始游戏',
        message: '还有空位未入座',
        buttons: [{ text: '知道了' }],
      });
    });

    it('should show confirmation when all seats are occupied', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      expect(result.current.alert).toMatchObject({
        title: '分配角色？',
        message: '所有座位已满，将洗牌并分配角色',
      });
      expect(getButtons(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });
  });

  describe('showRestartDialog', () => {
    it('selects MVP for the captured round without restarting and allows cancellation', async () => {
      const mvpUserId = 'test-uid-1';
      const gameState = createMockGameState(8);
      gameState.status = GameStatus.Ended;
      gameState.roleRevealRandomNonce = 'completed-round';
      gameState.startingParticipants = Array.from(gameState.players.values()).flatMap((player) =>
        player === null ? [] : [{ userId: player.userId, seat: player.seat }],
      );
      const restartGame = jest.fn().mockResolvedValue(undefined);
      const selectMvp = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          restartGame,
          selectMvp,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          shareNightReviewReport: jest.fn(),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );
      act(() => result.current.showMvpSelection());
      act(() => result.current.closeMvpSelection());
      expect(selectMvp).not.toHaveBeenCalled();
      expect(result.current.mvpSelection).toBeNull();
      act(() => result.current.showMvpSelection());
      expect(result.current.mvpSelection?.goldenDraws).toBe(16);
      expect(result.current.mvpSelection?.participants).toHaveLength(8);
      gameState.roleRevealRandomNonce = 'next-round';
      await act(async () => {
        await result.current.mvpSelection?.onSelect(mvpUserId);
      });
      expect(selectMvp).toHaveBeenCalledWith({
        roleRevealRandomNonce: 'completed-round',
        mvpUserId,
      });
      expect(restartGame).not.toHaveBeenCalled();
      expect(result.current.alert).toBeNull();
      expect(result.current.mvpSelection).toBeNull();
    });

    it('should show share-before-restart dialog when game is ended', () => {
      const gameState = createMockGameState(8);
      gameState.status = GameStatus.Ended;

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      act(() => {
        result.current.showRestartDialog();
      });

      expect(result.current.alert).toMatchObject({
        title: '重新开始游戏？',
        message: '重新开始后本局复盘将无法查看，是否先分享战报？',
      });
      expect(getButtons(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: '分享战报' }),
          expect.objectContaining({ text: '重新开始' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );
    });
  });

  describe('handleSettingsPress', () => {
    it('should navigate to Config screen with roomCode', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          assignRoles: jest.fn(),
          startGame: jest.fn(),
          restartGame: jest.fn(),
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '5678',
        }),
      );

      act(() => {
        result.current.handleSettingsPress();
      });

      expect(mockNavigate).toHaveBeenCalledWith('GameConfig', {
        gameType: 'werewolf',
        mode: 'edit',
        roomCode: '5678',
      });
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
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
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
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      // Trigger the dialog
      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      // Get the confirm button callback from the alert state
      const confirmBtn = getButtons(result).find((b) => b.text === '确定');
      expect(confirmBtn).toBeDefined();

      // First press: should call assignRoles
      act(() => {
        void confirmBtn?.onPress?.();
      });
      expect(mockAssignRoles).toHaveBeenCalledTimes(1);
      expect(result.current.isHostActionSubmitting).toBe(true);

      // Second press while first still in-flight: should be rejected
      act(() => {
        void confirmBtn?.onPress?.();
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
      gameState.status = GameStatus.Ended;
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
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      act(() => {
        result.current.showRestartDialog();
      });

      const confirmBtn = getButtons(result).find((b) => b.text === '重新开始');

      // First press
      await act(async () => {
        void confirmBtn?.onPress?.();
      });
      expect(mockRestartGame).toHaveBeenCalledTimes(1);
      expect(result.current.isHostActionSubmitting).toBe(true);

      // Second press rejected
      await act(async () => {
        void confirmBtn?.onPress?.();
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
          selectMvp: jest.fn(),
          shareNightReviewReport: jest.fn().mockResolvedValue(false),
          setIsStartingGame: jest.fn(),
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      // showStartGameDialog sets the alert state, we need to press confirm
      act(() => {
        result.current.showStartGameDialog();
      });

      const confirmBtn = getButtons(result).find((b) => b.text === '确定');

      // First press via dialog confirm
      await act(async () => {
        void confirmBtn?.onPress?.();
      });
      expect(mockStartGame).toHaveBeenCalledTimes(1);

      // Trigger dialog again and press confirm — should be rejected (still in-flight)
      act(() => {
        result.current.showStartGameDialog();
      });
      const confirmBtn2 = getButtons(result).find((b) => b.text === '确定');

      await act(async () => {
        await confirmBtn2?.onPress?.();
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
