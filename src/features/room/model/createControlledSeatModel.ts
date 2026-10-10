/** Shared controlled-seat banner model builder (all seven games). */

import type { RoomControlledSeatModel } from './RoomShellModel';

export interface ControlledSeatModelInput {
  /** Whether the viewer may take over bot seats (the game's host capability). */
  readonly canControlBots: boolean;
  /** Whether the room currently has any bot seat to take over. */
  readonly hasBots: boolean;
  readonly controlledSeat: number | null;
  readonly controlledBotName: string | null;
  readonly release: () => void;
  /** Game name for error messages, e.g. 'Werewolf', 'Avalon'. */
  readonly gameName: string;
}

/**
 * Build the RoomControlledSeatModel for the shared ControlledSeatBanner.
 *
 * The visibility gate lives here, once, so no game hand-writes it: while a
 * takeover is active the banner always shows (the release entry must never
 * vanish); otherwise it shows only when the viewer can take over and the
 * room actually has bot seats. Returns null when the banner should hide.
 */
export function createControlledSeatModel(
  input: ControlledSeatModelInput,
): RoomControlledSeatModel | null {
  const isVisible = input.controlledSeat !== null || (input.canControlBots && input.hasBots);
  if (!isVisible) return null;
  if (input.controlledSeat === null) {
    return { kind: 'hint' };
  }
  if (input.controlledBotName === null) {
    throw new Error(`Controlled ${input.gameName} bot seat ${input.controlledSeat} has no player`);
  }
  return {
    kind: 'controlled',
    seat: input.controlledSeat,
    displayName: input.controlledBotName,
    onRelease: input.release,
  };
}
