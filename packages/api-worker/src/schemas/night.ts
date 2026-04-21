/** Zod schemas for /game/night/* endpoints */

import { z } from 'zod';

/** POST /game/night/action */
export const nightActionSchema = z.object({
  roomCode: z.string().min(1),
  seat: z.coerce.number().int().min(0),
  role: z.string().min(1),
  target: z.coerce.number().int().min(0).nullable().optional(),
  extra: z.unknown().optional(),
});

/** POST /game/night/audio-gate */
export const audioGateSchema = z.object({
  roomCode: z.string().min(1),
  isPlaying: z.boolean(),
});

/** POST /game/night/wolf-robot-viewed */
export const wolfRobotViewedSchema = z.object({
  roomCode: z.string().min(1),
  seat: z.coerce.number().int().min(0),
});

/** POST /game/night/group-confirm-ack */
export const groupConfirmAckSchema = z.object({
  roomCode: z.string().min(1),
  seat: z.coerce.number().int().min(0),
  userId: z.string().min(1),
});
