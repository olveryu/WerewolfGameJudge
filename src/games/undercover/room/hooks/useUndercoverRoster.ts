/** Shared seating, profiles and explicit test-bot control bound to Undercover room facts. */
import type { UndercoverState } from '@game-judge/game-engine/games/undercover/public';
import { useEffect } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useRoomBotControl } from '@/features/room/controllers/useRoomBotControl';
import { useRoomHostOperations } from '@/features/room/controllers/useRoomHostOperations';
import { useRoomProfileController } from '@/features/room/controllers/useRoomProfileController';
import { useRoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';
import { getRoomSeatTapIntent } from '@/features/room/model/RoomSeatTap';
import { showErrorAlert } from '@/utils/alertPresets';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import {
  createUndercoverRoomCapabilities,
  getUndercoverProfileTarget,
  getUndercoverUserSeat,
} from '../undercoverRoomAdapter';
import { useUndercoverSeatCommands } from './useUndercoverSeatCommands';

export function useUndercoverRoster(
  state: UndercoverState,
  session: UndercoverRoomSession,
  user: User,
  configureGame: () => void,
  shareRoom: () => void,
) {
  const commands = useUndercoverSeatCommands(session, user);
  const mySeat = getUndercoverUserSeat(state, user.id);
  const seatController = useRoomSeatController({
    currentSeat: mySeat,
    takeSeat: commands.takeSeat,
  });
  const profileController = useRoomProfileController({
    myUserId: user.id,
    kickSeat: commands.kickSeat,
    leaveSeat: commands.leaveSeat,
  });
  const operations = useRoomHostOperations(commands);
  const bot = useRoomBotControl();
  const isHost = state.hostUserId === user.id;
  const canControl =
    isHost && state.config.isTestMode && (state.phase === 'reading' || state.phase === 'ongoing');
  const controlledSeat =
    canControl && bot.controlledSeat !== null && state.botSeats.includes(bot.controlledSeat)
      ? bot.controlledSeat
      : null;
  const release = bot.release;
  useEffect(() => {
    if (bot.controlledSeat !== null && controlledSeat === null) release();
  }, [bot.controlledSeat, controlledSeat, release]);
  const capabilities = createUndercoverRoomCapabilities({
    state,
    isHost,
    mySeat,
    requestTakeSeat: seatController.requestTakeSeat,
    requestMoveSeat: seatController.requestMoveSeat,
    leaveSeat: profileController.leaveSelf,
    kickSeat: profileController.kick,
    clearSeats: operations.requestClearSeats,
    fillBots: operations.requestFillBots,
    configureGame,
    openProfile: profileController.open,
    takeOverBot: bot.takeOver,
    shareRoom,
  });
  const profileSelection = profileController.selection;
  const profile: RoomProfileCardModel | null =
    profileSelection === null
      ? null
      : {
          target: profileSelection.target,
          isSelf: profileSelection.isSelf,
          onClose: profileController.close,
          gameDetails: null,
          onKick:
            !profileSelection.isSelf && capabilities.canKickSeat.isAllowed
              ? () => profileController.kick(profileSelection.target.seat)
              : null,
          onLeaveSeat:
            profileSelection.isSelf && capabilities.canLeaveSeat.isAllowed
              ? profileController.leaveSelf
              : null,
        };
  const onSeatPress = (seat: number, disabledReason?: string) => {
    const intent = getRoomSeatTapIntent({
      seat,
      currentSeat: mySeat,
      target: getUndercoverProfileTarget(state, seat),
      disabledReason,
    });
    if (intent.kind === 'blocked') {
      showErrorAlert('不可选择', intent.reason);
      return;
    }
    if (intent.kind === 'profile') {
      profileController.open(intent.target);
      return;
    }
    const capability = intent.kind === 'take' ? capabilities.canTakeSeat : capabilities.canMoveSeat;
    if (!capability.isAllowed) {
      showErrorAlert('无法操作座位', capability.reason ?? '当前不可操作');
      return;
    }
    capability.execute(seat);
  };
  const onBotLongPress = (seat: number) => {
    if (!capabilities.canTakeOverBots.isAllowed || !state.botSeats.includes(seat))
      throw new Error('Invalid Undercover bot control');
    if (controlledSeat === seat) release();
    else bot.takeOver(seat);
  };
  return {
    capabilities,
    profile,
    controlledSeat,
    release,
    onSeatPress,
    onBotLongPress,
    isSubmitting: seatController.isSubmitting,
    seatConfirmation:
      seatController.pendingAction === null
        ? null
        : {
            action: seatController.pendingAction,
            isSubmitting: seatController.isSubmitting,
            onConfirm: seatController.confirm,
            onCancel: seatController.cancel,
          },
  };
}
