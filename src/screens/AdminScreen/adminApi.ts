/**
 * adminApi — Admin portal HTTP client
 *
 * Independent of cfFetch (does not use JWT auth); authenticates via X-Admin-Token header.
 * Returns typed JSON or throws an error.
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import { ADMIN_PASSWORD_KEY } from '@/config/storageKeys';
import { storage } from '@/lib/storage';
import { createTimeoutSignal } from '@/utils/abortSignal';

function getAdminToken(): string {
  const token = storage.getString(ADMIN_PASSWORD_KEY);
  if (!token) throw new Error('ADMIN_NOT_AUTHENTICATED');
  return token;
}

async function adminFetch<T>(path: string, query?: Record<string, string>): Promise<T> {
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

  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({ reason: 'UNKNOWN' }))) as { reason?: string };
    throw new AdminApiError(resp.status, body.reason ?? 'UNKNOWN');
  }

  return resp.json() as Promise<T>;
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

// ── API types ───────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: boolean;
  lastCountry: string | null;
  lastColo: string | null;
  createdAt: string;
  updatedAt: string;
  level: number;
  xp: number;
  gamesPlayed: number;
}

export interface AdminRoom {
  id: string;
  code: string;
  hostUserId: string;
  hostName: string | null;
  hostCountry: string | null;
  participantCount: number;
  createdAt: string;
}

export interface AdminRoomPlayer {
  userId: string;
  displayName: string | null;
  lastCountry: string | null;
  lastColo: string | null;
  createdAt: string;
  joinedAt: string;
  level: number;
  xp: number;
  gamesPlayed: number;
}

export interface AdminStats {
  registered: number;
  active: number;
  totalGames: number;
  countries: Array<{ country: string; count: number }>;
  colos: Array<{ colo: string; count: number }>;
}

export interface AdminAnalytics {
  avgLoadMs: number;
  avgTtfbMs: number;
  totalRequests: number;
  countries: Array<{ country: string; count: number; avgLoadMs: number }>;
  colos: Array<{ colo: string; count: number }>;
  isps: Array<{ isp: string; count: number }>;
}

export interface AdminAIUsage {
  totalRequests: number;
  avgTtfrMs: number;
  errorRate: number;
  providers: Array<{ label: string; count: number }>;
  models: Array<{ label: string; count: number }>;
  countries: Array<{ label: string; count: number }>;
  statuses: Array<{ label: string; count: number }>;
  topUsers: Array<{ userId: string; displayName: string | null; count: number }>;
}

// ── Time range utilities ────────────────────────────────────────────────────

export type TimePreset = 'today' | '7d' | '30d' | 'custom';

export function getTimeRange(preset: Exclude<TimePreset, 'custom'>): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'today') {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }
  if (preset === '7d') {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to };
  }
  // 30d
  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to };
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
  return adminFetch<{ users: AdminUser[]; total: number; page: number; limit: number }>(
    '/admin/users',
    {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 50),
      sort: params.sort ?? 'created_at',
      order: params.order ?? 'desc',
      ...(params.country && { country: params.country }),
      ...(params.type && { type: params.type }),
      ...(params.search && { search: params.search }),
    },
  );
}

export function fetchRooms(params: { page?: number; limit?: number } = {}) {
  return adminFetch<{ rooms: AdminRoom[]; total: number; page: number; limit: number }>(
    '/admin/rooms',
    {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 50),
    },
  );
}

export function fetchRoomPlayers(roomCode: string) {
  return adminFetch<{ players: AdminRoomPlayer[] }>(`/admin/rooms/${roomCode}/players`);
}

export function fetchStats(from: string, to: string) {
  return adminFetch<AdminStats>('/admin/stats', { from, to });
}

export function fetchAnalytics(from: string, to: string) {
  return adminFetch<AdminAnalytics>('/admin/analytics', { from, to });
}

export function fetchAIUsage(from: string, to: string) {
  return adminFetch<AdminAIUsage>('/admin/ai-usage', { from, to });
}

/**
 * Verify admin password by calling a lightweight endpoint.
 * Returns true if authenticated, false if 401/403.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const url = new URL(`${API_BASE_URL}/admin/stats`);
  // Use a minimal time range just to verify auth
  url.searchParams.set('from', '2020-01-01T00:00:00Z');
  url.searchParams.set('to', '2020-01-01T00:01:00Z');

  const resp = await fetch(url.toString(), {
    headers: { 'X-Admin-Token': password },
    signal: createTimeoutSignal(API_TIMEOUT_MS),
  });

  return resp.ok;
}
