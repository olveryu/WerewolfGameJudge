/** Shared controlled-seat banner model builder (all seven games). */

import type { RoomControlledSeatModel } from './RoomShellModel';

export interface ControlledSeatModelInput {
  readonly controlledSeat: number | null;
  readonly controlledBotName: string | null;
  readonly release: () => void;
  /** Game name for error messages, e.g. 'Werewolf', 'Avalon'. */
  readonly gameName: string;
}

/**
 * Build the RoomControlledSeatModel for the shared ControlledSeatBanner.
 *
 * The banner reports an active takeover only: while the host controls a
 * bot seat it always shows (the release entry must never vanish); when no
 * takeover is active there is no banner. Returns null when no seat is
 * being controlled.
 */
export function createControlledSeatModel(
  input: ControlledSeatModelInput,
): RoomControlledSeatModel | null {
  if (input.controlledSeat === null) return null;
  if (input.controlledBotName === null) {
    throw new Error(`Controlled ${input.gameName} bot seat ${input.controlledSeat} has no player`);
  }
  return {
    seat: input.controlledSeat,
    displayName: input.controlledBotName,
    onRelease: input.release,
  };
}
