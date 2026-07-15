/** Map the Werewolf room session to product-level account operations. */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type {
  RoomAccountCapability,
  RoomProfilePatch,
} from '@/features/room/model/RoomAccountCapability';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import {
  createSessionRoomAccountCapability,
  type SessionRoomAccountCapability,
} from '@/features/room/session/SessionRoomAccountCapability';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';

export class WerewolfRoomAccountCapability implements RoomAccountCapability<'werewolf'> {
  readonly gameType = 'werewolf' as const;
  readonly #delegate: SessionRoomAccountCapability<'werewolf', GameState>;

  constructor(client: WerewolfGameClient) {
    const session = client.roomSession;
    this.#delegate = createSessionRoomAccountCapability({
      gameType: 'werewolf',
      session,
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

  readonly updateProfile = (patch: RoomProfilePatch): Promise<RoomOperationResult> =>
    this.#delegate.updateProfile(patch);

  readonly leaveSeat = (): Promise<RoomOperationResult> => this.#delegate.leaveSeat();
}
