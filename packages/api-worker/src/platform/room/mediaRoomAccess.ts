/**
 * Shared room access for drawing-media routes (Pictionary, DrawGuess).
 *
 * Loads the active room snapshot and resolves the seat a media request acts
 * for: the caller's own seat, or — for the host only — a controlled bot seat
 * (takeover upload/read on behalf of a bot drawer). Each game supplies its
 * state codec, engine seat lookups, and failure reasons; the room loading and
 * seat resolution themselves live here exactly once.
 */

import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../env';
import { callDurableObject } from '../http/callDurableObject';
import { type ActiveRoomDirectoryEntry, findActiveRoom } from './roomDirectory';
import { type GameRoomStub, getGameRoomStub } from './roomStub';

const controlledSeatQuerySchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .transform(Number)
  .pipe(z.number().int().min(0))
  .optional();

export interface MediaRoomContext<TState> {
  readonly room: ActiveRoomDirectoryEntry;
  readonly state: TState;
  readonly stub: GameRoomStub;
}

export interface MediaRoomFailureReasons {
  readonly roomNotFound: string;
  readonly roomGameTypeMismatch: string;
  readonly roomStateNotFound: string;
  readonly controlledSeatInvalid: string;
  readonly notHost: string;
  readonly controlledSeatNotBot: string;
}

export interface MediaRoomAccessConfig<TState extends BaseGameState<string>> {
  readonly codec: GameStateCodec<TState>;
  readonly getUserSeat: (state: TState, userId: string) => number | null;
  readonly isBotSeat: (state: TState, seat: number) => boolean;
  readonly reasons: MediaRoomFailureReasons;
}

export interface MediaRoomAccess<TState extends BaseGameState<string>> {
  readRoom(env: Env, request: Request, roomCode: string): Promise<MediaRoomContext<TState>>;
  parseControlledSeat(value: string | undefined): number | null;
  resolveSeat(state: TState, userId: string, controlledSeat: number | null): number | null;
}

function fail(status: 400 | 403 | 404 | 409, reason: string): never {
  throw new HTTPException(status, { message: reason });
}

export function createMediaRoomAccess<TState extends BaseGameState<string>>(
  config: MediaRoomAccessConfig<TState>,
): MediaRoomAccess<TState> {
  async function readRoom(
    env: Env,
    request: Request,
    roomCode: string,
  ): Promise<MediaRoomContext<TState>> {
    const room = await findActiveRoom(env, roomCode);
    if (room === null) return fail(404, config.reasons.roomNotFound);
    if (room.gameType !== config.codec.gameType) {
      return fail(409, config.reasons.roomGameTypeMismatch);
    }
    const stub = getGameRoomStub(env, room.roomId, request);
    const snapshot = await callDurableObject(() =>
      stub.getSnapshot({
        roomCode: room.roomCode,
        roomId: room.roomId,
        creationId: room.creationId,
      }),
    );
    if (snapshot === null) return fail(404, config.reasons.roomStateNotFound);
    return { room, state: config.codec.parse(snapshot.state), stub };
  }

  function parseControlledSeat(value: string | undefined): number | null {
    const parsed = controlledSeatQuerySchema.safeParse(value);
    if (!parsed.success) return fail(400, config.reasons.controlledSeatInvalid);
    return parsed.data ?? null;
  }

  function resolveSeat(
    state: TState,
    userId: string,
    controlledSeat: number | null,
  ): number | null {
    if (controlledSeat === null) return config.getUserSeat(state, userId);
    if (userId !== state.hostUserId) return fail(403, config.reasons.notHost);
    if (!config.isBotSeat(state, controlledSeat)) {
      return fail(403, config.reasons.controlledSeatNotBot);
    }
    return controlledSeat;
  }

  return { readRoom, parseControlledSeat, resolveSeat };
}
