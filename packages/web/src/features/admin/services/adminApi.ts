/**
 * Admin credential check against the Admin API, which authenticates with the `X-Admin-Token`
 * header instead of the user session. The admin portal itself lands in P4.
 */
import { z } from 'zod';

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import { createTimeoutSignal } from '@/utils/abortSignal';

const adminErrorResponseSchema = z.strictObject({
  success: z.literal(false),
  reason: z.string().min(1),
});

/** A non-2xx Admin API response other than a rejected credential. */
class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`Admin API ${status}: ${reason}`);
    this.name = 'AdminApiError';
  }
}

/**
 * Verifies an admin password against a lightweight endpoint: true when accepted, false on
 * 401/403; any other failure throws.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (password.length === 0 || password !== password.trim()) {
    throw new Error('[FAIL-FAST] Admin credential must be a trimmed non-empty string');
  }
  const url = new URL(`${API_BASE_URL}/admin/stats`);
  // A minimal time range: the request only proves the credential.
  url.searchParams.set('from', '2020-01-01T00:00:00Z');
  url.searchParams.set('to', '2020-01-01T00:01:00Z');
  const response = await fetch(url.toString(), {
    headers: { 'X-Admin-Token': password },
    signal: createTimeoutSignal(API_TIMEOUT_MS),
  });
  if (response.ok) return true;
  if (response.status === 401 || response.status === 403) return false;
  const body = adminErrorResponseSchema.parse(await response.json());
  throw new AdminApiError(response.status, body.reason);
}
