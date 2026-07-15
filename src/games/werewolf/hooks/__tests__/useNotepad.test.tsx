import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { type ActiveWerewolfNotepadRoom, useNotepad } from '@/games/werewolf/hooks/useNotepad';
import {
  getWerewolfNotepadRoundId,
  readWerewolfNotepad,
  writeWerewolfNotepad,
} from '@/games/werewolf/services/notepadRepository';
import { createEmptyWerewolfNotepadState } from '@/games/werewolf/state/WerewolfNotepadState';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

function createGameState(restartNonce: string | undefined): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: '1234',
    hostUserId: 'host-user',
    status: GameStatus.Ongoing,
    templateRoles: ['wolf', 'seer'],
    players: {},
    roster: {},
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    ...(restartNonce === undefined ? {} : { roleRevealRandomNonce: restartNonce }),
  };
}

function createRoom(roomId: string, restartNonce: string | undefined): ActiveWerewolfNotepadRoom {
  return { userId: 'user-1', roomId, gameState: createGameState(restartNonce) };
}

describe('useNotepad', () => {
  beforeEach(() => {
    mockStoredValues.clear();
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
});
