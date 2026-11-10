/** Shared RoomLink projection for product-level account operations. */

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
import type { DispatchOutcome, LinkSnapshot } from '@/platform/realtime/types';

import { updateRoomProfile } from './roomProfileCommandClient';
import {
  leaveRoomSeat,
  type RoomCommandContext,
  type RoomSeatCommandContext,
} from './roomSeatCommandClient';

interface RoomAccountLink<TState extends BaseGameState<string>> {
  getSnapshot(): LinkSnapshot<TState>;
  subscribe(listener: () => void): () => void;
}

type RoomAccountCommand =
  | RoomProfileUpdateCommand<RoomProfileUpdate>
  | RoomSeatCommand<RoomSeatProfile>;

interface RoomAccountCommandLink<TState extends BaseGameState<string>>
  extends RoomAccountLink<TState>, RoomCommandContext<TState, RoomAccountCommand> {}

interface LinkRoomAccountCapabilityDeps<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> {
  readonly gameType: TGameType;
  readonly link: RoomAccountLink<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
  readonly updateProfile: (patch: RoomProfilePatch) => Promise<DispatchOutcome<TState>>;
  readonly leaveSeat: () => Promise<DispatchOutcome<TState>>;
}

interface CreateLinkRoomAccountCapabilityParams<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> {
  readonly gameType: TGameType;
  readonly link: RoomAccountCommandLink<TState>;
  readonly isUserSeated: (state: TState, userId: string) => boolean;
  readonly canSwitchAccount: (state: TState) => boolean;
}

export class LinkRoomAccountCapability<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
> implements RoomAccountCapability<TGameType> {
  readonly gameType: TGameType;
  readonly #deps: LinkRoomAccountCapabilityDeps<TGameType, TState>;
  #lastLinkSnapshot: LinkSnapshot<TState> | null = null;
  #lastSnapshot: GameRoomAccountSnapshot<TGameType>;

  constructor(deps: LinkRoomAccountCapabilityDeps<TGameType, TState>) {
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
    const link = this.#deps.link.getSnapshot();
    if (link === this.#lastLinkSnapshot) return this.#lastSnapshot;
    this.#lastLinkSnapshot = link;

    if (link.phase !== 'ready') {
      this.#lastSnapshot = Object.freeze({
        gameType: this.gameType,
        phase: link.phase,
        isSeated: false,
        canSwitchAccount: link.phase === 'idle',
        canSyncProfile: false,
      });
      return this.#lastSnapshot;
    }

    const isSeated = this.#deps.isUserSeated(link.room.state, link.identity.userId);
    this.#lastSnapshot = Object.freeze({
      gameType: this.gameType,
      phase: 'ready',
      isSeated,
      canSwitchAccount: this.#deps.canSwitchAccount(link.room.state),
      canSyncProfile: isSeated,
    });
    return this.#lastSnapshot;
  }

  subscribe(listener: () => void): () => void {
    return this.#deps.link.subscribe(listener);
  }

  readonly updateProfile = async (patch: RoomProfilePatch): Promise<DispatchOutcome<TState>> => {
    if (!this.getSnapshot().canSyncProfile) {
      throw new Error('[FAIL-FAST] Active room profile sync requires a seated player');
    }
    return this.#deps.updateProfile(patch);
  };

  readonly leaveSeat = async (): Promise<DispatchOutcome<TState>> => {
    if (!this.getSnapshot().isSeated) {
      throw new Error('[FAIL-FAST] Active room leave requires a seated player');
    }
    return this.#deps.leaveSeat();
  };
}

export function createLinkRoomAccountCapability<
  TGameType extends string,
  TState extends BaseGameState<TGameType>,
>({
  gameType,
  link,
  isUserSeated,
  canSwitchAccount,
}: CreateLinkRoomAccountCapabilityParams<TGameType, TState>): LinkRoomAccountCapability<
  TGameType,
  TState
> {
  const profileContext: RoomCommandContext<TState, RoomProfileUpdateCommand<RoomProfileUpdate>> = {
    dispatch: (command, options) => link.dispatch(command, options),
  };
  const seatContext: RoomSeatCommandContext<TState, RoomSeatProfile> = {
    dispatch: (command, options) => link.dispatch(command, options),
  };

  return new LinkRoomAccountCapability({
    gameType,
    link,
    isUserSeated,
    canSwitchAccount,
    updateProfile: (patch) => {
      const snapshot = link.getSnapshot();
      if (snapshot.phase !== 'ready') {
        throw new Error('[FAIL-FAST] Room profile update requires a ready room link');
      }
      const profile = toRoomProfileUpdate({
        ...patch,
        revealEffect:
          patch.revealEffect === ''
            ? 'none'
            : patch.revealEffect === 'random'
              ? resolveRandomAnimation(snapshot.identity.room.roomCode + snapshot.identity.userId)
              : patch.revealEffect,
      });
      return updateRoomProfile(profileContext, profile);
    },
    leaveSeat: () => leaveRoomSeat(seatContext),
  });
}
