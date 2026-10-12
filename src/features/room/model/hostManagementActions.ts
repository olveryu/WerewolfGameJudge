/**
 * Shared host-management action builders.
 *
 * Common actions (start game, fill bots, clear seats, room config) that appear
 * in every game's host management panel. Games provide callbacks; the shared
 * builders ensure consistent labels, icons, and variants.
 *
 * Game-specific actions (e.g., an election advance or a manual settle)
 * stay in the game.
 */

import { TESTIDS } from '@/testids';

import type { RoomHostManagementAction } from './RoomHostManagement';

interface ActionInput {
  readonly onPress: () => void;
  readonly isEnabled?: boolean;
  readonly disabledReason?: string | null;
  readonly isLoading?: boolean;
  /** Overrides the builder's default label (e.g. a game's own round wording). */
  readonly label?: string;
  /** Feedback for pressing while disabled; defaults to no feedback. */
  readonly onDisabledPress?: (() => void) | null;
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
      onDisabledPress: input.onDisabledPress ?? null,
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
    input.label ?? '开始游戏',
    'play-outline',
    'primary',
    TESTIDS.startGameButton,
    input,
  );
}

/** "再来一局" — primary terminal action; the game's confirm copy stays in onPress. */
export function buildNextRoundAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'next-round',
    '再来一局',
    'play-forward-outline',
    'primary',
    TESTIDS.nextRoundButton,
    input,
  );
}

/** "返回大厅" — secondary terminal action; the game's confirm copy stays in onPress. */
export function buildReturnLobbyAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'return-lobby',
    '返回大厅',
    'return-down-back-outline',
    'secondary',
    TESTIDS.returnLobbyButton,
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

/** "房间设置" — secondary action for opening room settings. */
export function buildRoomConfigAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'configure-game',
    '房间设置',
    'options-outline',
    'secondary',
    TESTIDS.roomSettingsButton,
    input,
  );
}
