/** Tests for sheriff-election command orchestration and submission cleanup. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { useSheriffElection } from '@/games/werewolf/room/hooks/useSheriffElection';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

const mockHandleError = jest.fn();
const mockShowDestructiveAlert = jest.fn<
  boolean,
  [string, string, string, () => void | Promise<void>]
>(() => true);
jest.mock('@/utils/errorPipeline', () => ({
  handleError: (...args: unknown[]) => {
    mockHandleError(...args);
  },
}));
jest.mock('@/utils/alertPresets', () => ({
  showDestructiveAlert: (...args: [string, string, string, () => void | Promise<void>]) =>
    mockShowDestructiveAlert(...args),
}));

function createDayState() {
  const state = buildWerewolfTestState({
    status: GameStatus.Day,
    rules: { isSheriffElectionEnabled: true },
    players: {
      0: { userId: 'host-1', seat: 0, role: 'wolf', hasViewedRole: true },
      1: { userId: 'user-1', seat: 1, role: 'seer', hasViewedRole: true },
    },
    roster: {
      'host-1': { displayName: 'Host' },
      'user-1': { displayName: 'Player' },
    },
    sheriffElection: {
      phase: 'registration',
      registeredSeats: [],
      withdrawnSeats: [],
      completedRounds: [],
    },
  });
  return { protocol: state, local: toWerewolfLocalState(state) };
}

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

type HookInput = Parameters<typeof useSheriffElection>[0];

function createInput(overrides: Partial<HookInput> = {}): HookInput {
  const { protocol, local } = createDayState();
  const success = () => Promise.resolve(successfulRoomCommand(protocol));
  return {
    gameState: local,
    effectiveSeat: 0,
    isHost: true,
    isAudioPlaying: false,
    registerSheriffCandidate: jest.fn(success),
    cancelSheriffRegistration: jest.fn(success),
    withdrawSheriffCandidate: jest.fn(success),
    castSheriffVote: jest.fn(success),
    advanceSheriffElection: jest.fn(success),
    endSheriffElectionBySelfDestruct: jest.fn(success),
    ...overrides,
  };
}

describe('useSheriffElection', () => {
  beforeEach(() => {
    mockHandleError.mockClear();
    mockShowDestructiveAlert.mockClear();
  });

  it('returns null when no authoritative election exists', () => {
    const state = buildWerewolfTestState();
    const input = createInput({ gameState: toWerewolfLocalState(state) });

    const { result } = renderHook(() => useSheriffElection(input));

    expect(result.current).toBeNull();
  });

  it('disables panel interaction while authoritative audio is playing', () => {
    const input = createInput({ isAudioPlaying: true });

    const { result } = renderHook(() => useSheriffElection(input));

    expect(result.current?.isInteractionDisabled).toBe(true);
  });

  it('tracks the exact pending vote and clears it after the command settles', async () => {
    const deferred = createDeferred<ReturnType<typeof successfulRoomCommand<GameState>>>();
    const castSheriffVote = jest.fn(() => deferred.promise);
    const registrationInput = createInput({ castSheriffVote });
    const votingState: GameState = {
      ...createDayState().protocol,
      sheriffElection: {
        phase: 'firstVote',
        registeredSeats: [0],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0],
        eligibleVoterSeats: [1],
        ballots: {},
      },
    };
    const input = { ...registrationInput, gameState: toWerewolfLocalState(votingState) };
    const { result } = renderHook(() => useSheriffElection(input));

    let votePromise!: Promise<void>;
    act(() => {
      votePromise = result.current!.vote(0);
    });
    expect(result.current?.pendingAction).toEqual({ kind: 'vote', targetSeat: 0 });
    expect(castSheriffVote).toHaveBeenCalledWith(0);

    deferred.resolve(successfulRoomCommand(votingState));
    await act(async () => votePromise);

    expect(result.current?.pendingAction).toBeNull();
  });

  it('routes registration cancellation through its dedicated command', async () => {
    const deferred = createDeferred<ReturnType<typeof successfulRoomCommand<GameState>>>();
    const cancelSheriffRegistration = jest.fn(() => deferred.promise);
    const input = createInput({ cancelSheriffRegistration });
    const { result } = renderHook(() => useSheriffElection(input));

    let cancelPromise!: Promise<void>;
    act(() => {
      cancelPromise = result.current!.cancelRegistration();
    });
    expect(result.current?.pendingAction).toEqual({ kind: 'cancelRegistration' });
    expect(cancelSheriffRegistration).toHaveBeenCalledTimes(1);

    deferred.resolve(successfulRoomCommand(createDayState().protocol));
    await act(async () => cancelPromise);
    expect(result.current?.pendingAction).toBeNull();
  });

  it('explains table rules before ending the election by self-destruct', async () => {
    const endSheriffElectionBySelfDestruct = jest.fn(async () =>
      successfulRoomCommand(createDayState().protocol),
    );
    const input = createInput({ endSheriffElectionBySelfDestruct });
    const { result } = renderHook(() => useSheriffElection(input));

    act(() => result.current!.requestEndBySelfDestruct());

    expect(mockShowDestructiveAlert).toHaveBeenCalledWith(
      '确认结束警长竞选？',
      '确认后，本次警长竞选将直接结束且不产生警长。单爆、双爆，以及单爆后是否在下一天退水并直接投票，请按本局规则线下决定；应用不判断或记录自爆次数。',
      '确认结束',
      expect.any(Function),
    );
    const confirmSelfDestruct = mockShowDestructiveAlert.mock.calls[0]?.[3];
    if (confirmSelfDestruct === undefined) throw new Error('Expected self-destruct confirmation');
    await act(async () => confirmSelfDestruct());
    expect(endSheriffElectionBySelfDestruct).toHaveBeenCalledTimes(1);
  });

  it('reports unexpected command errors and always releases the mutex', async () => {
    const input = createInput({
      registerSheriffCandidate: jest.fn(async () => {
        throw new Error('session closed');
      }),
    });
    const { result } = renderHook(() => useSheriffElection(input));

    await act(() => result.current!.register());

    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'session closed' }),
      expect.objectContaining({ label: '报名上警', alertMessage: '报名上警失败，请重试' }),
    );
    expect(result.current?.pendingAction).toBeNull();
  });
});
