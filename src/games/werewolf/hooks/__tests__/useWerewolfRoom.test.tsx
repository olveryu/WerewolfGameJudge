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

import { useWerewolfRoom } from '@/games/werewolf/hooks/useWerewolfRoom';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { RoomLink } from '@/platform/realtime/types';
import { readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';

let mockAuthUserId = 'host-user';

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

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: '1234',
    hostUserId: 'host-user',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer'],
    players: {
      0: {
        seat: 0,
        role: 'wolf',
      },
    },
    roleViewedSeats: [0],
    roster: { 0: { seat: 0, userId: 'host-user', profile: { displayName: 'Host' } } },
    nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    isAudioPlaying: false,
    pendingAudioEffects: [],
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
): RoomLink<GameState, WerewolfPublicCommand> {
  const room = {
    roomCode: state.roomCode,
    roomId: 'room-id-1234',
    gameType: 'werewolf' as const,
    hostUserId: state.hostUserId,
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  };
  const snapshot = readyLinkSnapshot<GameState>({ room, userId }, createRoomSnapshot(state, 7));
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    connect: jest.fn(async () => undefined),
    dispatch: jest.fn(),
    retryNow: jest.fn(),
    close: jest.fn(),
  };
}

function createClient(options?: {
  readonly state?: GameState;
  readonly userId?: string;
  readonly wasAudioInterrupted?: boolean;
}): WerewolfGameClient {
  const state = options?.state ?? createGameState();
  const success = () => successfulRoomCommand(state);
  mockAuthUserId = options?.userId ?? 'host-user';
  return {
    roomSession: createRoomSession(state, mockAuthUserId),
    assignRoles: jest.fn(async () => success()),
    updateTemplate: jest.fn(async () => success()),
    startNight: jest.fn(async () => success()),
    abortGame: jest.fn(async () => success()),
    returnToLobby: jest.fn(async () => success()),
    redealGame: jest.fn(async () => success()),
    selectMvp: jest.fn(async () => success()),
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
    endSheriffElectionBySelfDestruct: jest.fn(async () => success()),
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
  it('derives identity, seat, role and revision from one room link', () => {
    const client = createClient();
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    expect(result.current.myUserId).toBe('host-user');
    expect(result.current.isHost).toBe(true);
    expect(result.current.mySeat).toBe(0);
    expect(result.current.myRole).toBe('wolf');
    expect(result.current.stateRevision).toBe(7);
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

  it('AU-39 golden: an unseated user derives myRole as null', () => {
    const client = createClient({ userId: 'player-user' });
    const { result } = renderHook(() => useWerewolfRoom(client), {
      wrapper: createWrapper(),
    });

    expect(result.current.mySeat).toBeNull();
    expect(result.current.myRole).toBeNull();
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
});

describe('useWerewolfRoom view model (AU-39)', () => {
  it('host controlling a wolf bot receives the bot view and sees the wolf pack', () => {
    const roles = ['villager', 'wolf', 'wolf'] as const;
    const state = createGameState({
      templateRoles: [...roles],
      players: {
        0: { seat: 0, role: 'villager' },
        1: { seat: 1, role: 'wolf' },
        2: { seat: 2, role: 'wolf' },
      },
      roleViewedSeats: [0, 1, 2],
      roster: {
        0: { seat: 0, userId: 'host-user', profile: { displayName: 'Host' } },
        1: { seat: 1, kind: 'bot' },
        2: { seat: 2, kind: 'bot' },
      },
      nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    });
    const client = createClient({ state });
    const { result } = renderHook(() => useWerewolfRoom(client), { wrapper: createWrapper() });

    // Own view: the host is a villager and cannot see the wolf pack.
    expect(result.current.viewModel.mySeat).toBe(0);
    expect(result.current.viewModel.wolfPackSeats).toBeNull();

    act(() => result.current.takeOverBot(1));

    // Controlled view: the projection is rebuilt for the bot seat — the
    // host now sees through the wolf bot (pack visible), while myRole
    // keeps its own-seat meaning (the host's real identity).
    expect(result.current.effectiveSeat).toBe(1);
    expect(result.current.viewModel.mySeat).toBe(1);
    expect(result.current.viewModel.myRole).toBe('wolf');
    expect(result.current.viewModel.wolfPackSeats).toEqual([1, 2]);
    expect(result.current.myRole).toBe('villager');

    act(() => result.current.releaseBot());
    expect(result.current.viewModel.wolfPackSeats).toBeNull();
  });
});
