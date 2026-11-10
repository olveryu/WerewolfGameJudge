import type {
  GameState,
  SheriffElectionState,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook, waitFor } from '@testing-library/react';

import { type ActiveWerewolfNotepadRoom, useNotepad } from '@/games/werewolf/hooks/useNotepad';
import {
  getWerewolfNotepadRoundId,
  readWerewolfNotepad,
  writeWerewolfNotepad,
} from '@/games/werewolf/services/notepadRepository';
import { createEmptyWerewolfNotepadState } from '@/games/werewolf/state/WerewolfNotepadState';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

function createGameState(
  restartNonce: string | undefined,
  sheriffElection?: SheriffElectionState,
): GameState {
  return buildWerewolfTestState({
    hostUserId: 'host-user',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer'],
    nightStep: { kind: 'inStep', stepId: 'wolfKill' },
    ...(restartNonce === undefined ? {} : { roleRevealRandomNonce: restartNonce }),
    ...(sheriffElection === undefined ? {} : { sheriffElection }),
  });
}

function createRoom(
  roomId: string,
  restartNonce: string | undefined,
  sheriffElection?: SheriffElectionState,
): ActiveWerewolfNotepadRoom {
  return { userId: 'user-1', roomId, gameState: createGameState(restartNonce, sheriffElection) };
}

describe('useNotepad', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists edits and never projects one room scope into another', async () => {
    const firstRoom = createRoom('room-1', 'round-a');
    const secondRoom = createRoom('room-2', 'round-a');
    const { result, rerender } = renderHook(
      ({ room }: { room: ActiveWerewolfNotepadRoom }) => useNotepad(room),
      { initialProps: { room: firstRoom } },
    );

    act(() => result.current.setNote(1, 'first room note'));
    await waitFor(() =>
      expect(
        readWerewolfNotepad(
          { userId: 'user-1', roomId: 'room-1' },
          getWerewolfNotepadRoundId('round-a'),
          2,
        ),
      ).toMatchObject({ kind: 'found', state: { playerNotes: { 1: 'first room note' } } }),
    );

    rerender({ room: secondRoom });
    expect(result.current.state).toEqual(createEmptyWerewolfNotepadState());
    act(() => result.current.setNote(2, 'second room note'));
    await waitFor(() =>
      expect(
        readWerewolfNotepad(
          { userId: 'user-1', roomId: 'room-2' },
          getWerewolfNotepadRoundId('round-a'),
          2,
        ),
      ).toMatchObject({ kind: 'found', state: { playerNotes: { 2: 'second room note' } } }),
    );

    act(() => result.current.clearAll());
    await waitFor(() =>
      expect(
        readWerewolfNotepad(
          { userId: 'user-1', roomId: 'room-2' },
          getWerewolfNotepadRoundId('round-a'),
          2,
        ),
      ).toEqual({ kind: 'missing' }),
    );
  });

  it('projects an empty state before clearing a stale round in an effect', async () => {
    const owner = { userId: 'user-1', roomId: 'room-1' };
    writeWerewolfNotepad(owner, getWerewolfNotepadRoundId('round-a'), 2, {
      ...createEmptyWerewolfNotepadState(),
      playerNotes: { 1: 'stale note' },
    });

    const { result } = renderHook(() => useNotepad(createRoom('room-1', 'round-b')));
    expect(result.current.state).toEqual(createEmptyWerewolfNotepadState());
    await waitFor(() =>
      expect(readWerewolfNotepad(owner, getWerewolfNotepadRoundId('round-b'), 2)).toEqual({
        kind: 'missing',
      }),
    );
  });

  it('keeps registrations private while the sheriff registration phase is active', () => {
    const { result } = renderHook(() =>
      useNotepad(
        createRoom('room-1', 'round-a', {
          phase: 'registration',
          registeredSeats: [0],
          withdrawnSeats: [],
          completedRounds: [],
        }),
      ),
    );

    expect(result.current.isSheriffCandidateStatusAuthoritative).toBe(false);
    expect(result.current.sheriffCandidateStatuses).toEqual({});

    act(() => result.current.toggleHand(1));
    expect(result.current.sheriffCandidateStatuses).toEqual({ 1: 'registered' });
  });

  it('projects published registrations and withdrawals with 1-based notepad seats', () => {
    const publishedElection: SheriffElectionState = {
      phase: 'candidateSpeech',
      registeredSeats: [0, 1],
      withdrawnSeats: [1],
      completedRounds: [],
      speakingStartSeat: 0,
      speakingDirection: 'clockwise',
    };
    const completedElection: SheriffElectionState = {
      phase: 'completed',
      registeredSeats: [0, 1],
      withdrawnSeats: [1],
      completedRounds: [],
    };
    const { result, rerender } = renderHook<
      ReturnType<typeof useNotepad>,
      { election: SheriffElectionState }
    >(({ election }) => useNotepad(createRoom('room-1', 'round-a', election)), {
      initialProps: { election: publishedElection },
    });

    expect(result.current.isSheriffCandidateStatusAuthoritative).toBe(true);
    expect(result.current.sheriffCandidateStatuses).toEqual({
      1: 'registered',
      2: 'withdrawn',
    });

    rerender({ election: completedElection });
    expect(result.current.sheriffCandidateStatuses).toEqual({
      1: 'registered',
      2: 'withdrawn',
    });
  });
});
