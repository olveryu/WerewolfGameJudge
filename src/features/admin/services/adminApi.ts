/**
 * adminApi — Admin portal HTTP client
 *
 * Independent of cfFetch (does not use JWT auth); authenticates via X-Admin-Token header.
 * Returns typed JSON or throws an error.
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import type { TimePreset } from '@/features/admin/model/adminContracts';
import { readAdminCredential } from '@/features/admin/services/adminCredentialStore';
import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminErrorResponse,
  parseAdminRequestTrafficResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
} from '@/features/admin/services/adminResponseCodec';
import { createTimeoutSignal } from '@/utils/abortSignal';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function getAdminToken(): string {
  const token = readAdminCredential();
  if (!token) throw new Error('ADMIN_NOT_AUTHENTICATED');
  return token;
}

async function adminFetch<T>(
  path: string,
  parseResponse: (value: unknown) => T,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const resp = await fetch(url.toString(), {
    headers: { 'X-Admin-Token': getAdminToken() },
    signal: createTimeoutSignal(API_TIMEOUT_MS),
  });

  const body: unknown = await resp.json();
  if (!resp.ok) throw new AdminApiError(resp.status, parseAdminErrorResponse(body));
  return parseResponse(body);
}

/**
 * AdminApiError — Thrown when Admin API request fails.
 *
 * When thrown: when Admin API returns non-2xx status code.
 * How to catch: `instanceof AdminApiError` — read .status and .reason to show the user.
 */
class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string,
  ) {
    super(`Admin API ${status}: ${reason}`);
    this.name = 'AdminApiError';
  }
}

// ── Time range utilities ────────────────────────────────────────────────────

export function getTimeRange(preset: Exclude<TimePreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (preset) {
    case '1h':
      return { from: new Date(now.getTime() - HOUR_MS).toISOString(), to };
    case '24h':
      return { from: new Date(now.getTime() - DAY_MS).toISOString(), to };
    case 'today': {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      return { from: start.toISOString(), to };
    }
    case '7d':
      return { from: new Date(now.getTime() - 7 * DAY_MS).toISOString(), to };
    case '30d':
      return { from: new Date(now.getTime() - 30 * DAY_MS).toISOString(), to };
  }
  const exhaustive: never = preset;
  return exhaustive;
}

// ── API calls ───────────────────────────────────────────────────────────────

interface FetchUsersParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: string;
  country?: string;
  type?: string;
  search?: string;
}

export function fetchUsers(params: FetchUsersParams = {}) {
  return adminFetch('/admin/users', parseAdminUsersResponse, {
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
    ...(params.country && { country: params.country }),
    ...(params.type && { type: params.type }),
    ...(params.search && { search: params.search }),
  });
}

export function fetchRooms(params: { page?: number; limit?: number } = {}) {
  return adminFetch('/admin/rooms', parseAdminRoomsResponse, {
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 50),
  });
}

export function fetchRoomPlayers(roomCode: string) {
  return adminFetch(`/admin/rooms/${roomCode}/players`, parseAdminRoomPlayersResponse);
}

export function fetchStats(from: string, to: string) {
  return adminFetch('/admin/stats', parseAdminStatsResponse, { from, to });
}

export function fetchAnalytics(from: string, to: string) {
  return adminFetch('/admin/analytics', parseAdminAnalyticsResponse, { from, to });
}

export function fetchAIUsage(from: string, to: string) {
  return adminFetch('/admin/ai-usage', parseAdminAIUsageResponse, { from, to });
}

export function fetchRequestTraffic(from: string, to: string) {
  return adminFetch('/admin/request-traffic', parseAdminRequestTrafficResponse, { from, to });
}

/**
 * Verify admin password by calling a lightweight endpoint.
 * Returns true if authenticated, false if 401/403.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (password.length === 0 || password !== password.trim()) {
    throw new Error('[FAIL-FAST] Admin credential must be a trimmed non-empty string');
  }
  const url = new URL(`${API_BASE_URL}/admin/stats`);
  // Use a minimal time range just to verify auth
  url.searchParams.set('from', '2020-01-01T00:00:00Z');
  url.searchParams.set('to', '2020-01-01T00:01:00Z');

  const resp = await fetch(url.toString(), {
    headers: { 'X-Admin-Token': password },
    signal: createTimeoutSignal(API_TIMEOUT_MS),
  });

  if (resp.ok) return true;
  if (resp.status === 401 || resp.status === 403) return false;
  const body: unknown = await resp.json();
  throw new AdminApiError(resp.status, parseAdminErrorResponse(body));
}
