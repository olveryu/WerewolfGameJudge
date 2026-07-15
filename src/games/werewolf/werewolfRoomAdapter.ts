/** Werewolf-owned derivation of neutral room-shell models. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { getRoleDisplayName } from '@game-judge/game-engine/games/werewolf/public';

import type {
  RoomBottomActionLayout,
  RoomBottomButton,
} from '@/features/room/model/RoomBottomActions';
import type {
  RoomCapabilities,
  RoomCapability,
  RoomProfileTarget,
} from '@/features/room/model/RoomCapabilities';
import type {
  RoomSeatDataSource,
  RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type {
  RoomControlledSeatModel,
  RoomStatusRibbonModel,
} from '@/features/room/model/RoomShellModel';
import type {
  BottomLayout,
  ButtonConfig,
  StaticButtonId,
} from '@/games/werewolf/room/hooks/bottomLayoutConfig';
import type { ActionIntent } from '@/games/werewolf/room/policy/types';
import type { SeatViewModel } from '@/games/werewolf/room/werewolfRoom.helpers';

export const WEREWOLF_DISPLAY_NAME = '狼人杀';

const denied = <TArgs extends readonly unknown[], TResult>(
  reason: string | null,
): RoomCapability<TArgs, TResult> => ({ isAllowed: false, reason });

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

interface WerewolfCapabilitiesInput {
  readonly status: GameStatus;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly isDebugMode: boolean;
  readonly isAudioPlaying: boolean;
  readonly hasOccupiedSeats: boolean;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly requestLeaveSeat: () => void;
  readonly kickSeat: (seat: number) => void;
  readonly clearSeats: () => void;
  readonly fillBots: () => void;
  readonly configureGame: () => void;
  readonly openProfile: (target: RoomProfileTarget) => void;
  readonly takeOverBot: (seat: number) => void;
  readonly shareRoom: () => void;
}

export function createWerewolfRoomCapabilities(input: WerewolfCapabilitiesInput): RoomCapabilities {
  const isSetup = input.status === GameStatus.Unseated || input.status === GameStatus.Seated;
  const canTakeOver =
    input.isHost &&
    input.isDebugMode &&
    !(input.status === GameStatus.Ongoing && input.isAudioPlaying);

  return {
    canTakeSeat:
      isSetup && input.mySeat === null
        ? allowed(input.requestTakeSeat)
        : denied('当前阶段不能入座'),
    canMoveSeat:
      isSetup && input.mySeat !== null
        ? allowed(input.requestMoveSeat)
        : denied('当前阶段不能换座'),
    canLeaveSeat:
      isSetup && input.mySeat !== null
        ? allowed(input.requestLeaveSeat)
        : denied('当前阶段不能离座'),
    canKickSeat: input.isHost && isSetup ? allowed(input.kickSeat) : denied('当前阶段不能移出座位'),
    canClearSeats:
      input.isHost && isSetup && input.hasOccupiedSeats
        ? allowed(input.clearSeats)
        : denied('当前没有可清空的座位'),
    canFillBots:
      input.isHost && input.status === GameStatus.Unseated
        ? allowed(input.fillBots)
        : denied('当前阶段不能填充机器人'),
    canConfigureGame:
      input.isHost && isSetup ? allowed(input.configureGame) : denied('当前阶段不能修改配置'),
    canViewProfiles:
      input.status !== GameStatus.Ongoing
        ? allowed(input.openProfile)
        : denied('游戏进行中不能查看玩家资料'),
    canTakeOverBots: canTakeOver ? allowed(input.takeOverBot) : denied('当前不能接管机器人'),
    canShareRoom: isSetup ? allowed(input.shareRoom) : denied('当前阶段不能分享房间'),
    shouldConfirmExit: true,
  };
}

interface WerewolfSeatSourceInput {
  readonly seats: readonly SeatViewModel[];
  readonly controlledSeat: number | null;
  readonly showBotRoles: boolean;
  readonly showLevels: boolean;
  readonly decorationsEnabled: boolean;
  readonly revision: string | number;
}

export function createWerewolfSeatDataSource(input: WerewolfSeatSourceInput): RoomSeatDataSource {
  return {
    count: input.seats.length,
    revision: input.revision,
    getSeat(index): RoomSeatViewModel {
      const seat = input.seats[index];
      if (!seat || seat.seat !== index) {
        throw new Error(`Werewolf seat source is not contiguous at index ${index}`);
      }

      const isControlled = input.controlledSeat === seat.seat;
      const highlight = isControlled
        ? 'controlled'
        : seat.isSelected
          ? 'selected'
          : seat.isWolf
            ? 'danger'
            : 'none';
      const role = seat.player?.role;

      return {
        seat: seat.seat,
        player: seat.player
          ? {
              kind: seat.player.isBot ? 'bot' : 'human',
              userId: seat.player.userId,
              displayName: seat.player.displayName,
              avatarUrl: seat.player.avatarUrl,
              avatarFrame: seat.player.avatarFrame,
              seatFlair: seat.player.seatFlair,
              seatAnimation: seat.player.seatAnimation,
              nameStyle: seat.player.nameStyle,
              seatPetId: seat.player.roleRevealEffect,
              level: seat.player.level,
              isAnonymous: !seat.player.avatarUrl,
            }
          : null,
        isSelf: seat.isMySpot,
        highlight,
        secondaryLabel:
          input.showBotRoles && seat.player?.isBot && role ? getRoleDisplayName(role) : null,
        disabledReason: seat.disabledReason,
        showReadyBadge: seat.showReadyBadge === true,
        badgeText: seat.wolfVoteBadge ?? null,
        showLevel: input.showLevels,
        decorationsEnabled: input.decorationsEnabled,
      };
    },
  };
}

interface WerewolfStatusRibbonInput {
  readonly nightProgress: {
    readonly current: number;
    readonly total: number;
    readonly roleName?: string;
  } | null;
  readonly speakingOrderText?: string;
  readonly guideMessage: string | null;
}

export function createWerewolfStatusRibbon(
  input: WerewolfStatusRibbonInput,
): RoomStatusRibbonModel | null {
  if (input.nightProgress) {
    return {
      kind: 'progress',
      current: input.nightProgress.current,
      total: input.nightProgress.total,
      label: input.nightProgress.roleName ?? null,
    };
  }
  if (input.speakingOrderText !== undefined) {
    return {
      kind: 'message',
      icon: 'speaking',
      text: input.speakingOrderText,
      supportingText: '未参与竞选的玩家自动跳过',
    };
  }
  if (input.guideMessage) {
    return {
      kind: 'message',
      icon: 'guide',
      text: input.guideMessage,
      supportingText: null,
    };
  }
  return null;
}

export function createWerewolfControlledSeatModel(input: {
  readonly isVisible: boolean;
  readonly controlledSeat: number | null;
  readonly controlledBotName: string | null;
  readonly showBulkViewHint: boolean;
  readonly release: () => void;
}): RoomControlledSeatModel | null {
  if (!input.isVisible) return null;
  if (input.controlledSeat === null) {
    return { kind: 'hint', showBulkViewHint: input.showBulkViewHint };
  }
  if (input.controlledBotName === null) {
    throw new Error(`Controlled Werewolf bot seat ${input.controlledSeat} has no player`);
  }
  return {
    kind: 'controlled',
    seat: input.controlledSeat,
    displayName: input.controlledBotName,
    onRelease: input.release,
  };
}

export function createWerewolfBottomActionLayout(input: {
  readonly layout: BottomLayout;
  readonly onIntent: (intent: ActionIntent) => void;
  readonly onStaticAction: (action: StaticButtonId) => void;
}): RoomBottomActionLayout {
  const mapButton = (button: ButtonConfig): RoomBottomButton => {
    const hasIntent = button.intent !== undefined;
    const hasAction = button.action !== undefined;
    if (hasIntent === hasAction) {
      throw new Error(`Werewolf bottom button ${button.key} must have exactly one behavior`);
    }

    const execute = () => {
      if (button.intent) {
        input.onIntent(button.intent);
        return;
      }
      if (!button.action) {
        throw new Error(`Werewolf bottom button ${button.key} lost its behavior`);
      }
      input.onStaticAction(button.action);
    };

    const base = {
      key: button.key,
      label: button.label,
      variant: button.variant,
      size: button.size,
      testID: button.testID,
      textColor: button.textColor,
      buttonColor: button.buttonColor,
    } as const;

    if (!button.disabled) {
      return { ...base, isEnabled: true, onPress: execute };
    }

    return {
      ...base,
      isEnabled: false,
      disabledReason: null,
      onDisabledPress: button.action === 'waitForHost' ? execute : null,
    };
  };

  return {
    primary: input.layout.primary.map(mapButton),
    secondary: input.layout.secondary.map(mapButton),
    ghost: input.layout.ghost.map(mapButton),
  };
}
