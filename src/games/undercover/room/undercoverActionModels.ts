/** Undercover button availability projected from authoritative phase and explicit local selection. */
import {
  getUndercoverOccupiedSeatCount,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';

import type {
  RoomBottomActionModel,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostManagementModel,
} from '@/features/room/model/RoomHostManagement';

import type { useUndercoverRoundControls } from './hooks/useUndercoverRoundControls';

type Controls = ReturnType<typeof useUndercoverRoundControls>;

export function createUndercoverBottomActions(controls: Controls): RoomBottomActionModel {
  const actions: RoomBottomButton[] = [];
  if (controls.canViewCard)
    actions.push({
      key: 'card',
      label: '查看我的词',
      variant: 'primary',
      size: 'lg',
      isEnabled: true,
      onPress: controls.openCard,
      testID: 'undercover-view-word',
    });
  if (controls.isSelecting) {
    actions.push({
      key: 'cancel',
      label: '取消选择',
      variant: 'ghost',
      size: 'md',
      isEnabled: true,
      onPress: controls.cancelSelection,
    });
    if (controls.selectedSeat !== null)
      actions.push({
        key: 'reveal',
        label: `揭晓 ${controls.selectedSeat + 1} 号并出局`,
        variant: 'secondary',
        size: 'lg',
        ...(controls.isSubmitting
          ? ({ isEnabled: false, disabledReason: null, onDisabledPress: null } as const)
          : ({ isEnabled: true, onPress: controls.reveal } as const)),
        testID: 'undercover-reveal',
      });
  }
  return { kind: 'info', message: controls.isSelecting ? '选择本次出局玩家' : null, actions };
}

export function createUndercoverHostManagement(
  state: UndercoverState,
  isHost: boolean,
  capabilities: RoomCapabilities,
  controls: Controls,
): RoomHostManagementModel | null {
  if (!isHost) return null;
  const actions: RoomHostManagementAction[] = [];
  const add = (
    key: string,
    label: string,
    icon: RoomHostManagementAction['icon'],
    onPress: () => void,
    variant: RoomHostManagementAction['variant'] = 'secondary',
    isAllowed = true,
  ) => {
    actions.push({
      key,
      label,
      icon,
      variant,
      testID: `undercover-${key}`,
      ...(controls.isSubmitting || !isAllowed
        ? ({
            isEnabled: false,
            disabledReason: isAllowed ? null : '请先坐满所有座位',
            onDisabledPress: null,
          } as const)
        : ({ isEnabled: true, onPress } as const)),
    });
  };
  switch (state.phase) {
    case 'lobby':
      add(
        'start',
        '开始本局',
        'play-outline',
        controls.start,
        'primary',
        getUndercoverOccupiedSeatCount(state) === state.config.numberOfPlayers,
      );
      if (capabilities.canConfigureGame.isAllowed)
        add('config', '房间设置', 'options-outline', capabilities.canConfigureGame.execute);
      if (capabilities.canFillBots.isAllowed)
        add('fill-bots', '填充机器人', 'people-outline', capabilities.canFillBots.execute);
      if (state.botSeats.length > 0)
        add('clear-bots', '清除机器人', 'remove-circle-outline', controls.clearBots);
      if (capabilities.canClearSeats.isAllowed)
        add(
          'clear-seats',
          '清空座位',
          'trash-outline',
          capabilities.canClearSeats.execute,
          'danger',
        );
      break;
    case 'preparing':
    case 'reading':
      add('abort', '中止本局', 'stop-circle-outline', controls.abort, 'danger');
      break;
    case 'preparationFailed':
      add('retry', '重新准备', 'refresh-outline', controls.retry, 'primary');
      if (state.failureCode === 'inventoryExhausted')
        add('allow-repeated', '本次允许重复词对', 'repeat-outline', controls.allowRepeated);
      add('return-lobby', '返回大厅', 'return-down-back-outline', controls.returnToLobby);
      break;
    case 'ongoing':
      add(
        'select-player',
        '选择出局玩家',
        'person-remove-outline',
        controls.beginSelection,
        'primary',
      );
      add('abort', '中止本局', 'stop-circle-outline', controls.abort, 'danger');
      break;
    case 'ended':
    case 'aborted':
      add(
        'return-lobby',
        '返回大厅',
        'return-down-back-outline',
        controls.returnToLobby,
        'primary',
      );
      break;
  }
  return {
    preview: state.phase === 'ongoing' ? '选择出局玩家' : '对局管理',
    status: null,
    sections: [{ key: 'game', title: '房主操作', actions }],
  };
}
