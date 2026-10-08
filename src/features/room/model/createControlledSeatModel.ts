/** Shared controlled-seat banner model builder (werewolf/avalon/fibking/undercover). */

import type { RoomControlledSeatModel } from './RoomShellModel';

export interface ControlledSeatModelInput {
  readonly isVisible: boolean;
  readonly controlledSeat: number | null;
  readonly controlledBotName: string | null;
  readonly release: () => void;
  /** Game name for error messages, e.g. 'Werewolf', 'Avalon'. */
  readonly gameName: string;
}

/**
 * Build the RoomControlledSeatModel for the shared ControlledSeatBanner.
 * Returns null when the banner should be hidden.
 */
export function createControlledSeatModel(
  input: ControlledSeatModelInput,
): RoomControlledSeatModel | null {
  if (!input.isVisible) return null;
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
