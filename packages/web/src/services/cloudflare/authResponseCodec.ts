/** Exact runtime decoders for Cloudflare authentication endpoint responses. */

import * as z from 'zod/mini';

import { tokenPairSchema } from '@/platform/auth/tokenPair';
import type { GetCurrentUserResponse } from '@/services/types/IAuthService';

const userMetadataSchema = z.strictObject({
  display_name: z.nullable(z.string()),
  avatar_url: z.nullable(z.string()),
  custom_avatar_url: z.nullable(z.string()),
  avatar_frame: z.nullable(z.string()),
  seat_flair: z.nullable(z.string()),
  name_style: z.nullable(z.string()),
  equipped_effect: z.nullable(z.string()),
  seat_animation: z.nullable(z.string()),
});

const authUserSchema = z.strictObject({
  id: z.string().check(z.minLength(1)),
  email: z.nullable(z.email()),
  is_anonymous: z.boolean(),
  has_wechat: z.boolean(),
  user_metadata: userMetadataSchema,
});

const anonymousAuthResponseSchema = z.strictObject({
  ...tokenPairSchema,
  user: authUserSchema,
});

const emailAuthResponseSchema = z.strictObject({
  ...tokenPairSchema,
  user: authUserSchema,
});

const resetPasswordResponseSchema = z.strictObject({
  success: z.literal(true),
  ...tokenPairSchema,
  user: authUserSchema,
});

const claimAuthResponseSchema = z.strictObject({
  ...tokenPairSchema,
  user: authUserSchema,
});

const currentUserResponseSchema = z.strictObject({
  data: z.strictObject({ user: authUserSchema }),
});

type AnonymousAuthResponse = z.infer<typeof anonymousAuthResponseSchema>;
type EmailAuthResponse = z.infer<typeof emailAuthResponseSchema>;
type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
type ClaimAuthResponse = z.infer<typeof claimAuthResponseSchema>;

export function parseAnonymousAuthResponse(value: unknown): AnonymousAuthResponse {
  const parsed = anonymousAuthResponseSchema.parse(value);
  if (!parsed.user.is_anonymous || parsed.user.email !== null || parsed.user.has_wechat) {
    throw new Error('Anonymous auth response must contain a new anonymous user');
  }
  return parsed;
}

export function parseEmailAuthResponse(value: unknown): EmailAuthResponse {
  const parsed = emailAuthResponseSchema.parse(value);
  if (parsed.user.is_anonymous || parsed.user.email === null) {
    throw new Error('Email auth response must contain a registered email user');
  }
  return parsed;
}

export function parseResetPasswordResponse(value: unknown): ResetPasswordResponse {
  const parsed = resetPasswordResponseSchema.parse(value);
  if (parsed.user.is_anonymous || parsed.user.email === null) {
    throw new Error('Password reset response must contain a registered email user');
  }
  return parsed;
}

export function parseClaimAuthResponse(value: unknown): ClaimAuthResponse {
  const parsed = claimAuthResponseSchema.parse(value);
  if (!parsed.user.has_wechat) {
    throw new Error('WeChat claim response must contain a bound user');
  }
  return parsed;
}

export function parseCurrentUserResponse(value: unknown): GetCurrentUserResponse {
  return currentUserResponseSchema.parse(value);
}
