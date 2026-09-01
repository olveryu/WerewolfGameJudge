import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  WEREWOLF_STATE_IDENTITY,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';

import type { RoomSessionClient } from '@/features/room/session/types';
import { useWerewolfRoom } from '@/games/werewolf/hooks/useWerewolfRoom';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

let mockAuthUserId = 'host-user';
const mockShowErrorAlert = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: {
      id: mockAuthUserId,
      email: null,
      displayName: 'TestPlayer',
      avatarUrl: null,
      customAvatarUrl: null,
      avatarFrame: null,
      seatFlair: null,
      nameStyle: null,
      equippedEffect: null,
      seatAnimation: null,
      isAnonymous: true,
    },
    loading: false,
    error: null,
    isAuthenticated: true,
    refreshUser: jest.fn(async () => undefined),
  }),
}));
jest.mock('@/utils/alertPresets', () => ({
  ...jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets'),
  showErrorAlert: (title: string, message: string) => {
    mockShowErrorAlert(title, message);
  },
}));

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: '1234',
    hostUserId: 'host-user',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer'],
    players: {
      0: {
        userId: 'host-user',
        seat: 0,
        role: 'wolf',
        hasViewedRole: true,
      },
    },
    roster: {},
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    seedWolfInfectionRevealAcks: [],
    ...overrides,
  };
}

function createRoomSession(
  state: GameState,
  userId: string,
  lastRecoveredCommandRejection: { readonly commandId: string; readonly reason: string } | null,
): RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent> {
  const room = {
    roomCode: state.roomCode,
    roomId: 'room-id-1234',
    gameType: 'werewolf' as const,
    hostUserId: state.hostUserId,
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  };
  let snapshot = {
    phase: 'ready' as const,
    epoch: 1,
    identity: { room, userId },
    connection: 'live' as const,
    pendingCommandCount: 0,
    lastRecoveredCommandRejection,
    snapshot: createRoomSnapshot(state, 7),
    lastCommand: null,
    error: null,
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    connect: jest.fn(async () => ({ kind: 'connected' })),
    reconnect: jest.fn(async () => ({ kind: 'connected' })),
    disconnect: jest.fn(),
    prepare: jest.fn(),
    dispatch: jest.fn(),
    dispatchPrepared: jest.fn(),
    acknowledgeRecoveredCommandRejection: jest.fn((commandId: string) => {
      if (snapshot.lastRecoveredCommandRejection?.commandId !== commandId) return;
      snapshot = { ...snapshot, lastRecoveredCommandRejection: null };
    }),
    setUserEventHandler: jest.fn(() => () => undefined),
  } as unknown as WerewolfGameClient['roomSession'];
}

function createClient(options?: {
  readonly state?: GameState;
  readonly userId?: string;
  readonly wasAudioInterrupted?: boolean;
  readonly lastRecoveredCommandRejection?: {
    readonly commandId: string;
    readonly reason: string;
  };
}): WerewolfGameClient {
  const state = options?.state ?? createGameState();
  const success = () => successfulRoomCommand(state);
  mockAuthUserId = options?.userId ?? 'host-user';
  return {
    roomSession: createRoomSession(
      state,
      mockAuthUserId,
      options?.lastRecoveredCommandRejection ?? null,
    ),
    assignRoles: jest.fn(async () => success()),
    updateTemplate: jest.fn(async () => success()),
    startNight: jest.fn(async () => success()),
    restartGame: jest.fn(async () => success()),
    markAllBotsViewed: jest.fn(async () => success()),
    markAllBotsGroupConfirmed: jest.fn(async () => success()),
    shareNightReview: jest.fn(async () => success()),
    boardNominate: jest.fn(async () => success()),
    boardUpvote: jest.fn(async () => success()),
    boardWithdraw: jest.fn(async () => success()),
    registerSheriffCandidate: jest.fn(async () => success()),
    cancelSheriffRegistration: jest.fn(async () => success()),
    withdrawSheriffCandidate: jest.fn(async () => success()),
    castSheriffVote: jest.fn(async () => success()),
    advanceSheriffElection: jest.fn(async () => success()),
    markViewedRole: jest.fn(async () => success()),
    submitAction: jest.fn(async () => success()),
    submitRevealAck: jest.fn(async () => success()),
    submitGroupConfirmAck: jest.fn(async () => success()),
    sendWolfRobotHunterStatusViewed: jest.fn(async () => success()),
    postProgression: jest.fn(async () => success()),
    wasAudioInterrupted: options?.wasAudioInterrupted ?? false,
    resumeAfterRejoin: jest.fn(async () => undefined),
  };
}

function createWrapper(): React.FC<React.PropsWithChildren> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'WerewolfRoomTestWrapper';
  return Wrapper;
}

describe('useWerewolfRoom shared-session composition', () => {
  beforeEach(() => mockShowErrorAlert.mockClear());

  it('derives identity, seat, role, revision, and connection from one room session', () => {
    const client = createClient();
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    expect(result.current.myUserId).toBe('host-user');
    expect(result.current.isHost).toBe(true);
    expect(result.current.mySeat).toBe(0);
    expect(result.current.myRole).toBe('wolf');
    expect(result.current.stateRevision).toBe(7);
    expect(result.current.connectionStatus).toBe('live');
  });

  it('exposes sheriff election commands from the shared game action hook', async () => {
    const client = createClient({ state: createGameState({ status: GameStatus.Day }) });
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    await act(() => result.current.registerSheriffCandidate());
    await act(() => result.current.cancelSheriffRegistration());
    await act(() => result.current.castSheriffVote(null));
    await act(() => result.current.advanceSheriffElection());

    expect(client.registerSheriffCandidate).toHaveBeenCalledWith(null);
    expect(client.cancelSheriffRegistration).toHaveBeenCalledWith(null);
    expect(client.castSheriffVote).toHaveBeenCalledWith(null, null);
    expect(client.advanceSheriffElection).toHaveBeenCalledTimes(1);
  });

  it('does not infer host authority from the snapshot when the active user is a player', () => {
    const client = createClient({ userId: 'player-user' });
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    expect(result.current.isHost).toBe(false);
    expect(result.current.mySeat).toBeNull();
  });

  it('shows the rejoin overlay only for an interrupted host session', async () => {
    const client = createClient({ wasAudioInterrupted: true });
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.needsContinueOverlay).toBe(true));
    act(() => result.current.resumeAfterRejoin());
    expect(result.current.needsContinueOverlay).toBe(false);
    expect(client.resumeAfterRejoin).toHaveBeenCalledTimes(1);
  });

  it('does not show the rejoin overlay for a non-host user', () => {
    const client = createClient({ userId: 'player-user', wasAudioInterrupted: true });
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    expect(result.current.needsContinueOverlay).toBe(false);
  });

  it('tells the player to select again after stale background recovery is rejected', async () => {
    const client = createClient({
      lastRecoveredCommandRejection: {
        commandId: 'recovered-command',
        reason: 'action_step_changed',
      },
    });

    const firstMount = renderHook(() => useWerewolfRoom(client), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(mockShowErrorAlert).toHaveBeenCalledWith(
        '行动未提交',
        '当前行动步骤已变化，请重新选择',
      ),
    );
    expect(client.roomSession.acknowledgeRecoveredCommandRejection).toHaveBeenCalledWith(
      'recovered-command',
    );

    firstMount.unmount();
    renderHook(() => useWerewolfRoom(client), { wrapper: createWrapper() });
    await act(async () => undefined);

    expect(mockShowErrorAlert).toHaveBeenCalledTimes(1);
  });
});
