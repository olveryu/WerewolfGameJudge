/** Executable room permissions derived by each game adapter. */

import type { RoomOccupant } from './RoomOccupant';

export type RoomCapability<TArgs extends readonly unknown[] = readonly [], TResult = void> =
  | {
      readonly isAllowed: false;
      readonly reason: string | null;
    }
  | {
      readonly isAllowed: true;
      readonly execute: (...args: TArgs) => TResult;
    };

export interface RoomProfileTarget {
  readonly seat: number;
  readonly occupant: RoomOccupant;
  readonly rosterName: string;
}

export interface RoomCapabilities {
  readonly canTakeSeat: RoomCapability<readonly [seat: number]>;
  readonly canMoveSeat: RoomCapability<readonly [seat: number]>;
  readonly canLeaveSeat: RoomCapability;
  readonly canKickSeat: RoomCapability<readonly [seat: number]>;
  readonly canClearSeats: RoomCapability;
  readonly canFillBots: RoomCapability;
  readonly canConfigureGame: RoomCapability;
  readonly canViewProfiles: RoomCapability<readonly [target: RoomProfileTarget]>;
  readonly canTakeOverBots: RoomCapability<readonly [seat: number]>;
  readonly canShareRoom: RoomCapability;
  readonly shouldConfirmExit: boolean;
}

export type RoomSetupCapabilities = Pick<
  RoomCapabilities,
  | 'canTakeSeat'
  | 'canMoveSeat'
  | 'canLeaveSeat'
  | 'canKickSeat'
  | 'canClearSeats'
  | 'canFillBots'
  | 'canConfigureGame'
  | 'canShareRoom'
  | 'shouldConfirmExit'
>;

export interface RoomSetupCapabilitiesInput {
  readonly isSetup: boolean;
  readonly isHost: boolean;
  readonly supportsBots: boolean;
  readonly mySeat: number | null;
  readonly hasOccupiedSeats: boolean;
  readonly isRoomFull: boolean;
  readonly requestTakeSeat: (seat: number) => void;
  readonly requestMoveSeat: (seat: number) => void;
  readonly leaveSeat: () => void;
  readonly kickSeat: (seat: number) => void;
  readonly clearSeats: () => void;
  readonly fillBots: () => void;
  readonly configureGame: () => void;
  readonly shareRoom: () => void;
}

const denied = <TArgs extends readonly unknown[], TResult>(
  reason: string,
): RoomCapability<TArgs, TResult> => ({ isAllowed: false, reason });

const allowed = <TArgs extends readonly unknown[], TResult>(
  execute: (...args: TArgs) => TResult,
): RoomCapability<TArgs, TResult> => ({ isAllowed: true, execute });

/**
 * The one derivation of the bot-takeover capability: the host may take
 * over bot seats; everyone else gets the shared denial. All seven games
 * previously inlined this ternary (and the denial copy) per adapter/hook.
 */
export function createBotTakeoverCapability(
  isHost: boolean,
  takeOver: (seat: number) => void,
): RoomCapability<readonly [seat: number]> {
  return isHost ? allowed(takeOver) : denied('只有房主可以接管机器人');
}

/**
 * The one derivation of the profile-viewing capability: a game decides
 * only whether profiles may be viewed in its current phase; the denial
 * copy is shared. Every game previously inlined this ternary (and the
 * denial copy) per adapter/hook.
 */
export function createViewProfilesCapability(
  canView: boolean,
  openProfile: (target: RoomProfileTarget) => void,
): RoomCapability<readonly [target: RoomProfileTarget]> {
  return canView ? allowed(openProfile) : denied('游戏进行中不能查看玩家资料');
}

/**
 * Derive game-neutral setup capabilities from authoritative room facts.
 *
 * @remarks Game adapters map their lifecycle into these facts but cannot redefine basic room policy.
 */
export function createRoomSetupCapabilities(
  input: RoomSetupCapabilitiesInput,
): RoomSetupCapabilities {
  return {
    canTakeSeat:
      input.isSetup && input.mySeat === null
        ? allowed(input.requestTakeSeat)
        : denied('当前阶段不能入座'),
    canMoveSeat:
      input.isSetup && input.mySeat !== null
        ? allowed(input.requestMoveSeat)
        : denied('当前阶段不能换座'),
    canLeaveSeat:
      input.isSetup && input.mySeat !== null
        ? allowed(input.leaveSeat)
        : denied('当前阶段不能离座'),
    canKickSeat:
      input.isHost && input.isSetup ? allowed(input.kickSeat) : denied('当前阶段不能移出座位'),
    canClearSeats:
      input.isHost && input.isSetup && input.hasOccupiedSeats
        ? allowed(input.clearSeats)
        : denied('当前没有可清空的座位'),
    canFillBots:
      input.supportsBots && input.isHost && input.isSetup && !input.isRoomFull
        ? allowed(input.fillBots)
        : denied(input.supportsBots ? '当前没有可填充的空位' : '当前游戏不支持机器人'),
    canConfigureGame:
      input.isHost && input.isSetup ? allowed(input.configureGame) : denied('当前阶段不能修改配置'),
    canShareRoom: input.isSetup ? allowed(input.shareRoom) : denied('当前阶段不能分享房间'),
    shouldConfirmExit: true,
  };
}
