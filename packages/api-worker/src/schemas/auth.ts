/** Zod schemas for /auth/* endpoints */

import { ROLE_REVEAL_EFFECT_IDS } from '@werewolf/game-engine/growth/rewardCatalog';
import { z } from 'zod';

/** 注册请求校验。 */
export const signUpSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
  displayName: z.string().max(30).optional(),
});

/** 登录请求校验。 */
export const signInSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
});

/** 更新资料请求校验。 */
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

/** 修改密码请求校验。 */
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

/** 忘记密码请求校验。 */
export const forgotPasswordSchema = z.object({
  email: z.email().max(255),
});

/** 重置密码请求校验。 */
export const resetPasswordSchema = z.object({
  email: z.email().max(255),
  code: z.string().min(1).max(10),
  newPassword: z.string().min(6).max(128),
});

/** 刷新 token 请求校验。 */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1).max(128),
});

/** 微信 claim 请求校验。 */
export const wechatClaimSchema = z.object({
  code: z.string().min(1).max(200),
  nonce: z.string().min(1).max(64),
});

/** claim nonce 请求校验。 */
export const claimNonceSchema = z.object({
  nonce: z.string().min(1).max(64),
});
