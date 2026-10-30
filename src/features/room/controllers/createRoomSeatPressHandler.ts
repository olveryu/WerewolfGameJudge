/** Execute shared room seat-tap intents; games retain setup detection and profile-target resolution. */

import {
  resolveRoomInGameSeatTap,
  ROOM_SEAT_TAP_BLOCKED_TITLE,
  type RoomSeatTapIntent,
  type RoomSeatTapResolverInput,
} from '@/features/room/model/RoomSeatTap';
import { showErrorAlert } from '@/utils/alertPresets';

interface RoomSeatPressHandlerParams<TState, TTarget> {
  readonly isSetup: boolean;
  /**
   * The game's in-game seat interaction (a pick, a vote target, a night
   * action): consulted first after setup; returning true means the tap
   * was consumed. Otherwise the shared in-game outcome applies (the
   * disabled-reason alert, or nothing).
   */
  readonly inGameAction?: (seat: number) => boolean;
  readonly state: TState;
  readonly currentSeat: number | null;
  readonly resolveIntent: (input: RoomSeatTapResolverInput<TState>) => RoomSeatTapIntent<TTarget>;
  readonly profile: { readonly open: (target: TTarget) => void };
  readonly seatController: {
    readonly requestTakeSeat: (seat: number) => void;
    readonly requestMoveSeat: (seat: number) => void;
  };
}

/**
 * Bind one render's authoritative state and controllers to the shared seat-press execution path.
 * @throws Propagates invalid disabled reasons and game-resolver or controller contract violations.
 */
export function createRoomSeatPressHandler<TState, TTarget>(
  params: RoomSeatPressHandlerParams<TState, TTarget>,
): (seat: number, disabledReason?: string) => void {
  return (seat, disabledReason) => {
    if (!params.isSetup) {
      if (params.inGameAction?.(seat) === true) return;
      const outcome = resolveRoomInGameSeatTap(disabledReason);
      if (outcome.kind === 'alert') {
        showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, outcome.reason);
      }
      return;
    }
    const intent = params.resolveIntent({
      state: params.state,
      seat,
      currentSeat: params.currentSeat,
      disabledReason,
    });
    switch (intent.kind) {
      case 'blocked':
        return showErrorAlert(ROOM_SEAT_TAP_BLOCKED_TITLE, intent.reason);
      case 'profile':
        return params.profile.open(intent.target);
      case 'take':
        return params.seatController.requestTakeSeat(intent.seat);
      case 'move':
        return params.seatController.requestMoveSeat(intent.seat);
    }
  };
}
