/** Zod schemas for /fib/* endpoints and fibking room creation. */

import { FIB_MAX_PLAYERS, FIB_MIN_PLAYERS } from '@werewolf/game-engine/fibking/types';
import { z } from 'zod';

const roomCode = z.string().min(1).max(20);
const seatIndex = z
  .number()
  .int()
  .min(0)
  .max(FIB_MAX_PLAYERS - 1);

/** Create config (validated at the boundary, then passed to fibEngine.createInitialState). */
export const fibCreateConfigSchema = z.object({
  numberOfPlayers: z.number().int().min(FIB_MIN_PLAYERS).max(FIB_MAX_PLAYERS),
});

/** Player display info supplied by the client on SIT (face-to-face trust model). */
export const fibProfileSchema = z.object({
  displayName: z.string().min(1).max(40),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  seatAnimation: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  level: z.number().int().nonnegative().optional(),
});

/** Body for host-only / no-arg fib endpoints (reveal, restart, start-round, …). */
export const fibRoomCodeSchema = z.object({ roomCode });

export const fibSitSchema = z.object({ roomCode, seat: seatIndex, profile: fibProfileSchema });
export const fibKickSchema = z.object({ roomCode, targetSeat: seatIndex });
export const fibUpdateConfigSchema = z.object({
  roomCode,
  numberOfPlayers: z.number().int().min(FIB_MIN_PLAYERS).max(FIB_MAX_PLAYERS),
});
