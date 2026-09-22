/** Compose Undercover controls and projections into the existing RoomShell contract. */
import { useEffect, useRef } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import { useRoomTitleActions } from '@/features/room/controllers/useRoomTitleActions';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { GameRoomScreenProps } from '@/features/room/model/RoomUiModule';

import type { UndercoverRoomSession } from '../../model/UndercoverRoomSession';
import {
  createUndercoverBottomActions,
  createUndercoverHostManagement,
} from '../undercoverActionModels';
import {
  createUndercoverSeatDataSource,
  createUndercoverStatusRibbon,
} from '../undercoverRoomAdapter';
import { useUndercoverRoster } from './useUndercoverRoster';
import { useUndercoverRoundControls } from './useUndercoverRoundControls';

interface UndercoverRoomScreenStateInput extends GameRoomScreenProps<'undercover'> {
  readonly session: UndercoverRoomSession;
  readonly entryController: RoomEntryController;
}

export function useUndercoverRoomScreenState({
  room,
  entryReason,
  navigation,
  session,
  entryController,
}: UndercoverRoomScreenStateInput) {
  const { user } = useAuthContext();
  const snapshot = useRoomSessionSnapshot(session);
  const title = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  if (user === null || snapshot.phase !== 'ready')
    throw new Error('Undercover content requires an authenticated ready session');
  const state = snapshot.snapshot.state;
  const share = useRoomShareController({ roomCode: room.roomCode, gameDisplayName: '谁是卧底' });
  const configure = () =>
    navigation.navigate('GameConfig', {
      gameType: 'undercover',
      mode: 'edit',
      roomCode: room.roomCode,
    });
  const roster = useUndercoverRoster(state, session, user, configure, share.open);
  const controls = useUndercoverRoundControls(state, session, user.id, roster.controlledSeat);
  const hasAutoShownQR = useRef(false);
  const isHost = state.hostUserId === user.id;
  const openShare = share.open;
  useEffect(() => {
    if (isHost && entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [entryReason, isHost, openShare]);
  const shellModel: RoomShellModel = {
    roomCode: room.roomCode,
    capabilities: roster.capabilities,
    header: {
      onBack: () => entryController.requestExit(roster.capabilities.shouldConfirmExit),
      onTitlePress: title.handleTitlePress,
      onTitleLongPress: title.handleTitleLongPress,
      userAction: {
        user,
        ticketCount: gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null,
        onPress: () => navigation.navigate('Settings', { roomCode: room.roomCode }),
      },
    },
    connection: entryController.connection,
    statusRibbon: createUndercoverStatusRibbon(state),
    seats: {
      source: createUndercoverSeatDataSource(
        state,
        snapshot.snapshot.revision,
        user.id,
        roster.controlledSeat,
        controls.selectedSeat,
      ),
      visuallyDisabled: controls.isSubmitting || roster.isSubmitting,
      onSeatPress: controls.isSelecting ? controls.selectSeat : roster.onSeatPress,
      onBotSeatLongPress: roster.capabilities.canTakeOverBots.isAllowed
        ? roster.onBotLongPress
        : null,
    },
    seatConfirmation: roster.seatConfirmation,
    profile: roster.profile,
    share,
    bottomActions: createUndercoverBottomActions(controls),
    hostManagement: createUndercoverHostManagement(state, isHost, roster.capabilities, controls),
    controlledSeat:
      roster.controlledSeat !== null
        ? {
            kind: 'controlled',
            seat: roster.controlledSeat,
            displayName: `机器人 ${roster.controlledSeat + 1}`,
            onRelease: roster.release,
          }
        : roster.capabilities.canTakeOverBots.isAllowed && state.botSeats.length > 0
          ? { kind: 'hint', showBulkViewHint: false }
          : null,
  };
  return {
    state,
    shellModel,
    controls,
    isControlled: roster.controlledSeat !== null,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'undercover', roomCode: room.roomCode }),
  };
}
