/** Cloudflare adapter for typed authoritative room snapshot reads. */

import {
  parseRoomLocator,
  type RoomLocator,
} from '@game-judge/game-engine/platform/protocol/roomLocator';
import {
  type BaseGameState,
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { IRoomStateService } from '@/services/types/IRoomStateService';
import { roomLog } from '@/utils/logger';

import { cfPost } from './cfFetch';
import { assertExactRoomResponseKeys, isRoomResponseRecord } from './roomResponseValidation';

export class CFRoomStateService<
  TState extends BaseGameState<string>,
> implements IRoomStateService<TState> {
  constructor(readonly stateCodec: GameStateCodec<TState>) {}

  async getStateRevision(room: RoomLocator): Promise<number | null> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.debug('getStateRevision', locator);
    return cfPost('/room/revision', { ...locator }, (value) => this.#parseRevision(value));
  }

  #parseRevision(value: unknown): number | null {
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/revision response envelope');
    assertExactRoomResponseKeys(value, ['revision'], '/room/revision response');
    if (
      value.revision !== null &&
      (typeof value.revision !== 'number' ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1)
    ) {
      throw new Error('/room/revision returned an invalid revision');
    }
    return value.revision;
  }

  async getGameState(room: RoomLocator): Promise<RoomSnapshot<TState> | null> {
    const locator = parseRoomLocator({ roomCode: room.roomCode, roomId: room.roomId });
    roomLog.debug('getGameState', locator);
    return cfPost('/room/state', { ...locator }, (value) => this.#parseSnapshot(value));
  }

  #parseSnapshot(value: unknown): RoomSnapshot<TState> | null {
    if (!isRoomResponseRecord(value)) throw new Error('Invalid /room/state response envelope');
    assertExactRoomResponseKeys(value, ['snapshot'], '/room/state response');
    if (value.snapshot === null) return null;
    return parseRoomSnapshot(value.snapshot, this.stateCodec);
  }
}
