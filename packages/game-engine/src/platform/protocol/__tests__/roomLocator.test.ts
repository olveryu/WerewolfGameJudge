import { parseRoomId, parseRoomLocator } from '../roomLocator';

describe('room locator protocol', () => {
  it('parses one immutable room locator', () => {
    expect(parseRoomLocator({ roomCode: '4722', roomId: 'do-id' })).toEqual({
      roomCode: '4722',
      roomId: 'do-id',
    });
  });

  it.each([
    null,
    { roomCode: '4722' },
    { roomCode: '4722', roomId: '' },
    { roomCode: '0472', roomId: 'do-id' },
    { roomCode: '4722', roomId: 'do-id', creationId: 'creation-id' },
  ])('rejects malformed locator %p', (value) => {
    expect(() => parseRoomLocator(value)).toThrow();
  });

  it('rejects a non-string room ID', () => {
    expect(() => parseRoomId(42)).toThrow('Room ID must be a non-empty string');
  });
});
