/** Account-owned endpoints retained under the public /auth URL contract. */

import {
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
  parseUnlockedRewardIds,
} from '@game-judge/game-engine/product/rewards';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../../db';
import type { AppEnv } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import { authenticateAccessToken, extractBearerToken, requireAuth } from '../auth/tokenAuth';
import { users, userStats } from './dbSchema';
import { selectAuthUserResponse } from './profile';
import { updateProfileSchema } from './schemas';

/** Current-account and profile mutation routes. */
export const accountAuthRoutes = new Hono<AppEnv>();

accountAuthRoutes.get('/user', async (c) => {
  const db = createDb(c.env.DB);
  const token = extractBearerToken(c.req.raw);
  if (token === null) {
    return c.json({ success: false, reason: 'UNAUTHORIZED' }, 401);
  }

  const authentication = await authenticateAccessToken(token, c.env);
  if (authentication.kind === 'invalid') {
    return c.json({ success: false, reason: 'UNAUTHORIZED' }, 401);
  }
  if (authentication.kind === 'userNotFound') {
    return c.json({ success: false, reason: 'USER_NOT_FOUND' }, 404);
  }
  if (authentication.kind === 'revoked') {
    return c.json({ success: false, reason: 'TOKEN_REVOKED' }, 401);
  }

  const user = await selectAuthUserResponse(db, authentication.principal.userId);

  return c.json(
    {
      data: {
        user,
      },
    },
    200,
  );
});

accountAuthRoutes.put('/profile', requireAuth, jsonBody(updateProfileSchema), async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.var.userId;
  const parsed = c.req.valid('json');
  const cosmeticFields = {
    avatarFrame: parsed.avatarFrame,
    seatFlair: parsed.seatFlair,
    nameStyle: parsed.nameStyle,
    equippedEffect: parsed.equippedEffect,
    seatAnimation: parsed.seatAnimation,
  };
  const needsOwnershipCheck = Object.values(cosmeticFields).some(
    (value) => value !== undefined && value !== '',
  );

  if (needsOwnershipCheck) {
    const stats = await db
      .select({ unlockedItems: userStats.unlockedItems })
      .from(userStats)
      .where(eq(userStats.userId, userId))
      .get();
    const unlockedIds = stats === undefined ? [] : parseUnlockedRewardIds(stats.unlockedItems);

    if (cosmeticFields.avatarFrame && !isFrameUnlocked(cosmeticFields.avatarFrame, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'avatarFrame' }, 403);
    }
    if (cosmeticFields.seatFlair && !isFlairUnlocked(cosmeticFields.seatFlair, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'seatFlair' }, 403);
    }
    if (cosmeticFields.nameStyle && !isNameStyleUnlocked(cosmeticFields.nameStyle, unlockedIds)) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'nameStyle' }, 403);
    }
    if (
      cosmeticFields.equippedEffect &&
      cosmeticFields.equippedEffect !== 'random' &&
      !isRoleRevealEffectUnlocked(cosmeticFields.equippedEffect, unlockedIds)
    ) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'equippedEffect' }, 403);
    }
    if (
      cosmeticFields.seatAnimation &&
      !isSeatAnimationUnlocked(cosmeticFields.seatAnimation, unlockedIds)
    ) {
      return c.json({ success: false, reason: 'ITEM_NOT_UNLOCKED', field: 'seatAnimation' }, 403);
    }
  }

  const updates = {
    ...(parsed.displayName === undefined ? {} : { displayName: parsed.displayName }),
    ...(parsed.avatarUrl === undefined ? {} : { avatarUrl: parsed.avatarUrl }),
    ...(parsed.customAvatarUrl === undefined ? {} : { customAvatarUrl: parsed.customAvatarUrl }),
    ...(parsed.avatarFrame === undefined ? {} : { avatarFrame: parsed.avatarFrame }),
    ...(parsed.seatFlair === undefined ? {} : { equippedFlair: parsed.seatFlair }),
    ...(parsed.nameStyle === undefined ? {} : { equippedNameStyle: parsed.nameStyle }),
    ...(parsed.equippedEffect === undefined ? {} : { equippedEffect: parsed.equippedEffect }),
    ...(parsed.seatAnimation === undefined ? {} : { equippedSeatAnimation: parsed.seatAnimation }),
  };

  if (Object.keys(updates).length === 0) {
    return c.json({ success: true }, 200);
  }

  await db
    .update(users)
    .set({ ...updates, updatedAt: sql`datetime('now')` })
    .where(eq(users.id, userId));

  return c.json({ success: true }, 200);
});
