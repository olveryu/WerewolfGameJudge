/** Game-neutral account operations for the one active room. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';

export interface RoomProfilePatch {
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly avatarFrame?: string;
  readonly seatFlair?: string;
  readonly nameStyle?: string;
  readonly revealEffect?: string;
  readonly seatAnimation?: string;
}

export type RoomAccountActionResult =
  | { readonly success: true; readonly reason?: string }
  | { readonly success: false; readonly reason: string };

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
  readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomAccountActionResult>;
  readonly leaveSeat: () => Promise<RoomAccountActionResult>;
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
      readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomAccountActionResult>;
      readonly leaveSeat: () => Promise<RoomAccountActionResult>;
    };
