/**
 * Tests for useRoomHostDialogs hook (MVP selection + settings entry).
 * The host flow commands (assign / start / restart) are covered by
 * useWerewolfHostControl.test.ts.
 */
import type { RoleAction } from '@game-judge/game-engine/games/werewolf/public';
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { useRoomHostDialogs } from '@/games/werewolf/room/useRoomHostDialogs';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { showAlert } from '@/utils/alert';

// Mock showAlert
jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
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
    pendingAudioEffects: [],
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

describe('useRoomHostDialogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showMvpSelection', () => {
    it('selects MVP for the captured round and allows cancellation', async () => {
      const mvpUserId = 'test-uid-1';
      const gameState = createMockGameState(8);
      gameState.status = GameStatus.Ended;
      gameState.roleRevealRandomNonce = 'completed-round';
      gameState.startingParticipants = Array.from(gameState.players.values()).flatMap((player) =>
        player === null ? [] : [{ userId: player.userId, seat: player.seat }],
      );
      const selectMvp = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          selectMvp,
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
      expect(mockShowAlert).not.toHaveBeenCalled();
      expect(result.current.mvpSelection).toBeNull();
    });

    it('isMvpSubmitting tracks the selection submission and blocks close while in flight', async () => {
      const gameState = createMockGameState(8);
      gameState.status = GameStatus.Ended;
      gameState.roleRevealRandomNonce = 'completed-round';
      gameState.startingParticipants = Array.from(gameState.players.values()).flatMap((player) =>
        player === null ? [] : [{ userId: player.userId, seat: player.seat }],
      );
      let resolveSelect!: (outcome: WerewolfCommandDispatchOutcome) => void;
      const selectMvp = jest.fn(
        () =>
          new Promise<WerewolfCommandDispatchOutcome>((resolve) => {
            resolveSelect = resolve;
          }),
      );
      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          selectMvp,
          navigation: mockNavigation,
          roomCode: '1234',
        }),
      );

      expect(result.current.isMvpSubmitting).toBe(false);
      act(() => result.current.showMvpSelection());
      const selection = result.current.mvpSelection;
      expect(selection).not.toBeNull();

      let selectPromise: Promise<void> | undefined;
      act(() => {
        selectPromise = selection?.onSelect('test-uid-1');
      });
      expect(result.current.isMvpSubmitting).toBe(true);

      // Close is blocked while the selection is submitting.
      act(() => result.current.closeMvpSelection());
      expect(result.current.mvpSelection).not.toBeNull();

      await act(async () => {
        resolveSelect(successfulRoomCommand(buildWerewolfTestState()));
        await selectPromise;
      });
      expect(result.current.isMvpSubmitting).toBe(false);
      expect(result.current.mvpSelection).toBeNull();
    });
  });

  describe('handleSettingsPress', () => {
    it('should navigate to Config screen with roomCode', () => {
      const gameState = createMockGameState(8);

      const { result } = renderHook(() =>
        useRoomHostDialogs({
          gameState,
          selectMvp: jest.fn(),
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
});
