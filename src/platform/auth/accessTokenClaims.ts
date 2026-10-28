/** Strict local decoder for access-token claims issued by the Worker. */

import { z } from 'zod';

const accessTokenClaimsSchema = z.strictObject({
  sub: z.string().min(1),
  ver: z.number().int().nonnegative(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export interface AccessTokenClaims {
  readonly sub: string;
  readonly ver: number;
  readonly iat: number;
  readonly exp: number;
}

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 30_000;

function decodeBase64Url(segment: string): string {
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return atob(normalized.padEnd(normalized.length + paddingLength, '='));
}

/** Parse, but do not cryptographically verify, one Worker-issued access token. */
export function parseAccessTokenClaims(token: string): AccessTokenClaims {
  const segments = token.split('.');
  if (segments.length !== 3) throw new Error('Access token must contain three JWT segments');

  const payloadSegment = segments[1];
  if (payloadSegment === undefined || payloadSegment.length === 0) {
    throw new Error('Access token payload must not be empty');
  }

  const payload: unknown = JSON.parse(decodeBase64Url(payloadSegment));
  return accessTokenClaimsSchema.parse(payload);
}

/** Treat a token inside the refresh buffer as expired before starting network work. */
export function isAccessTokenClaimsExpired(
  claims: AccessTokenClaims,
  nowMs: number = Date.now(),
): boolean {
  return claims.exp * 1000 <= nowMs + ACCESS_TOKEN_EXPIRY_BUFFER_MS;
}
