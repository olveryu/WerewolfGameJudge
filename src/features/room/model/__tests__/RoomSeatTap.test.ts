import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';

describe('getRoomSeatTapIntent', () => {
  it('gives a disabled reason priority over every seat target', () => {
    expect(
      getRoomSeatTapIntent({
        seat: 2,
        currentSeat: 0,
        target: { userId: 'user-2' },
        disabledReason: '当前座位不可操作',
      }),
    ).toEqual({ kind: 'blocked', reason: '当前座位不可操作' });
  });

  it('opens the supplied profile target for any occupied seat', () => {
    const target = { userId: 'bot-2', occupantKind: 'bot' as const };

    expect(getRoomSeatTapIntent({ seat: 2, currentSeat: null, target })).toEqual({
      kind: 'profile',
      target,
    });
  });

  it('takes an empty seat when the current user is unseated', () => {
    expect(getRoomSeatTapIntent({ seat: 3, currentSeat: null, target: null })).toEqual({
      kind: 'take',
      seat: 3,
    });
  });

  it('moves to an empty seat when the current user is already seated', () => {
    expect(getRoomSeatTapIntent({ seat: 3, currentSeat: 0, target: null })).toEqual({
      kind: 'move',
      seat: 3,
    });
  });

  it('rejects invalid seat indexes instead of producing an executable intent', () => {
    expect(() => getRoomSeatTapIntent({ seat: -1, currentSeat: null, target: null })).toThrow(
      'Room seat tap must use a non-negative safe integer',
    );
  });
});
