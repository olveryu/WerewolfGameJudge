/** Recoverable single-flight room-creation saga. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';

import type {
  RoomCreationRequest,
  RoomCreator,
  RoomDirectory,
  RoomRecord,
} from '@/features/room/model/RoomDirectory';
import { addRecentRoom } from '@/features/room/services/recentRooms';
import type { RoomCreationIntentRepository } from '@/features/room/services/RoomCreationIntentStore';

function isTerminalCreationError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!('status' in value)) return false;
  const status = value.status;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429;
}

export class RoomCreationService implements RoomCreator {
  readonly #inFlight = new Map<string, Promise<RoomRecord>>();

  constructor(
    private readonly roomDirectory: RoomDirectory,
    private readonly intentStore: RoomCreationIntentRepository,
  ) {}

  async createRoom(request: RoomCreationRequest): Promise<RoomRecord> {
    if (request.expectedHostUserId.length === 0) {
      throw new Error('Room creation expected host user ID must not be empty');
    }
    const intentKey = canonicalJson(request);
    const existing = this.#inFlight.get(intentKey);
    if (existing !== undefined) return existing;

    const operation = this.#execute(request, intentKey);
    this.#inFlight.set(intentKey, operation);
    try {
      return await operation;
    } finally {
      if (this.#inFlight.get(intentKey) === operation) this.#inFlight.delete(intentKey);
    }
  }

  async #execute(request: RoomCreationRequest, intentKey: string): Promise<RoomRecord> {
    const creationId = this.intentStore.getOrCreate(intentKey);
    try {
      const room = await this.roomDirectory.createRoom({ ...request, creationId });
      if (room.hostUserId !== request.expectedHostUserId || room.gameType !== request.gameType) {
        throw new Error('Created room identity does not match its creation request');
      }
      addRecentRoom(request.expectedHostUserId, {
        roomCode: room.roomCode,
        roomId: room.roomId,
        gameType: room.gameType,
      });
      this.intentStore.remove(creationId);
      return room;
    } catch (error) {
      if (isTerminalCreationError(error)) this.intentStore.remove(creationId);
      throw error;
    }
  }
}
