/** Map the Werewolf room session to product-level account operations. */

import type {
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from '@werewolf/game-engine/games/werewolf/public';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type {
  GameRoomAccountSnapshot,
  RoomAccountActionResult,
  RoomAccountCapability,
  RoomProfilePatch,
} from '@/features/room/model/RoomAccountCapability';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import {
  leaveRoomSeat,
  type RoomSeatCommandContext,
} from '@/features/room/session/roomSeatCommandClient';
import type { RoomSessionClient, RoomSessionSnapshot } from '@/features/room/session/types';
import type { WerewolfUserEvent } from '@/games/werewolf/realtime/werewolfUserEventCodec';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';

function toAccountResult(
  result: RoomAccountActionResult | RoomOperationResult,
): RoomAccountActionResult {
  return result.success
    ? result.reason === undefined
      ? { success: true }
      : { success: true, reason: result.reason }
    : { success: false, reason: result.reason };
}

export class WerewolfRoomAccountCapability implements RoomAccountCapability<'werewolf'> {
  readonly gameType = 'werewolf' as const;
  readonly #client: WerewolfGameClient;
  readonly #session: RoomSessionClient<GameState, WerewolfPublicCommand, WerewolfUserEvent>;
  readonly #seatCommands: RoomSeatCommandContext<GameState, WerewolfSeatProfile>;
  #lastSessionSnapshot: RoomSessionSnapshot<GameState> | null = null;
  #lastSnapshot: GameRoomAccountSnapshot<'werewolf'> = Object.freeze({
    gameType: 'werewolf',
    phase: 'idle',
    isSeated: false,
    canSwitchAccount: true,
    canSyncProfile: false,
  });

  constructor(client: WerewolfGameClient) {
    this.#client = client;
    this.#session = client.roomSession;
    this.#seatCommands = {
      dispatch: (command, options) => this.#session.dispatch(command, options),
    };
  }

  getSnapshot(): GameRoomAccountSnapshot<'werewolf'> {
    const session = this.#session.getSnapshot();
    if (session === this.#lastSessionSnapshot) return this.#lastSnapshot;
    this.#lastSessionSnapshot = session;

    if (session.phase === 'idle') {
      this.#lastSnapshot = Object.freeze({
        gameType: 'werewolf',
        phase: 'idle',
        isSeated: false,
        canSwitchAccount: true,
        canSyncProfile: false,
      });
      return this.#lastSnapshot;
    }
    if (session.phase !== 'ready') {
      this.#lastSnapshot = Object.freeze({
        gameType: 'werewolf',
        phase: session.phase,
        isSeated: false,
        canSwitchAccount: false,
        canSyncProfile: false,
      });
      return this.#lastSnapshot;
    }

    const state = session.snapshot.state;
    const isSeated = getWerewolfUserSeat(state, session.identity.userId) !== null;
    this.#lastSnapshot = Object.freeze({
      gameType: 'werewolf',
      phase: 'ready',
      isSeated,
      canSwitchAccount: state.status === GameStatus.Unseated || state.status === GameStatus.Seated,
      canSyncProfile: isSeated,
    });
    return this.#lastSnapshot;
  }

  subscribe(listener: () => void): () => void {
    return this.#session.subscribe(listener);
  }

  readonly updateProfile = async (patch: RoomProfilePatch): Promise<RoomAccountActionResult> => {
    if (!this.getSnapshot().canSyncProfile) {
      throw new Error('[FAIL-FAST] Active room profile sync requires a seated player');
    }
    const profile: WerewolfProfileUpdate = {
      displayName: patch.displayName,
      avatarUrl: patch.avatarUrl,
      avatarFrame: patch.avatarFrame,
      seatFlair: patch.seatFlair,
      nameStyle: patch.nameStyle,
      roleRevealEffect: patch.revealEffect,
      seatAnimation: patch.seatAnimation,
    };
    return toAccountResult(await this.#client.updatePlayerProfile(profile));
  };

  readonly leaveSeat = async (): Promise<RoomAccountActionResult> => {
    if (!this.getSnapshot().isSeated) {
      throw new Error('[FAIL-FAST] Active room leave requires a seated player');
    }
    return toAccountResult(await leaveRoomSeat(this.#seatCommands));
  };
}
