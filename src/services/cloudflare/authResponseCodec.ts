/** Exact runtime decoders for Cloudflare authentication endpoint responses. */

import { z } from 'zod';

import type { GetCurrentUserResponse } from '@/services/types/IAuthService';

const userMetadataSchema = z.strictObject({
  display_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  custom_avatar_url: z.string().nullable(),
  avatar_frame: z.string().nullable(),
  seat_flair: z.string().nullable(),
  name_style: z.string().nullable(),
  equipped_effect: z.string().nullable(),
  seat_animation: z.string().nullable(),
});

const tokenPairSchema = {
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
};

const authUserSchema = z.strictObject({
  id: z.string().min(1),
  email: z.email().nullable(),
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

const refreshResponseSchema = z.strictObject(tokenPairSchema);

const currentUserResponseSchema = z.strictObject({
  data: z.strictObject({ user: authUserSchema }),
});

type AnonymousAuthResponse = z.infer<typeof anonymousAuthResponseSchema>;
type EmailAuthResponse = z.infer<typeof emailAuthResponseSchema>;
type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
type ClaimAuthResponse = z.infer<typeof claimAuthResponseSchema>;
type TokenPairResponse = z.infer<typeof refreshResponseSchema>;

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

export function parseRefreshResponse(value: unknown): TokenPairResponse {
  return refreshResponseSchema.parse(value);
}

export function parseCurrentUserResponse(value: unknown): GetCurrentUserResponse {
  return currentUserResponseSchema.parse(value);
}
