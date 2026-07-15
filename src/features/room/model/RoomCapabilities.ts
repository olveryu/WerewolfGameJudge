/** Executable room permissions derived by each game adapter. */

export type RoomOperationResult =
  | { readonly success: true; readonly reason?: string }
  | {
      readonly success: false;
      readonly failureKind: 'rejected' | 'notDecided' | 'deliveryUnknown';
      readonly commandId: string;
      readonly reason: string;
    };

export type FailedRoomOperationResult = Extract<RoomOperationResult, { readonly success: false }>;

export type RoomOperationFailureMessage = (result: FailedRoomOperationResult) => string;

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
