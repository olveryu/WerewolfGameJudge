/**
 * Shared host-management action builders.
 *
 * Common actions (start game, fill bots, clear seats, room config) that appear
 * in every game's host management panel. Games provide callbacks; the shared
 * builders ensure consistent labels, icons, and variants.
 *
 * Game-specific actions (e.g., werewolf's sheriff election, avalon's end vote)
 * stay in the game.
 */

import { TESTIDS } from '@/testids';

import type { RoomHostManagementAction } from './RoomHostManagement';

interface ActionInput {
  readonly onPress: () => void;
  readonly isEnabled?: boolean;
  readonly disabledReason?: string | null;
  readonly isLoading?: boolean;
}

function buildAction(
  key: string,
  label: string,
  icon: RoomHostManagementAction['icon'],
  variant: RoomHostManagementAction['variant'],
  testID: string | undefined,
  input: ActionInput,
): RoomHostManagementAction {
  const base = {
    key,
    label,
    icon,
    variant,
    testID,
    isLoading: input.isLoading,
  };
  if (input.isEnabled === false) {
    return {
      ...base,
      isEnabled: false,
      disabledReason: input.disabledReason ?? null,
      onDisabledPress: null,
    };
  }
  return {
    ...base,
    isEnabled: true,
    onPress: input.onPress,
  };
}

/** "开始游戏" — primary action, every game has it. */
export function buildStartGameAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'start-game',
    '开始游戏',
    'play-outline',
    'primary',
    TESTIDS.startGameButton,
    input,
  );
}

/** "填充机器人" — secondary action for filling empty seats with bots. */
export function buildFillBotsAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'fill-bots',
    '填充机器人',
    'people-outline',
    'secondary',
    TESTIDS.roomFillBotsButton,
    input,
  );
}

/** "清空座位" — danger action for clearing all seats. */
export function buildClearSeatsAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'clear-seats',
    '清空座位',
    'trash-outline',
    'danger',
    TESTIDS.roomClearSeatsButton,
    input,
  );
}

/** "房间配置" — secondary action for opening room settings. */
export function buildRoomConfigAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'configure-game',
    '房间配置',
    'options-outline',
    'secondary',
    TESTIDS.roomSettingsButton,
    input,
  );
}
