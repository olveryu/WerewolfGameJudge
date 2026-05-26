/** Zod schemas for /auth/* endpoints */

import { ROLE_REVEAL_EFFECT_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import { z } from 'zod';

/** Sign-up request validation. */
export const signUpSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
  displayName: z.string().max(30).optional(),
});

/** Sign-in request validation. */
export const signInSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
});

/** Profile update request validation. */
export const updateProfileSchema = z.object({
  displayName: z.string().max(30).optional(),
  avatarUrl: z.string().max(500).optional(),
  customAvatarUrl: z.string().max(500).optional(),
  avatarFrame: z.string().max(100).optional(),
  seatFlair: z.string().max(100).optional(),
  nameStyle: z.string().max(100).optional(),
  equippedEffect: z.enum(['', 'random', ...ROLE_REVEAL_EFFECT_IDS]).optional(),
  seatAnimation: z.string().max(100).optional(),
});

/** Change password request validation. */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

/** Forgot password request validation. */
export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

/** Reset password request validation. */
export const resetPasswordSchema = z.object({
  email: z.email().max(255),
  code: z.string().min(1).max(10),
  newPassword: z.string().min(6).max(128),
});

/** Refresh token request validation. */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1).max(128),
});

/** WeChat claim request validation. */
export const wechatClaimSchema = z.object({
  code: z.string().min(1).max(200),
  nonce: z.string().min(1).max(64),
});

/** Claim nonce request validation. */
export const claimNonceSchema = z.object({
  nonce: z.string().min(1).max(64),
});
