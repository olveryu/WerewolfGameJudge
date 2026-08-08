/** Serializable contracts used by the generic room Durable Object RPC surface. */

import type { CommandActor } from '@game-judge/game-engine/platform/engine';
import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { type REASON_NO_STATE } from '@game-judge/game-engine/platform/protocol/reasons';
import type { RoomLocator } from '@game-judge/game-engine/platform/protocol/roomLocator';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

export interface RoomInstanceIdentity extends RoomLocator {
  readonly creationId: string;
}

export interface InitializeRoomCommand extends RoomInstanceIdentity {
  readonly gameType: GameType;
  readonly hostUserId: string;
  readonly config: unknown;
}

export type InitializeRoomResult =
  | {
      readonly success: true;
      readonly snapshot: RoomSnapshot<BaseGameState<GameType>>;
      readonly isReplay: boolean;
    }
  | { readonly success: false; readonly reason: string };

interface DispatchRoomCommandBase {
  readonly roomCode: string;
  readonly commandId: string;
  readonly command: unknown;
}

export type DispatchRoomCommand = DispatchRoomCommandBase &
  (
    | {
        readonly actor: Extract<CommandActor, { readonly kind: 'user' }>;
        readonly controlledSeat: number | null;
      }
    | {
        readonly actor: Extract<CommandActor, { readonly kind: 'system' }>;
        readonly controlledSeat: null;
      }
  );

export interface DispatchUserRoomCommand extends RoomInstanceIdentity {
  readonly commandId: string;
  readonly actorUserId: string;
  readonly controlledSeat: number | null;
  readonly command: unknown;
}

export type DispatchRoomResult =
  | { readonly kind: 'unavailable'; readonly reason: typeof REASON_NO_STATE }
  | {
      readonly kind: 'decided';
      readonly result: RoomCommandResult<BaseGameState<GameType>>;
      readonly isReplay: boolean;
    };

export type ReadRoomCommand = RoomInstanceIdentity;

export interface AuthorizeRoomDeletionCommand extends RoomInstanceIdentity {
  readonly actorUserId: string;
}

export type AuthorizeRoomDeletionResult =
  | { readonly success: true }
  | { readonly success: false; readonly reason: string };

export interface DeleteRoomStorageCommand extends RoomInstanceIdentity {
  /** Whether scheduled expiry may discard effects that exhausted delivery. */
  readonly shouldDiscardFailedEffects: boolean;
}

export type DeleteRoomStorageResult =
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
