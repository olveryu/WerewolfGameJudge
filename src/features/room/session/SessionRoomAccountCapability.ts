/** Shared RoomSession projection for product-level account operations. */

import type {
  RoomProfileUpdateCommand,
  RoomSeatCommand,
} from '@game-judge/game-engine/platform/protocol/commands';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type {
  RoomProfileUpdate,
  RoomSeatProfile,
} from '@game-judge/game-engine/platform/room/roster';
import { resolveRandomAnimation } from '@game-judge/game-engine/product/rewards';

import type {
  GameRoomAccountSnapshot,
  RoomAccountCapability,
  RoomProfilePatch,
} from '@/features/room/model/RoomAccountCapability';
import { toRoomProfileUpdate } from '@/features/room/model/RoomAccountCapability';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import type { RoomOperationCommandContext } from '@/features/room/session/roomOperationCommandClient';
import { updateRoomProfile } from '@/features/room/session/roomProfileCommandClient';
import {
  leaveRoomSeat,
  type RoomSeatCommandContext,
} from '@/features/room/session/roomSeatCommandClient';
import type {
  RoomCommandDispatchOptions,
  RoomCommandDispatchOutcome,
  RoomSessionSnapshot,
} from '@/features/room/session/types';

interface RoomAccountSession<TState extends BaseGameState<string>> {
  getSnapshot(): RoomSessionSnapshot<TState>;
  subscribe(listener: () => void): () => void;
}

type RoomAccountCommand =
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | RoomSeatCommand<RoomSeatProfile>;

interface RoomAccountCommandSession<
  TState extends BaseGameState<string>,
> extends RoomAccountSession<TState> {
  dispatch(
    command: RoomAccountCommand,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

interface SessionRoomAccountCapabilityDeps<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> {
  readonly gameType: TGameType;
  readonly session: RoomAccountSession<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
  readonly updateProfile: (patch: RoomProfilePatch) => Promise<RoomOperationResult>;
  readonly leaveSeat: () => Promise<RoomOperationResult>;
}

interface CreateSessionRoomAccountCapabilityParams<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> {
  readonly gameType: TGameType;
  readonly session: RoomAccountCommandSession<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

export class SessionRoomAccountCapability<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> implements RoomAccountCapability<TGameType> {
  readonly gameType: TGameType;
  readonly #deps: SessionRoomAccountCapabilityDeps<TGameType, TState>;
  #lastSessionSnapshot: RoomSessionSnapshot<TState> | null = null;
  #lastSnapshot: GameRoomAccountSnapshot<TGameType>;

  constructor(deps: SessionRoomAccountCapabilityDeps<TGameType, TState>) {
    this.gameType = deps.gameType;
    this.#deps = deps;
    this.#lastSnapshot = Object.freeze({
      gameType: deps.gameType,
      phase: 'idle',
      isSeated: false,
      canSwitchAccount: true,
      canSyncProfile: false,
    });
  }

  getSnapshot(): GameRoomAccountSnapshot<TGameType> {
    const session = this.#deps.session.getSnapshot();
    if (session === this.#lastSessionSnapshot) return this.#lastSnapshot;
    this.#lastSessionSnapshot = session;

    if (session.phase === 'idle') {
      this.#lastSnapshot = Object.freeze({
        gameType: this.gameType,
        phase: 'idle',
        isSeated: false,
        canSwitchAccount: true,
        canSyncProfile: false,
      });
      return this.#lastSnapshot;
    }
    if (session.phase !== 'ready') {
      this.#lastSnapshot = Object.freeze({
        gameType: this.gameType,
        phase: session.phase,
        isSeated: false,
        canSwitchAccount: false,
        canSyncProfile: false,
      });
      return this.#lastSnapshot;
    }

    const isSeated = this.#deps.isUserSeated(session.snapshot.state, session.identity.userId);
    this.#lastSnapshot = Object.freeze({
      gameType: this.gameType,
      phase: 'ready',
      isSeated,
      canSwitchAccount: this.#deps.canSwitchAccount(session.snapshot.state),
      canSyncProfile: isSeated,
    });
    return this.#lastSnapshot;
  }

  subscribe(listener: () => void): () => void {
    return this.#deps.session.subscribe(listener);
  }

  readonly updateProfile = async (patch: RoomProfilePatch): Promise<RoomOperationResult> => {
    if (!this.getSnapshot().canSyncProfile) {
      throw new Error('[FAIL-FAST] Active room profile sync requires a seated player');
    }
    return this.#deps.updateProfile(patch);
  };

  readonly leaveSeat = async (): Promise<RoomOperationResult> => {
    if (!this.getSnapshot().isSeated) {
      throw new Error('[FAIL-FAST] Active room leave requires a seated player');
    }
    return this.#deps.leaveSeat();
  };
}

export function createSessionRoomAccountCapability<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
>({
  gameType,
  session,
  isUserSeated,
  canSwitchAccount,
}: CreateSessionRoomAccountCapabilityParams<TGameType, TState>): SessionRoomAccountCapability<
  TGameType,
  TState
> {
  const profileContext: RoomOperationCommandContext<
    TState,
    RoomProfileUpdateCommand<RoomProfileUpdate>
  > = {
    dispatch: (command, options) => session.dispatch(command, options),
  };
  const seatContext: RoomSeatCommandContext<TState, RoomSeatProfile> = {
    dispatch: (command, options) => session.dispatch(command, options),
  };

  return new SessionRoomAccountCapability({
    gameType,
    session,
    isUserSeated,
    canSwitchAccount,
    updateProfile: (patch) => {
      const snapshot = session.getSnapshot();
      if (snapshot.phase !== 'ready') {
        throw new Error('[FAIL-FAST] Room profile update requires a ready room session');
      }
      const profile = toRoomProfileUpdate({
        ...patch,
        revealEffect:
          patch.revealEffect === 'random'
            ? resolveRandomAnimation(snapshot.identity.room.roomCode + snapshot.identity.userId)
            : patch.revealEffect,
      });
      return updateRoomProfile(profileContext, profile);
    },
    leaveSeat: () => leaveRoomSeat(seatContext),
  });
}
