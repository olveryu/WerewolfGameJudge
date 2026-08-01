import { isRoomCode, parseRoomCode } from '../roomCode';

describe('roomCode', () => {
  it('accepts exactly four digits without a leading zero', () => {
    expect(isRoomCode('1000')).toBe(true);
    expect(isRoomCode('9999')).toBe(true);
  });

  it.each(['0000', '0123', '999', '10000', 'ROOM', 1234, null])('rejects %p', (value) => {
    expect(isRoomCode(value)).toBe(false);
    expect(() => parseRoomCode(value)).toThrow('Invalid room code');
  });
});
