/** Serializable contracts used by the generic room Durable Object RPC surface. */

import type { CommandActor } from '@werewolf/game-engine/platform/engine';
import type { RoomCommandResult } from '@werewolf/game-engine/platform/protocol/commandResult';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';

export interface InitializeRoomCommand {
  readonly roomCode: string;
  readonly gameType: GameType;
  readonly hostUserId: string;
  readonly config: unknown;
  readonly creationId: string;
}

export type InitializeRoomResult =
  | {
      readonly success: true;
      readonly snapshot: RoomSnapshot<BaseGameState<GameType>>;
      readonly isReplay: boolean;
    }
  | { readonly success: false; readonly reason: string };

export interface DispatchRoomCommand {
  readonly roomCode: string;
  readonly commandId: string;
  readonly actor: CommandActor;
  readonly controlledSeat: number | null;
  readonly command: unknown;
}

export interface DispatchUserRoomCommand {
  readonly roomCode: string;
  readonly commandId: string;
  readonly actorUserId: string;
  readonly controlledSeat: number | null;
  readonly command: unknown;
}

export interface DispatchRoomResult {
  readonly result: RoomCommandResult<BaseGameState<GameType>>;
  readonly isReplay: boolean;
}

export type DeleteRoomResult =
  | { readonly success: true }
  | { readonly success: false; readonly reason: string };

export interface StoredRoomRow {
  readonly roomCode: string;
  readonly gameType: GameType;
  readonly hostUserId: string;
  readonly creationId: string;
  readonly initializationJson: string;
  readonly stateVersion: number;
  readonly state: BaseGameState<GameType>;
  readonly stateJson: string;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type EffectScope = 'platform' | 'game';

export interface PendingOutboxEffect {
  readonly id: string;
  readonly scope: EffectScope;
  readonly gameType: GameType;
  readonly effectType: string;
  readonly payload: unknown;
  readonly attemptCount: number;
  readonly availableAt: number;
  readonly createdRevision: number;
  readonly createdAt: number;
}
