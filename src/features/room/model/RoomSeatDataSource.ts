/** Lazy seat data consumed by the shared room board. */

export type RoomSeatHighlight = 'none' | 'danger' | 'selected' | 'controlled';

export interface RoomSeatStatusBadge {
  readonly label: string;
  readonly tone: 'primary' | 'info' | 'success' | 'warning' | 'muted' | 'danger';
}

export interface RoomSeatPlayer {
  readonly kind: 'human' | 'bot';
  readonly userId: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly seatAnimation?: string;
  readonly nameStyle?: string;
  readonly seatPetId?: string;
  readonly level?: number;
  readonly isAnonymous: boolean;
}

export interface RoomSeatViewModel {
  readonly seat: number;
  readonly player: RoomSeatPlayer | null;
  readonly isSelf: boolean;
  readonly highlight: RoomSeatHighlight;
  readonly secondaryLabel: string | null;
  readonly disabledReason?: string;
  readonly showReadyBadge: boolean;
  readonly statusBadge: RoomSeatStatusBadge | null;
  readonly isStatusEmphasized: boolean;
  readonly showLevel: boolean;
  readonly decorationsEnabled: boolean;
}

/**
 * Index-addressable source. The board asks only for seats in rendered rows, so a game does not
 * need to allocate an array proportional to its configured player count.
 */
export interface RoomSeatDataSource {
  readonly count: number;
  readonly revision: string | number;
  getSeat(index: number): RoomSeatViewModel;
}

export function formatRoomSeat(seat: number): string {
  if (!Number.isSafeInteger(seat) || seat < 0) {
    throw new Error(`Invalid zero-based seat index: ${seat}`);
  }
  return `${seat + 1}号`;
}
