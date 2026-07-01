import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import { getRoomSeatPressResult } from '../roomSeatInteraction';

describe('getRoomSeatPressResult', () => {
  it('opens profile for occupied seats regardless of lifecycle', () => {
    expect(
      getRoomSeatPressResult({
        status: GameStatus.Ongoing,
        seat: 2,
        occupantUserId: 'u2',
        mySeat: 0,
        myUserId: 'u0',
      }),
    ).toEqual({ kind: 'VIEW_PROFILE', seat: 2, targetUserId: 'u2' });
  });

  it('opens enter operation for an empty setup seat', () => {
    expect(
      getRoomSeatPressResult({
        status: GameStatus.Unseated,
        seat: 1,
        occupantUserId: null,
        mySeat: null,
        myUserId: 'u0',
      }),
    ).toEqual({ kind: 'OPEN_SEAT_OPERATION', operationKind: 'enter', seat: 1 });
  });

  it('opens move operation when the player already has a seat', () => {
    expect(
      getRoomSeatPressResult({
        status: GameStatus.Seated,
        seat: 3,
        occupantUserId: null,
        mySeat: 0,
        myUserId: 'u0',
      }),
    ).toEqual({ kind: 'OPEN_SEAT_OPERATION', operationKind: 'move', seat: 3 });
  });

  it('requires auth before opening a seat operation', () => {
    expect(
      getRoomSeatPressResult({
        status: GameStatus.Unseated,
        seat: 1,
        occupantUserId: null,
        mySeat: null,
        myUserId: null,
      }),
    ).toEqual({ kind: 'AUTH_REQUIRED' });
  });

  it('locks empty seats outside setup lifecycle', () => {
    expect(
      getRoomSeatPressResult({
        status: GameStatus.Ongoing,
        seat: 1,
        occupantUserId: null,
        mySeat: 0,
        myUserId: 'u0',
      }),
    ).toEqual({ kind: 'NOOP', reason: 'seat_locked' });
  });
});
