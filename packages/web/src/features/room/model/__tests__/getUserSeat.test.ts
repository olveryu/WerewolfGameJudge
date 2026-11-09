import { getUserSeat, type UserSeatOccupant } from '../getUserSeat';

function seats(
  ...occupants: (UserSeatOccupant | undefined)[]
): Record<number, UserSeatOccupant | undefined> {
  const record: Record<number, UserSeatOccupant | undefined> = {};
  occupants.forEach((occupant, index) => {
    record[index] = occupant;
  });
  return record;
}

describe('getUserSeat', () => {
  it('returns the seat of the matching user', () => {
    const realSeats = seats({ userId: 'a', seat: 0 }, { userId: 'b', seat: 1 });
    expect(getUserSeat(realSeats, 'b')).toBe(1);
  });

  it('returns null when the user is not seated', () => {
    const realSeats = seats({ userId: 'a', seat: 0 });
    expect(getUserSeat(realSeats, 'missing')).toBeNull();
  });

  it('skips empty seats (undefined / null)', () => {
    const realSeats: Record<number, UserSeatOccupant | null | undefined> = {
      0: undefined,
      1: null,
      2: { userId: 'c', seat: 2 },
    };
    expect(getUserSeat(realSeats, 'c')).toBe(2);
  });

  it('returns null for an empty seat map', () => {
    expect(getUserSeat({}, 'a')).toBeNull();
  });
});
