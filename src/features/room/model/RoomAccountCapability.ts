/** Game-neutral account operations for the one active room. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RoomProfileUpdate } from '@game-judge/game-engine/platform/room/roster';

import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';

export interface RoomProfilePatch {
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly nameStyle?: string;
  readonly revealEffect?: string;
  readonly seatAnimation?: string;
}

export function toRoomProfileUpdate(patch: RoomProfilePatch): RoomProfileUpdate {
  return {
    displayName: patch.displayName,
    avatarUrl: patch.avatarUrl,
    avatarFrame: patch.avatarFrame,
    seatFlair: patch.seatFlair,
    nameStyle: patch.nameStyle,
    revealEffect: patch.revealEffect,
    seatAnimation: patch.seatAnimation,
  };
}

export interface GameRoomAccountSnapshot<TGameType extends string = GameType> {
  readonly gameType: TGameType;
  readonly phase: 'idle' | 'entering' | 'ready' | 'failed';
  readonly isSeated: boolean;
  readonly canSwitchAccount: boolean;
  readonly canSyncProfile: boolean;
}

export type RoomAccountCommandOutcome<TGameType extends string = GameType> =
  RoomCommandDispatchOutcome<BaseGameState<TGameType>>;

export interface RoomAccountCapability<TGameType extends string = GameType> {
  readonly gameType: TGameType;
  getSnapshot(): GameRoomAccountSnapshot<TGameType>;
  subscribe(listener: () => void): () => void;
  readonly updateProfile: (
    patch: RoomProfilePatch,
  ) => Promise<RoomAccountCommandOutcome<TGameType>>;
  readonly leaveSeat: () => Promise<RoomAccountCommandOutcome<TGameType>>;
}

export type ActiveRoomAccountSnapshot =
  | {
      readonly phase: 'idle';
      readonly isSeated: false;
      readonly canSwitchAccount: true;
      readonly canSyncProfile: false;
    }
  | {
      readonly phase: 'entering' | 'ready' | 'failed';
      readonly gameType: GameType;
      readonly isSeated: boolean;
      readonly canSwitchAccount: boolean;
      readonly canSyncProfile: boolean;
      readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomAccountCommandOutcome>;
      readonly leaveSeat: () => Promise<RoomAccountCommandOutcome>;
    };
