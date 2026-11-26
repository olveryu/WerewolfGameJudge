/** Builds the shared player profile card model from the open selection. */

import type { RoomProfileSelection } from '../controllers/useRoomProfileController';
import { executeProfileKick } from './executeProfileKick';
import type { RoomCapabilities } from './RoomCapabilities';
import type { RoomProfileCardModel } from './RoomProfile';

export interface CreateRoomProfileCardModelInput {
  readonly selection: RoomProfileSelection | null;
  readonly capabilities: Pick<RoomCapabilities, 'canKickSeat' | 'canLeaveSeat'>;
  readonly onClose: () => void;
  /** The game's leave-seat execution, exposed only when the capability allows it. */
  readonly onLeaveSeat?: () => void;
  readonly gameDetails?: RoomProfileCardModel['gameDetails'];
}

/**
 * The one profile-card assembly. Kick and leave are capability-gated
 * uniformly: kick when the target is someone else and canKickSeat
 * allows it, leave when the target is the viewer and canLeaveSeat
 * allows it. All seven games previously assembled this literal in four
 * places, three of them spelling the leave gate as a lobby condition
 * (verified equivalent: canLeaveSeat already encodes setup-phase and
 * seated, and a self target implies the viewer is seated).
 */
export function createRoomProfileCardModel(
  input: CreateRoomProfileCardModelInput,
): RoomProfileCardModel | null {
  const { selection } = input;
  if (selection === null) return null;
  const canLeaveSeat =
    selection.target.seat !== null && selection.isSelf && input.capabilities.canLeaveSeat.isAllowed;
  if (canLeaveSeat && input.onLeaveSeat === undefined) {
    throw new Error('Seat leave capability requires an onLeaveSeat handler');
  }
  return {
    target: selection.target,
    isSelf: selection.isSelf,
    onClose: input.onClose,
    onKick:
      selection.target.seat !== null &&
      !selection.isSelf &&
      input.capabilities.canKickSeat.isAllowed
        ? () => executeProfileKick(input.capabilities, selection)
        : null,
    onLeaveSeat: canLeaveSeat ? (input.onLeaveSeat ?? null) : null,
    gameDetails: input.gameDetails ?? null,
  };
}
