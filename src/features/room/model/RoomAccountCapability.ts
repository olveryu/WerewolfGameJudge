/** Game-neutral account operations for the one active room. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { RoomProfileUpdate } from '@werewolf/game-engine/platform/room/roster';

import type { RoomOperationResult } from './RoomCapabilities';

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

export interface GameRoomAccountSnapshot<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  readonly phase: 'idle' | 'entering' | 'ready' | 'failed';
  readonly isSeated: boolean;
  readonly canSwitchAccount: boolean;
  readonly canSyncProfile: boolean;
}

export interface RoomAccountCapability<TGameType extends GameType = GameType> {
  readonly gameType: TGameType;
  getSnapshot(): GameRoomAccountSnapshot<TGameType>;
  subscribe(listener: () => void): () => void;
  readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomOperationResult>;
  readonly leaveSeat: () => Promise<RoomOperationResult>;
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
      readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomOperationResult>;
      readonly leaveSeat: () => Promise<RoomOperationResult>;
    };
