/** Compose Undercover controls and projections into the existing RoomShell contract. */
import {
  getUndercoverBotSeats,
  getUndercoverRoleCounts,
  type UndercoverRoleCounts,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { useEffect, useMemo, useRef } from 'react';

import { useAuthContext } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import type { RevealEffectType } from '@/features/room/components/RoleRevealEffects/types';
import type { RoomEntryController } from '@/features/room/controllers/useRoomEntryController';
import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import { useRoomShareController } from '@/features/room/controllers/useRoomShareController';
import { useRoomTitleActions } from '@/features/room/controllers/useRoomTitleActions';
import { createControlledSeatModel } from '@/features/room/model/createControlledSeatModel';
import { getBotDisplayName } from '@/features/room/model/getBotDisplayName';
import { resolveEquippedRevealEffect } from '@/features/room/model/resolveEquippedRevealEffect';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
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
import {
  type UndercoverRoundControls,
  useUndercoverRoundControls,
} from './useUndercoverRoundControls';

interface UndercoverRoomScreenStateInput extends GameRoomScreenProps<'undercover'> {
  readonly session: UndercoverRoomSession;
  readonly entryController: RoomEntryController;
}

/**
 * 卧底房间 Screen 的显式契约（P-2b，对齐狼人杀 WerewolfRoomScreenState 形态）：
 * Screen 需要的推导在本 hook 内组装，回合控制以 UndercoverRoundControls 契约嵌套。
 */
export interface UndercoverRoomScreenState {
  readonly state: UndercoverState;
  readonly shellModel: RoomShellModel;
  readonly controls: UndercoverRoundControls;
  readonly isControlled: boolean;
  readonly equippedRevealEffect: RevealEffectType | null;
  /** Animator 候选池（公开配置展开，原在 Screen 内组装，P-2b 下沉）。 */
  readonly revealPool: readonly RevealRoleData[];
  /** 身份构成计数（引擎口径：卧底人数随总人数变化），供 BoardInfo 展示。 */
  readonly roleCounts: UndercoverRoleCounts;
  readonly openRules: () => void;
}

export function useUndercoverRoomScreenState({
  room,
  entryReason,
  navigation,
  session,
  entryController,
}: UndercoverRoomScreenStateInput): UndercoverRoomScreenState {
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
  const roleCounts = getUndercoverRoleCounts(state.config.numberOfPlayers, state.config.hasBlank);
  // Reveal pool for the animator: kind counts from the public config,
  // expanded per seat-kind. Kinds and counts are public; which seat
  // holds which kind is never included.
  const revealPool = useMemo((): readonly RevealRoleData[] => {
    const counts = getUndercoverRoleCounts(state.config.numberOfPlayers, state.config.hasBlank);
    const kinds: { readonly id: string; readonly name: string; readonly count: number }[] = [
      { id: 'civilian', name: '平民', count: counts.civilian },
      { id: 'undercover', name: '卧底', count: counts.undercover },
      { id: 'blank', name: '白板', count: counts.blank },
    ];
    return kinds.flatMap((kind) =>
      Array.from({ length: kind.count }, () => ({
        id: kind.id,
        name: kind.name,
        alignment: 'neutral' as const,
      })),
    );
  }, [state.config.hasBlank, state.config.numberOfPlayers]);
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
        controls.isSelecting,
      ),
      visuallyDisabled: controls.isSubmitting || roster.isSubmitting,
      onSeatPress: controls.isSelecting ? controls.selectSeat : roster.onSeatPress,
      onBotSeatLongPress:
        !controls.isSelecting && roster.capabilities.canTakeOverBots.isAllowed
          ? roster.onBotLongPress
          : null,
    },
    seatConfirmation: roster.seatConfirmation,
    profile: roster.profile,
    share,
    bottomActions: createUndercoverBottomActions(controls),
    hostManagement: createUndercoverHostManagement(state, isHost, roster.capabilities, controls),
    controlledSeat: createControlledSeatModel({
      isVisible:
        roster.controlledSeat !== null ||
        (roster.capabilities.canTakeOverBots.isAllowed && getUndercoverBotSeats(state).length > 0),
      controlledSeat: roster.controlledSeat,
      controlledBotName:
        roster.controlledSeat !== null ? getBotDisplayName(roster.controlledSeat) : null,
      release: roster.release,
      gameName: 'Undercover',
    }),
  };
  return {
    state,
    shellModel,
    controls,
    isControlled: roster.controlledSeat !== null,
    equippedRevealEffect: resolveEquippedRevealEffect(user.equippedEffect, room.roomCode, user.id),
    revealPool,
    roleCounts,
    openRules: () =>
      navigation.navigate('GameGuide', { gameType: 'undercover', roomCode: room.roomCode }),
  };
}
