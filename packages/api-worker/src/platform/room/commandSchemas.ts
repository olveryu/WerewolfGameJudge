/** Strict external schemas for canonical shared room commands. */

import type {
  RoomProfileUpdate,
  RoomSeatProfile,
} from '@werewolf/game-engine/platform/room/roster';
import { z } from 'zod';

const roomSeatProfileSchema: z.ZodType<RoomSeatProfile> = z.strictObject({
  displayName: z.string().min(1),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  revealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
  level: z.number().int().nonnegative().optional(),
});

const roomProfileUpdateSchema: z.ZodType<RoomProfileUpdate> = z.strictObject({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  revealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
});

export const ROOM_PUBLIC_COMMAND_SCHEMAS = [
  z.strictObject({
    type: z.literal('room.seat.take'),
    seat: z.number().int().nonnegative(),
    profile: roomSeatProfileSchema,
  }),
  z.strictObject({ type: z.literal('room.seat.leave') }),
  z.strictObject({
    type: z.literal('room.seat.kick'),
    seat: z.number().int().nonnegative(),
  }),
  z.strictObject({ type: z.literal('room.seat.clear') }),
  z.strictObject({ type: z.literal('room.seat.fillBots') }),
  z.strictObject({
    type: z.literal('room.profile.update'),
    profile: roomProfileUpdateSchema,
  }),
] as const;
