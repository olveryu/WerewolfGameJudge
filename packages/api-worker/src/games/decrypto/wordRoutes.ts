/** Authenticated private game view for a host temporarily controlling a bot seat. */
import {
  DECRYPTO_STATE_CODEC,
  type DecryptoState,
  getDecryptoUserSeat,
  getDecryptoViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/decrypto/public';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import type { AppEnv } from '../../env';
import { requireAuth } from '../../features/auth/tokenAuth';
import { createMediaRoomAccess } from '../../platform/room/mediaRoomAccess';

const roomAccess = createMediaRoomAccess({
  codec: DECRYPTO_STATE_CODEC,
  getUserSeat: getDecryptoUserSeat,
  isBotSeat: (state, seat) => isBotSeat(state.roster, seat),
  reasons: {
    roomNotFound: 'ROOM_NOT_FOUND',
    roomGameTypeMismatch: 'ROOM_GAME_TYPE_MISMATCH',
    roomStateNotFound: 'ROOM_STATE_NOT_FOUND',
    controlledSeatInvalid: 'CONTROLLED_SEAT_INVALID',
    notHost: 'NOT_HOST',
    controlledSeatNotBot: 'CONTROLLED_SEAT_NOT_BOT',
  },
});

export const decryptoWordRoutes = new Hono<AppEnv>();

decryptoWordRoutes.get('/:roomCode/takeover-view', requireAuth, async (c) => {
  const room = await roomAccess.readRoom(c.env, c.req.raw, c.req.param('roomCode'));
  const controlledSeat = roomAccess.parseControlledSeat(c.req.query('controlledSeat'));
  if (controlledSeat === null)
    throw new HTTPException(400, { message: 'CONTROLLED_SEAT_REQUIRED' });
  const seat = resolveTakeoverSeat(room.state, c.var.userId, controlledSeat);
  return buildTakeoverViewResponse(room.state, seat);
});

/** Resolves the authenticated host's bot seat before exposing its private game view. */
export function resolveTakeoverSeat(
  state: DecryptoState,
  userId: string,
  controlledSeat: number,
): number {
  const seat = roomAccess.resolveSeat(state, userId, controlledSeat);
  if (seat === null) throw new HTTPException(403, { message: 'NOT_SEATED' });
  return seat;
}

/** Returns the authorized bot's projected state, never another team's private information. */
export function buildTakeoverViewResponse(state: DecryptoState, seat: number) {
  if (state.phase.kind !== 'playing' || state.phase.game.keywords === null) {
    throw new HTTPException(409, { message: 'DECRYPTO_KEYWORDS_NOT_READY' });
  }
  const team = state.phase.game.assignments[seat];
  if (team === undefined) throw new HTTPException(403, { message: 'DECRYPTO_SEAT_NOT_ASSIGNED' });
  const game = getDecryptoViewModel(state, seat).game;
  if (game === null) throw new Error('Decrypto takeover projection is missing its game');
  return Response.json(
    {
      seat,
      state: { ...state, phase: { kind: 'playing', game } },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
