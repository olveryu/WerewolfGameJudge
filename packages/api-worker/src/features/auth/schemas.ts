/** Zod schemas for /auth/* endpoints */

import { z } from 'zod';

/** Sign-up request validation. */
export const signUpSchema = z.strictObject({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
  displayName: z.string().max(30).optional(),
});

/** Sign-in request validation. */
export const signInSchema = z.strictObject({
  email: z.email().max(255),
  password: z.string().min(1).max(128),
});

/** Change password request validation. */
export const changePasswordSchema = z.strictObject({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

/** Forgot password request validation. */
export const forgotPasswordSchema = z.strictObject({
  email: z.email().max(255),
});

/** Reset password request validation. */
export const resetPasswordSchema = z.strictObject({
  email: z.email().max(255),
  code: z.string().min(1).max(10),
  newPassword: z.string().min(6).max(128),
});

/** Refresh token request validation. */
export const refreshTokenSchema = z.strictObject({
  refresh_token: z.string().min(1).max(128),
});

/** WeChat claim request validation. */
export const wechatClaimSchema = z.strictObject({
  code: z.string().min(1).max(200),
  nonce: z.string().min(1).max(64),
});

/** Claim nonce request validation. */
export const claimNonceSchema = z.strictObject({
  nonce: z.string().min(1).max(64),
});
