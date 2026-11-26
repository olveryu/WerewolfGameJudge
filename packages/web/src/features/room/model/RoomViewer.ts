/**
 * Room viewer identity: the one declaration of who is looking at the room.
 *
 * Host ownership and participation are independent. Most games identify
 * participants by seat; a game without numbered seats may explicitly mark
 * an account as a participant instead. Bot takeover is not identity — it
 * lives on the shell's `controlledSeat` and widens the effective seat.
 *
 * `RoomViewerAudience` is the seat-based projection used by existing
 * guidance matrices and layout rules; it is not the participant
 * predicate for games without numbered seats.
 */

export type RoomViewerAudience = 'host' | 'seated' | 'spectator';

interface RoomViewerIdentity {
  readonly userId: string;
  readonly isHost: boolean;
}

export type RoomViewer = RoomViewerIdentity &
  (
    | { readonly seat: number | null; readonly participation?: never }
    | { readonly seat: null; readonly participation: 'seatless' }
  );

/**
 * The audience projection: host wins over seat (a seated host is a
 * host); an unseated non-host is a spectator. Callers pass the seat
 * the contract is about — the own seat for identity contracts, the
 * effective (own or controlled) seat for action contracts.
 */
export function resolveRoomViewerAudience(input: {
  readonly isHost: boolean;
  readonly seat: number | null;
}): RoomViewerAudience {
  if (input.isHost) return 'host';
  return input.seat === null ? 'spectator' : 'seated';
}

/**
 * The seat the viewer currently acts as: a bot seat under takeover, or
 * the viewer's own seat. Seat-based actions key off this seat.
 */
export function resolveEffectiveSeat(
  viewer: RoomViewer,
  controlledSeat: number | null,
): number | null {
  return controlledSeat ?? viewer.seat;
}

/** Whether this viewer may hold a participant action in the room shell. */
export function isEffectiveRoomParticipant(
  viewer: RoomViewer,
  controlledSeat: number | null,
): boolean {
  return (
    viewer.participation === 'seatless' || resolveEffectiveSeat(viewer, controlledSeat) !== null
  );
}
