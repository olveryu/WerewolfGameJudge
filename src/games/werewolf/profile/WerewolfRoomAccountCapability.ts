/** Map the Werewolf room session to product-level account operations. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';

import {
  createLinkRoomAccountCapability,
  type LinkRoomAccountCapability,
} from '@/features/room/link/LinkRoomAccountCapability';
import type {
  RoomAccountCapability,
  RoomAccountCommandOutcome,
  RoomProfilePatch,
} from '@/features/room/model/RoomAccountCapability';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';

export class WerewolfRoomAccountCapability implements RoomAccountCapability<'werewolf'> {
  readonly gameType = 'werewolf' as const;
  readonly #delegate: LinkRoomAccountCapability<'werewolf', GameState>;

  constructor(client: WerewolfGameClient) {
    const session = client.roomSession;
    this.#delegate = createLinkRoomAccountCapability({
      gameType: 'werewolf',
      link: session,
      isUserSeated: (state, userId) => getWerewolfUserSeat(state, userId) !== null,
      canSwitchAccount: (state) =>
        state.status === GameStatus.Unseated || state.status === GameStatus.Seated,
    });
  }

  getSnapshot() {
    return this.#delegate.getSnapshot();
  }

  subscribe(listener: () => void): () => void {
    return this.#delegate.subscribe(listener);
  }

  readonly updateProfile = (
    patch: RoomProfilePatch,
  ): Promise<RoomAccountCommandOutcome<'werewolf'>> => this.#delegate.updateProfile(patch);

  readonly leaveSeat = (): Promise<RoomAccountCommandOutcome<'werewolf'>> =>
    this.#delegate.leaveSeat();
}
