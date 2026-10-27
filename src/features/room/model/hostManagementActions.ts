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

import type { RoomCapability } from './RoomCapabilities';
import type {
  RoomHostManagementAction,
  RoomHostTask,
  RoomHostTaskStep,
} from './RoomHostManagement';

/**
 * Variant of the two terminal (closing) actions — 再来一局 and
 * 返回大厅. Single source: the shared builders below read it, and
 * every surface that re-presents the same actions (the werewolf
 * bottom panel's closing row) reads it too, instead of restating
 * the literal.
 */
export const TERMINAL_ACTION_VARIANT = 'danger' as const;

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

/** "开始游戏" — primary action, every game has it. The label is chassis vocabulary: no per-game override. */
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

/** "分配角色" — the deal step: seats are full, roles/words get dealt. */
export function buildAssignRolesAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'assign-roles',
    '分配角色',
    'layers-outline',
    'primary',
    TESTIDS.assignRolesButton,
    input,
  );
}

/** "重新开始" — in-game redeal in place (the round restarts with fresh deals, seats and settings kept). */
export function buildRestartGameAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'restart',
    '重新开始',
    'refresh-outline',
    'secondary',
    TESTIDS.restartButton,
    input,
  );
}

/** "中止本局" — danger action: discard the current game without a redeal. */
export function buildAbortGameAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'abort-game',
    '中止本局',
    'stop-circle-outline',
    'danger',
    TESTIDS.abortGameButton,
    input,
  );
}

/**
 * Host-flow confirm copy that is chassis-level: titles are one
 * vocabulary platform-wide, and the isomorphic bodies are built from
 * one sentence pattern with the game's own nouns injected. Bodies
 * that carry game content (what gets redealt, what is preserved)
 * stay with the game.
 */
export const HOST_FLOW_CONFIRM = {
  assignTitle: '分配角色？',
  startTitle: '开始游戏？',
  nextRoundTitle: '再来一局',
  returnLobbyTitle: '返回大厅',
  abortTitle: '中止本局？',
  returnLobbyBody: '保留座位和设置，清除当前对局。',
} as const;

/** "全员已查看{身份|词卡}，…" — the viewing-complete confirm body pattern. */
export function allViewedConfirmBody(viewedNoun: string, outcome: string): string {
  return `全员已查看${viewedNoun}，${outcome}`;
}

/** The one seat-shortage disabled reason, shared by every assign/start gate. */
export function seatShortageReason(totalSeats: number, occupiedSeats: number): string {
  return `座位尚未坐满（还差 ${totalSeats - occupiedSeats} 人）`;
}

/** The one viewing-progress disabled reason (count form), shared by every begin gate. */
export function viewedProgressReason(
  viewedCount: number,
  totalSeats: number,
  viewedNoun: string,
): string {
  return `${viewedCount}/${totalSeats} 位玩家已查看${viewedNoun}，等待剩余玩家`;
}

export interface ViewingProgress {
  readonly viewedCount: number;
  readonly totalSeats: number;
}

/**
 * The one client projection of Identity Viewing Protocol progress:
 * an adapter supplies its game's participants and its own viewed-seat
 * record; the counts every begin gate consumes come from here — never
 * from a per-game hand-rolled filter, and never from a raw record
 * length (a stale record for a seat outside the participant set must
 * not open the gate).
 */
export function projectViewingProgress(
  participants: readonly { readonly seat: number }[],
  viewedSeats: readonly number[],
): ViewingProgress {
  return {
    totalSeats: participants.length,
    viewedCount: participants.filter((participant) => viewedSeats.includes(participant.seat))
      .length,
  };
}

export interface ViewingBeginGateInput extends ViewingProgress {
  readonly submitting: boolean;
  /** The game's own not-all-viewed copy (content; the gate math is not). */
  readonly notViewedCopy: string;
}

export interface ViewingBeginGate {
  readonly allViewed: boolean;
  readonly isEnabled: boolean;
  readonly disabledReason: string | null;
}

