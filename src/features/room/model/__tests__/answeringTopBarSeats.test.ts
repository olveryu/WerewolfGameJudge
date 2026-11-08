/**
 * The answering-top-bar seat projection: one entry per occupied seat,
 * submitted read off the badge tone, initials and colours by seat order.
 */

import { ANSWERING_TOP_BAR_SEAT_COLORS, getAnsweringTopBarSeats } from '../answeringTopBarSeats';
import type { RoomSeatDataSource, RoomSeatViewModel } from '../RoomSeatDataSource';

type SeatSpec = {
  readonly displayName: string | null;
  readonly tone: 'success' | 'warning' | 'info' | null;
};

function source(specs: readonly SeatSpec[]): RoomSeatDataSource {
  return {
    count: specs.length,
    revision: 'test',
    getSeat: (index: number): RoomSeatViewModel => {
      const spec = specs[index]!;
      return {
        seat: index,
        player:
          spec.displayName === null
            ? null
            : {
                occupant: { kind: 'human', userId: `user-${index}` },
                displayName: spec.displayName,
                isAnonymous: false,
              },
        isSelf: false,
        highlight: 'none',
        secondaryLabel: null,
        showReadyBadge: false,
        statusBadge: spec.tone === null ? null : { label: '', tone: spec.tone },
        indicators: null,
        isStatusEmphasized: false,
        showLevel: false,
        decorationsEnabled: false,
      };
    },
  };
}

describe('getAnsweringTopBarSeats', () => {
  it('skips seats with no player and keeps the occupied seats in seat order', () => {
    const seats = getAnsweringTopBarSeats(
      source([
        { displayName: 'JY', tone: 'success' },
        { displayName: null, tone: null },
        { displayName: '文森特', tone: 'warning' },
      ]),
    );
    expect(seats.map((seat) => seat.displayName)).toEqual(['JY', '文森特']);
  });

  it('marks a seat submitted only when its badge tone is success', () => {
    const seats = getAnsweringTopBarSeats(
      source([
        { displayName: 'a', tone: 'success' },
        { displayName: 'b', tone: 'warning' },
        { displayName: 'c', tone: 'info' },
        { displayName: 'd', tone: null },
      ]),
    );
    expect(seats.map((seat) => seat.submitted)).toEqual([true, false, false, false]);
  });

  it('takes the first two letters for ASCII names and the first character otherwise', () => {
    const seats = getAnsweringTopBarSeats(
      source([
        { displayName: 'JY', tone: 'warning' },
        { displayName: 'Jo', tone: 'warning' },
        { displayName: 'J', tone: 'warning' },
        { displayName: 'J1', tone: 'warning' },
        { displayName: '文森特', tone: 'warning' },
        { displayName: '匿名玩家', tone: 'warning' },
      ]),
    );
    expect(seats.map((seat) => seat.initial)).toEqual(['JY', 'JO', 'J', 'J', '文', '匿']);
  });

  it('cycles the palette by seat number and wraps after the sixth seat', () => {
    const seats = getAnsweringTopBarSeats(
      source(
        Array.from({ length: 7 }, (_, index) => ({
          displayName: `p${index}`,
          tone: 'warning' as const,
        })),
      ),
    );
    expect(seats.map((seat) => seat.color)).toEqual([
      ...ANSWERING_TOP_BAR_SEAT_COLORS,
      ANSWERING_TOP_BAR_SEAT_COLORS[0],
    ]);
  });

  it('colours by seat number, not by position in the occupied list', () => {
    const seats = getAnsweringTopBarSeats(
      source([
        { displayName: null, tone: null },
        { displayName: 'JY', tone: 'warning' },
      ]),
    );
    expect(seats).toHaveLength(1);
    expect(seats[0]!.color).toBe(ANSWERING_TOP_BAR_SEAT_COLORS[1]);
  });
});
