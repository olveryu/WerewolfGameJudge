/** Executable room permissions derived by each game adapter. */

export type RoomOperationResult =
  | { readonly success: true; readonly reason?: string }
  | { readonly success: false; readonly reason: string };

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
  readonly isSelf: boolean;
}

export interface RoomCapabilities {
  readonly canTakeSeat: RoomCapability<readonly [seat: number], Promise<RoomOperationResult>>;
  readonly canMoveSeat: RoomCapability<readonly [seat: number], Promise<RoomOperationResult>>;
  readonly canLeaveSeat: RoomCapability<readonly [], Promise<RoomOperationResult>>;
  readonly canKickSeat: RoomCapability<readonly [seat: number], Promise<RoomOperationResult>>;
  readonly canClearSeats: RoomCapability<readonly [], Promise<RoomOperationResult>>;
  readonly canFillBots: RoomCapability<readonly [], Promise<RoomOperationResult>>;
  readonly canConfigureGame: RoomCapability;
  readonly canViewProfiles: RoomCapability<readonly [target: RoomProfileTarget]>;
  readonly canTakeOverBots: RoomCapability<readonly [seat: number]>;
  readonly canShareRoom: RoomCapability;
  readonly shouldConfirmExit: boolean;
}
