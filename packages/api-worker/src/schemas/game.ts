/** Zod schemas for /game/* endpoints */

import { z } from 'zod';

/** Reusable: roomCode string */
export const roomCodeSchema = z.object({
  roomCode: z.string().min(1).max(20),
});

/** POST /game/seat — discriminated by `action` */

const seatSitSchema = z.object({
  roomCode: z.string().min(1),
  action: z.literal('sit'),
  userId: z.string().min(1),
  seat: z.coerce.number().int().min(0),
  targetSeat: z.coerce.number().int().min(0).optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
  level: z.coerce.number().int().min(0).optional(),
});

const seatStandupSchema = z.object({
  roomCode: z.string().min(1),
  action: z.literal('standup'),
  userId: z.string().min(1),
  seat: z.coerce.number().int().min(0).optional(),
  targetSeat: z.coerce.number().int().min(0).optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
  level: z.coerce.number().int().min(0).optional(),
});

const seatKickSchema = z.object({
  roomCode: z.string().min(1),
  action: z.literal('kick'),
  userId: z.string().min(1),
  seat: z.coerce.number().int().min(0).optional(),
  targetSeat: z.coerce.number().int().min(0),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
  level: z.coerce.number().int().min(0).optional(),
});

export const seatActionSchema = z.discriminatedUnion('action', [
  seatSitSchema,
  seatStandupSchema,
  seatKickSchema,
]);

/** POST /game/update-template */
export const updateTemplateSchema = z.object({
  roomCode: z.string().min(1),
  templateRoles: z.array(z.string().min(1)),
});

/** POST /game/view-role */
export const viewRoleSchema = z.object({
  roomCode: z.string().min(1),
  userId: z.string().min(1),
  seat: z.coerce.number().int().min(0),
});

/** POST /game/share-review */
export const shareReviewSchema = z.object({
  roomCode: z.string().min(1),
  allowedSeats: z.array(z.coerce.number().int().min(0)),
});

/** POST /game/update-profile (in-room) */
export const updateProfileRouteSchema = z.object({
  roomCode: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  avatarFrame: z.string().optional(),
  seatFlair: z.string().optional(),
  nameStyle: z.string().optional(),
  roleRevealEffect: z.string().optional(),
  seatAnimation: z.string().optional(),
});

/** POST /game/board-nominate */
export const boardNominateSchema = z.object({
  roomCode: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  roles: z.array(z.string().min(1)),
});

/** POST /game/board-upvote */
export const boardUpvoteSchema = z.object({
  roomCode: z.string().min(1),
  userId: z.string().min(1),
  targetUserId: z.string().min(1),
});

/** POST /game/board-withdraw */
export const boardWithdrawSchema = z.object({
  roomCode: z.string().min(1),
  userId: z.string().min(1),
});
