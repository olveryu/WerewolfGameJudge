/**
 * ISeatFacade — Seat take / leave operations
 *
 * Covers direct seating and ACK-based seating APIs.
 * Does not include room lifecycle, game control, or night actions.
 */

export interface ISeatFacade {
  takeSeat(seatNumber: number, displayName?: string, avatarUrl?: string): Promise<boolean>;
  takeSeatWithAck(
    seatNumber: number,
    displayName?: string,
    avatarUrl?: string,
  ): Promise<{ success: boolean; reason?: string }>;
  leaveSeat(): Promise<boolean>;
  leaveSeatWithAck(): Promise<{ success: boolean; reason?: string }>;
}
