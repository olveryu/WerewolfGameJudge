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

import type { RoomHostManagementAction, RoomHostRemedy } from './RoomHostManagement';

interface ActionInput {
  readonly onPress: () => void;
  readonly isEnabled?: boolean;
  readonly disabledReason?: string | null;
  readonly isLoading?: boolean;
  /** Overrides the builder's default label (e.g. a game's own round wording). */
  readonly label?: string;
  /** Marks this action as the phase's primary for the collapsed host console. */
  readonly isPrimary?: boolean;
  /** Remedy offered beside this action when the console renders it blocked. */
  readonly remedy?: RoomHostRemedy | null;
  /** Console-only blocked reason while the panel action stays enabled. */
  readonly consoleBlockedReason?: string | null;
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
    isPrimary: input.isPrimary,
    remedy: input.remedy,
    consoleBlockedReason: input.consoleBlockedReason,
  };
  if (input.isEnabled === false) {
    return {
      ...base,
      isEnabled: false,
      disabledReason: input.disabledReason ?? null,
    };
  }
  return {
    ...base,
    isEnabled: true,
    onPress: input.onPress,
  };
}

/**
 * Descriptor for a host action assembled outside the shared builders
 * (game-specific flow actions). The descriptor carries the action's
 * own `isLoading` declaration; the marshal below only flips
 * availability around it.
 */
export interface RoomHostActionDescriptor {
  readonly key: string;
  readonly label: string;
  readonly icon: RoomHostManagementAction['icon'];
  readonly variant: RoomHostManagementAction['variant'];
  readonly testID?: string;
  readonly isLoading?: boolean;
  /** Marks this action as the phase's primary for the collapsed host console. */
  readonly isPrimary?: boolean;
  /** Remedy offered beside this action when the console renders it blocked. */
  readonly remedy?: RoomHostRemedy | null;
  /** Console-only blocked reason while the panel action stays enabled. */
  readonly consoleBlockedReason?: string | null;
}

/** Bind a descriptor to its press handler as an enabled action. */
export function buildEnabledHostAction(
  descriptor: RoomHostActionDescriptor,
  onPress: () => void,
): RoomHostManagementAction {
  return { ...descriptor, isEnabled: true, onPress };
}

/**
 * Marshal a command action around a pending flag: while pending, the
 * action drops its press handler and renders disabled with no reason
 * (the submission lock already prevents a second dispatch); otherwise
 * it is the enabled action.
 */
export function buildPendingAwareHostAction(
  descriptor: RoomHostActionDescriptor,
  isPending: boolean,
  onPress: () => void,
): RoomHostManagementAction {
  return isPending
    ? { ...descriptor, isEnabled: false, disabledReason: null }
    : buildEnabledHostAction(descriptor, onPress);
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

/**
 * "标记机器人已查看" — the host scaffold action of the Identity
 * Viewing Protocol: fills every unviewed bot seat's view record so
 * the begin checkpoint can pass. Every identity game shows it with
 * this exact descriptor; engines never mark bot seats themselves.
 */
export function buildMarkBotsViewedAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'mark-bots-viewed',
    '标记机器人已查看',
    'eye-outline',
    'secondary',
    undefined,
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
