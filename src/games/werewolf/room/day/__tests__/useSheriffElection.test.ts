/** Sheriff-election command orchestration over the room's single-flight submit. */

import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import { useSheriffElection } from '@/games/werewolf/room/day/useSheriffElection';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

const mockShowConfirmAlert = jest.fn<boolean, [string, string, () => void | Promise<void>]>(
  () => true,
);
const mockShowDestructiveAlert = jest.fn<
  boolean,
  [string, string, string, () => void | Promise<void>]
>(() => true);
jest.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: (...args: [string, string, () => void | Promise<void>]) =>
    mockShowConfirmAlert(...args),
  showDestructiveAlert: (...args: [string, string, string, () => void | Promise<void>]) =>
    mockShowDestructiveAlert(...args),
}));

function dayState(sheriffElection: GameState['sheriffElection']): GameState {
  return buildWerewolfTestState({
    status: GameStatus.Day,
    rules: { isSheriffElectionEnabled: true },
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'seer' },
    },
    roleViewedSeats: [0, 1],
    roster: {
      0: { seat: 0, userId: 'host-1', profile: { displayName: 'Host' } },
      1: { seat: 1, userId: 'user-1', profile: { displayName: 'Player' } },
    },
    currentNightResults: {},
    lastNightDeaths: [],
    sheriffElection,
  });
}

const REGISTRATION: GameState['sheriffElection'] = {
  phase: 'registration',
  registeredSeats: [],
  withdrawnSeats: [],
  completedRounds: [],
};

function createDeferred() {
  let resolvePromise!: (value: boolean) => void;
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

type SubmitMock = jest.Mock<Promise<boolean>, [string, WerewolfPublicCommand]>;

function submitMock(impl: () => Promise<boolean> = () => Promise.resolve(true)): SubmitMock {
  return jest.fn<Promise<boolean>, [string, WerewolfPublicCommand]>(impl);
}

function renderElection(gameState: GameState, submit: SubmitMock = submitMock()) {
  const hook = renderHook(() =>
    useSheriffElection({ gameState, effectiveSeat: 0, isHost: true, submit }),
  );
  return { ...hook, submit };
}

beforeEach(() => jest.clearAllMocks());

describe('useSheriffElection', () => {
  it('returns null when no authoritative election exists', () => {
    const { result } = renderElection(buildWerewolfTestState());
    expect(result.current).toBeNull();
  });

  it('tracks the exact pending vote and clears it after the submit settles', async () => {
    const deferred = createDeferred();
    const submit = submitMock(() => deferred.promise);
    const { result } = renderElection(
      dayState({
        phase: 'firstVote',
        registeredSeats: [0],
        withdrawnSeats: [],
        completedRounds: [],
        candidateSeats: [0],
        eligibleVoterSeats: [1],
        ballots: {},
      }),
      submit,
    );

    let votePromise!: Promise<void>;
    act(() => {
      votePromise = result.current!.vote(0);
    });
    expect(result.current?.pendingAction).toEqual({ kind: 'vote', targetSeat: 0 });
    expect(submit).toHaveBeenCalledWith('竞选投票', {
      type: 'werewolf.sheriff.vote',
      targetSeat: 0,
    });

    deferred.resolve(true);
    await act(async () => votePromise);
    expect(result.current?.pendingAction).toBeNull();
  });

  it('routes each action to its command', async () => {
    const { result, submit } = renderElection(dayState(REGISTRATION));
    await act(() => result.current!.register());
    await act(() => result.current!.cancelRegistration());
    await act(() => result.current!.withdraw());
    expect(submit.mock.calls.map(([label, command]) => [label, command.type])).toEqual([
      ['报名上警', 'werewolf.sheriff.register'],
      ['取消报名', 'werewolf.sheriff.cancelRegistration'],
      ['退水', 'werewolf.sheriff.withdraw'],
    ]);
  });

  it('asks before closing registration and dispatches only on confirm', async () => {
    mockShowConfirmAlert.mockImplementation(() => true);
    const { result, submit } = renderElection(dayState(REGISTRATION));
    act(() => result.current!.requestAdvance());
    expect(mockShowConfirmAlert).toHaveBeenCalledWith(
      '结束报名？',
      '结束后，未报名的玩家不能再参选。',
      expect.any(Function),
    );
    expect(submit).not.toHaveBeenCalled();
    const [, , onConfirm] = mockShowConfirmAlert.mock.calls[0]!;
    await act(async () => onConfirm());
    expect(submit).toHaveBeenCalledWith('推进竞选', { type: 'werewolf.sheriff.advance' });
  });

  it('advances directly without a confirm outside registration', async () => {
    const { result, submit } = renderElection(
      dayState({
        phase: 'candidateSpeech',
        registeredSeats: [0],
        withdrawnSeats: [],
        completedRounds: [],
        speakingStartSeat: 0,
        speakingDirection: 'clockwise',
      }),
    );
    await act(async () => result.current!.requestAdvance());
    expect(mockShowConfirmAlert).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith('推进竞选', { type: 'werewolf.sheriff.advance' });
  });

  it('explains table rules before ending the election by self-destruct', async () => {
    const { result, submit } = renderElection(
      dayState({
        phase: 'candidateSpeech',
        registeredSeats: [0],
        withdrawnSeats: [],
        completedRounds: [],
        speakingStartSeat: 0,
        speakingDirection: 'clockwise',
      }),
    );
    act(() => result.current!.requestEndBySelfDestruct());
    expect(mockShowDestructiveAlert).toHaveBeenCalledWith(
      '确认结束警长竞选？',
      expect.stringContaining('应用不判断或记录自爆次数'),
      '确认结束',
      expect.any(Function),
    );
    const [, , , onConfirm] = mockShowDestructiveAlert.mock.calls[0]!;
    await act(async () => onConfirm());
    expect(submit).toHaveBeenCalledWith('自爆结束竞选', {
      type: 'werewolf.sheriff.endBySelfDestruct',
    });
  });

  it('releases the pending action even when the submit throws', async () => {
    const submit = submitMock(() => Promise.reject(new Error('session closed')));
    const { result } = renderElection(dayState(REGISTRATION), submit);
    await act(async () => {
      await expect(result.current!.register()).rejects.toThrow('session closed');
    });
    expect(result.current?.pendingAction).toBeNull();
  });
});
