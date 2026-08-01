import {
  addRecentRoom,
  clearRecentRooms,
  getRecentRooms,
  removeRecentRoom,
} from '@/features/room/services/recentRooms';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

const USER_ID = 'user-1';
const STORAGE_KEY = '@room:recent:user-1';

function room(roomCode: string, roomId = `room-${roomCode}`) {
  return { roomCode, roomId, gameType: 'werewolf' as const };
}

describe('recentRooms', () => {
  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('stores five immutable room identities in newest-first order', () => {
    for (const roomCode of ['1234', '2345', '3456', '4567', '5678', '6789']) {
      addRecentRoom(USER_ID, room(roomCode));
    }
    addRecentRoom(USER_ID, room('4567'));

    expect(getRecentRooms(USER_ID).map(({ roomCode }) => roomCode)).toEqual([
      '4567',
      '6789',
      '5678',
      '3456',
      '2345',
    ]);
  });

  it('replaces an older room instance when its public code is reused', () => {
    addRecentRoom(USER_ID, room('1234', 'old-instance'));
    addRecentRoom(USER_ID, { ...room('1234', 'new-instance'), gameType: 'fibking' });

    expect(getRecentRooms(USER_ID)).toEqual([
      { roomCode: '1234', roomId: 'new-instance', gameType: 'fibking' },
    ]);
  });

  it('isolates users and removes one exact room instance', () => {
    addRecentRoom(USER_ID, room('1234'));
    addRecentRoom('user-2', room('2345'));

    removeRecentRoom(USER_ID, 'room-1234');
    expect(getRecentRooms(USER_ID)).toEqual([]);
    expect(getRecentRooms('user-2')).toEqual([room('2345')]);
    clearRecentRooms('user-2');
    expect(getRecentRooms('user-2')).toEqual([]);
  });

  it.each([
    ['an old unversioned array', JSON.stringify(['1234'])],
    ['too many entries', JSON.stringify({ version: 1, rooms: Array(6).fill(room('1234')) })],
    [
      'duplicate room IDs',
      JSON.stringify({
        version: 1,
        rooms: [room('1234', 'same-id'), room('2345', 'same-id')],
      }),
    ],
    [
      'duplicate room codes',
      JSON.stringify({
        version: 1,
        rooms: [room('1234', 'first-id'), room('1234', 'second-id')],
      }),
    ],
    [
      'an invalid game type',
      JSON.stringify({
        version: 1,
        rooms: [{ roomCode: '1234', roomId: 'room-id', gameType: 'unknown' }],
      }),
    ],
  ])('fails fast for %s', (_label, raw) => {
    mockStoredValues.set(STORAGE_KEY, raw);
    expect(() => getRecentRooms(USER_ID)).toThrow();
  });
});
