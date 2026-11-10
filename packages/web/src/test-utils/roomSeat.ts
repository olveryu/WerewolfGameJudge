/** Seat view-model fixtures for shared room UI tests. */
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';

/** An occupied human seat named 「玩家N」; pass `isBot` for a bot, `player: null` for empty. */
export function seatViewModel(
  index: number,
  overrides: Partial<RoomSeatViewModel> & { readonly isBot?: boolean } = {},
): RoomSeatViewModel {
  const { isBot = false, ...rest } = overrides;
  return {
    seat: index,
    player: {
      occupant: isBot ? { kind: 'bot', seat: index } : { kind: 'human', userId: `user-${index}` },
      displayName: `玩家${index + 1}`,
      isAnonymous: false,
    },
    isSelf: false,
    highlight: 'none',
    secondaryLabel: null,
    showReadyBadge: false,
    statusBadge: null,
    indicators: null,
    isStatusEmphasized: false,
    showLevel: false,
    decorationsEnabled: false,
    ...rest,
  };
}

export function seatSource(seats: readonly RoomSeatViewModel[]): RoomSeatDataSource {
  return {
    count: seats.length,
    revision: 0,
    getSeat: (index) => {
      const found = seats[index];
      if (found === undefined) throw new Error(`No seat fixture at index ${index}`);
      return found;
    },
  };
}