/**
 * The one client begin gate for the viewing phase, mirroring the
 * engine checkpoint (haveAllViewed over the participant set): play
 * opens only once every participant seat holds a viewed record. An
 * empty participant set never opens the gate.
 */
export function createViewingBeginGate(input: ViewingBeginGateInput): ViewingBeginGate {
  const allViewed = input.totalSeats > 0 && input.viewedCount >= input.totalSeats;
  return {
    allViewed,
    isEnabled: !input.submitting && allViewed,
    disabledReason: allViewed ? null : input.notViewedCopy,
  };
}

/** "再来一局" — danger terminal action; the game's confirm copy stays in onPress. */
export function buildNextRoundAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'next-round',
    '再来一局',
    'play-forward-outline',
    TERMINAL_ACTION_VARIANT,
    TESTIDS.nextRoundButton,
    input,
  );
}

/** "返回大厅" — danger terminal action; the game's confirm copy stays in onPress. */
export function buildReturnLobbyAction(input: ActionInput): RoomHostManagementAction {
  return buildAction(
    'return-lobby',
    '返回大厅',
    'return-down-back-outline',
    TERMINAL_ACTION_VARIANT,
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

/** Canonical sheet keys referenced by host tasks across games. */
export const HOST_ACTION_KEYS = {
  startGame: 'start-game',
  assignRoles: 'assign-roles',
  restart: 'restart',
  abortGame: 'abort-game',
  nextRound: 'next-round',
  returnLobby: 'return-lobby',
  fillBots: 'fill-bots',
  markBotsViewed: 'mark-bots-viewed',
  clearSeats: 'clear-seats',
  configureGame: 'configure-game',
  shareRoom: 'share-room',
} as const;

/**
 * "分享房间" — the room section's share entry, from the room's share
 * capability. It is the remedy a seat-blocked start task references.
 */
export function buildShareRoomAction(canShareRoom: RoomCapability): RoomHostManagementAction {
  return canShareRoom.isAllowed
    ? {
        key: HOST_ACTION_KEYS.shareRoom,
        label: '分享房间',
        icon: 'share-social-outline',
        variant: 'secondary',
        testID: TESTIDS.roomShareHostActionButton,
        isEnabled: true,
        onPress: canShareRoom.execute,
      }
    : {
        key: HOST_ACTION_KEYS.shareRoom,
        label: '分享房间',
        icon: 'share-social-outline',
        variant: 'secondary',
        testID: TESTIDS.roomShareHostActionButton,
        isEnabled: false,
        disabledReason: canShareRoom.reason,
      };
}

interface HostTaskExtras {
  readonly steps?: readonly RoomHostTaskStep[];
  readonly note?: string;
  readonly remedyActionKey?: string;
}

/** The one declared host task: do the referenced sheet action. */
export function hostActionTask(actionKey: string, extras: HostTaskExtras = {}): RoomHostTask {
  return { kind: 'action', actionKey, ...extras };
}

/** Waiting on others or following a board instruction, with an optional escape action. */
export function hostMessageTask(
  text: string,
  extras: HostTaskExtras & { readonly actionKey?: string } = {},
): RoomHostTask {
  return { kind: 'message', text, ...extras };
}

/**
 * The shared closing task every game ends on: equal options
 * (再来一局 / 返回大厅), never one primary and one buried option.
 */
export function hostClosingTask(extras: HostTaskExtras = {}): RoomHostTask {
  return {
    kind: 'choice',
    actionKeys: [HOST_ACTION_KEYS.nextRound, HOST_ACTION_KEYS.returnLobby],
    ...extras,
  };
}

/**
 * The shared lobby start task: the start/assign action, with the share-room
 * remedy whenever the sheet carries one (the card renders it only while the
 * action is blocked).
 */
export function hostStartTask(
  actionKey: typeof HOST_ACTION_KEYS.startGame | typeof HOST_ACTION_KEYS.assignRoles,
): RoomHostTask {
  return hostActionTask(actionKey, { remedyActionKey: HOST_ACTION_KEYS.shareRoom });
}
