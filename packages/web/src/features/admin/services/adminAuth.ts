/**
 * Admin credential check and the Admin API error contract. Kept apart from `adminApi` so the room
 * title gesture can verify a password without loading the portal's response decoders.
 */
import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import { createTimeoutSignal } from '@/utils/abortSignal';

/**
 * AdminApiError — Thrown when Admin API request fails.
 *
 * When thrown: when Admin API returns non-2xx status code.
 * How to catch: `instanceof AdminApiError` — read .status and .reason to show the user.
 */
export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(`Admin API ${status}: ${reason}`);
    this.name = 'AdminApiError';
  }
}

/** Decodes the exact `{ success: false, reason }` body of a failed Admin API response. */
export function parseAdminErrorResponse(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Admin error response must be an object');
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== 'reason' || keys[1] !== 'success') {
    throw new Error('Admin error response has unsupported fields');
  }
  if (!('success' in value) || value.success !== false) {
    throw new Error('Admin error response success must be false');
  }
  if (!('reason' in value) || typeof value.reason !== 'string' || value.reason.length === 0) {
    throw new Error('Admin error response reason must be a non-empty string');
  }
  return value.reason;
}

/**
 * Verify admin password by calling a lightweight endpoint.
 * Returns true if authenticated, false if 401/403.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (password.length === 0 || password !== password.trim()) {
    throw new Error('[FAIL-FAST] Admin credential must be a trimmed non-empty string');
  }
  const url = new URL(`${API_BASE_URL}/admin/session`);

  const resp = await fetch(url.toString(), {
    headers: { 'X-Admin-Token': password },
    signal: createTimeoutSignal(API_TIMEOUT_MS),
  });

  if (resp.ok) return true;
  if (resp.status === 401 || resp.status === 403) return false;
  const body: unknown = await resp.json();
  throw new AdminApiError(resp.status, parseAdminErrorResponse(body));
}
