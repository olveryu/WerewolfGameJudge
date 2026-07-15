import {
  clearWerewolfNotepad,
  getWerewolfNotepadRoundId,
  getWerewolfNotepadStorageKey,
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

const ROOM_ID = 'room-instance-1234';
const OWNER = { userId: 'user-1', roomId: ROOM_ID };
const ROUND_ID = getWerewolfNotepadRoundId('round-a');
const SEAT_COUNT = 12;

describe('notepadRepository', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('round-trips a strict room-instance-scoped state', () => {
    const state = {
      ...createEmptyWerewolfNotepadState(),
      playerNotes: { 1: '第一轮发言' },
      handStates: { 1: true },
      roleGuesses: { 1: 'seer' as const },
    };

    writeWerewolfNotepad(OWNER, ROUND_ID, SEAT_COUNT, state);

    expect(getWerewolfNotepadStorageKey(OWNER)).toBe(`@werewolf:notepad:user-1:${ROOM_ID}`);
    expect(readWerewolfNotepad(OWNER, ROUND_ID, SEAT_COUNT)).toEqual({ kind: 'found', state });
  });

  it('marks a prior round as stale without exposing its notes', () => {
    writeWerewolfNotepad(OWNER, getWerewolfNotepadRoundId('round-a'), SEAT_COUNT, {
      ...createEmptyWerewolfNotepadState(),
      publicNoteLeft: 'old round',
    });

    const nextRound = getWerewolfNotepadRoundId('round-b');
    expect(readWerewolfNotepad(OWNER, nextRound, SEAT_COUNT)).toEqual({ kind: 'stale' });
    clearWerewolfNotepad(OWNER);
    expect(readWerewolfNotepad(OWNER, nextRound, SEAT_COUNT)).toEqual({ kind: 'missing' });
  });

  it('isolates the same room instance between users', () => {
    writeWerewolfNotepad(OWNER, ROUND_ID, SEAT_COUNT, {
      ...createEmptyWerewolfNotepadState(),
      publicNoteLeft: 'user one',
    });

    expect(
      readWerewolfNotepad({ userId: 'user-2', roomId: ROOM_ID }, ROUND_ID, SEAT_COUNT),
    ).toEqual({ kind: 'missing' });
  });

  it.each([
    [
      'the removed unversioned shape',
      {
        ...createEmptyWerewolfNotepadState(),
        publicNote: 'legacy',
      },
    ],
    [
      'unknown fields',
      {
        version: 1,
        roundId: ROUND_ID,
        state: { ...createEmptyWerewolfNotepadState(), extra: true },
      },
    ],
    [
      'an invalid role ID',
      {
        version: 1,
        roundId: ROUND_ID,
        state: { ...createEmptyWerewolfNotepadState(), roleGuesses: { 1: 'not-a-role' } },
      },
    ],
    [
      'an out-of-range seat key',
      {
        version: 1,
        roundId: ROUND_ID,
        state: { ...createEmptyWerewolfNotepadState(), playerNotes: { 13: 'invalid' } },
      },
    ],
  ])('fails fast for %s', (_label, stored) => {
    mockStoredValues.set(getWerewolfNotepadStorageKey(OWNER), JSON.stringify(stored));
    expect(() => readWerewolfNotepad(OWNER, ROUND_ID, SEAT_COUNT)).toThrow();
  });

  it('rejects invalid owner, nonce, and seat-count input', () => {
    expect(() => getWerewolfNotepadStorageKey({ userId: '', roomId: ROOM_ID })).toThrow(
      'user ID must not be empty',
    );
    expect(() => getWerewolfNotepadRoundId('')).toThrow('restart nonce must not be empty');
    expect(() => readWerewolfNotepad(OWNER, ROUND_ID, 0)).toThrow(
      'seat count must be a positive safe integer',
    );
  });
});
