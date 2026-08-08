/** Executable room permissions derived by each game adapter. */

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
  readonly userId: string;
  readonly occupantKind: 'human' | 'bot';
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
      input.isHost && input.isSetup && !input.isRoomFull
        ? allowed(input.fillBots)
        : denied('当前没有可填充的空位'),
    canConfigureGame:
      input.isHost && input.isSetup ? allowed(input.configureGame) : denied('当前阶段不能修改配置'),
    canShareRoom: input.isSetup ? allowed(input.shareRoom) : denied('当前阶段不能分享房间'),
    shouldConfirmExit: true,
  };
}
