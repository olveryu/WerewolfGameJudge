import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { WEREWOLF_STATE_IDENTITY, type WerewolfPublicCommand } from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type React from 'react';

import type { RoomSessionClient } from '@/features/room/session/types';
import { useWerewolfRoom } from '@/games/werewolf/hooks/useWerewolfRoom';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { WerewolfGameProvider } from '@/games/werewolf/runtime/WerewolfGameContext';

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
    ...overrides,
  };
}

function createRoomSession(
  state: GameState,
  userId: string,
): RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent> {
  const room = {
    roomCode: state.roomCode,
    roomId: 'room-id-1234',
    gameType: 'werewolf' as const,
    hostUserId: state.hostUserId,
    createdAt: new Date('2026-07-11T12:00:00.000Z'),
  };
  const snapshot = {
    phase: 'ready' as const,
    epoch: 1,
    identity: { room, userId },
    connection: 'live' as const,
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
    setUserEventHandler: jest.fn(() => () => undefined),
  } as unknown as WerewolfGameClient['roomSession'];
}

function createFacade(options?: {
  readonly state?: GameState;
  readonly userId?: string;
  readonly wasAudioInterrupted?: boolean;
}): WerewolfGameClient {
  const state = options?.state ?? createGameState();
  mockAuthUserId = options?.userId ?? 'host-user';
  return {
    roomSession: createRoomSession(state, mockAuthUserId),
    assignRoles: jest.fn(async () => ({ success: true })),
    updateTemplate: jest.fn(async () => ({ success: true })),
    startNight: jest.fn(async () => ({ success: true })),
    restartGame: jest.fn(async () => ({ success: true })),
    markAllBotsViewed: jest.fn(async () => ({ success: true })),
    markAllBotsGroupConfirmed: jest.fn(async () => ({ success: true })),
    updatePlayerProfile: jest.fn(async () => ({ success: true })),
    shareNightReview: jest.fn(async () => ({ success: true })),
    boardNominate: jest.fn(async () => ({ success: true })),
    boardUpvote: jest.fn(async () => ({ success: true })),
    boardWithdraw: jest.fn(async () => ({ success: true })),
    markViewedRole: jest.fn(async () => ({ success: true })),
    submitAction: jest.fn(async () => ({ success: true })),
    submitRevealAck: jest.fn(async () => ({ success: true })),
    submitGroupConfirmAck: jest.fn(async () => ({ success: true })),
    sendWolfRobotHunterStatusViewed: jest.fn(async () => ({ success: true })),
    setAudioPlaying: jest.fn(async () => ({ success: true })),
    postProgression: jest.fn(async () => ({ success: true })),
    wasAudioInterrupted: options?.wasAudioInterrupted ?? false,
    resumeAfterRejoin: jest.fn(async () => undefined),
  } as unknown as WerewolfGameClient;
}

function createWrapper(facade: WerewolfGameClient): React.FC<React.PropsWithChildren> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <WerewolfGameProvider client={facade}>{children}</WerewolfGameProvider>
    </QueryClientProvider>
  );
  Wrapper.displayName = 'WerewolfRoomTestWrapper';
  return Wrapper;
}

describe('useWerewolfRoom shared-session composition', () => {
  it('derives identity, seat, role, revision, and connection from one room session', () => {
    const facade = createFacade();
    const { result } = renderHook(() => useWerewolfRoom(), {
      wrapper: createWrapper(facade),
    });

    expect(result.current.myUserId).toBe('host-user');
    expect(result.current.isHost).toBe(true);
    expect(result.current.mySeat).toBe(0);
    expect(result.current.myRole).toBe('wolf');
    expect(result.current.stateRevision).toBe(7);
    expect(result.current.connectionStatus).toBe('live');
  });

  it('does not infer host authority from the snapshot when the active user is a player', () => {
    const facade = createFacade({ userId: 'player-user' });
    const { result } = renderHook(() => useWerewolfRoom(), {
      wrapper: createWrapper(facade),
    });

    expect(result.current.isHost).toBe(false);
    expect(result.current.mySeat).toBeNull();
  });

  it('shows the rejoin overlay only for an interrupted host session', async () => {
    const facade = createFacade({ wasAudioInterrupted: true });
    const { result } = renderHook(() => useWerewolfRoom(), {
      wrapper: createWrapper(facade),
    });

    await waitFor(() => expect(result.current.needsContinueOverlay).toBe(true));
    act(() => result.current.resumeAfterRejoin());
    expect(result.current.needsContinueOverlay).toBe(false);
    expect(facade.resumeAfterRejoin).toHaveBeenCalledTimes(1);
  });

  it('does not show the rejoin overlay for a non-host user', () => {
    const facade = createFacade({ userId: 'player-user', wasAudioInterrupted: true });
    const { result } = renderHook(() => useWerewolfRoom(), {
      wrapper: createWrapper(facade),
    });

    expect(result.current.needsContinueOverlay).toBe(false);
  });
});
