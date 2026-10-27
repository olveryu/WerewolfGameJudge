/**
 * Room viewer identity: the one declaration of who is looking at the room.
 *
 * Two authoritative axes, kept separate because games combine them
 * differently: `isHost` (room ownership, `state.hostUserId`) and `seat`
 * (the viewer's own seat, null while unseated). A host may be unseated
 * (Avalon, Story Relay) or must be seated (Werewolf); a seated viewer
 * may or may not host. Bot takeover is not identity — it lives on the
 * shell's `controlledSeat` and only widens the effective seat.
 *
 * `RoomViewerAudience` is the three-way projection every per-viewer
 * contract (guidance matrix, layout rules, tests) matches on. It is a
 * derived view of the two axes, never stored beside them.
 */

export type RoomViewerAudience = 'host' | 'seated' | 'spectator';

export interface RoomViewer {
  readonly userId: string;
  readonly isHost: boolean;
  /** The viewer's own seat; null while unseated. */
  readonly seat: number | null;
}

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
 * the viewer's own seat. Participant-only actions key off this seat.
 */
export function resolveEffectiveSeat(
  viewer: RoomViewer,
  controlledSeat: number | null,
): number | null {
  return controlledSeat ?? viewer.seat;
}
