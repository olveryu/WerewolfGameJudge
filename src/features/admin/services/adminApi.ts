/**
 * adminApi — Admin portal HTTP client
 *
 * Authenticates via the app JWT system (cfGet/cfPost) — no standalone admin
 * password. The worker grants access when the caller is an admin
 * (users.is_admin) or a super admin (ADMIN_USER_IDS allowlist).
 * Returns typed JSON or throws an AdminApiError.
 */

import type {
  AdminWhoAmI,
  GameWordGame,
  GameWordsStats,
  SetUserAdminResult,
  TimePreset,
  TriggerSupplyResult,
} from '@/features/admin/model/adminContracts';
import {
  adminRewardGrantSchema,
  type AdminRewardInput,
  adminUserRewardsSchema,
} from '@/features/admin/model/adminRewards';
import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminRequestTrafficResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
  parseAdminWhoAmIResponse,
  parseGameWordsStatsResponse,
  parseSetUserAdminResponse,
  parseTriggerSupplyResult,
} from '@/features/admin/services/adminResponseCodec';
import { cfGet, cfPost, CloudflareHttpError } from '@/services/cloudflare/cfFetch';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query === '' ? path : `${path}?${query}`;
}

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

/** Run an admin call through cfGet/cfPost and normalize transport errors. */
async function adminCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error: unknown) {
    if (error instanceof CloudflareHttpError) {
      throw new AdminApiError(error.status, error.reason);
    }
    throw error;
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

/** Identity of the current caller; 401/403 means no admin access. */
export function getAdminWhoAmI(signal?: AbortSignal): Promise<AdminWhoAmI> {
  return adminCall(() => cfGet('/admin/whoami', parseAdminWhoAmIResponse, { signal }));
}

/**
 * Grant or revoke the admin flag for a user. Super admin only.
 * Throws AdminApiError with status 403 for non-super-admin callers.
 */
export function setUserAdmin(
  userId: string,
  isAdmin: boolean,
  signal?: AbortSignal,
): Promise<SetUserAdminResult> {
  return adminCall(() =>
    cfPost(
      `/admin/users/${encodeURIComponent(userId)}/admin`,
      { isAdmin },
      parseSetUserAdminResponse,
      { signal },
    ),
  );
}

export function fetchUsers(params: FetchUsersParams = {}, signal?: AbortSignal) {
  return adminCall(() =>
    cfGet(
      withQuery('/admin/users', {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
        sort: params.sort ?? 'created_at',
        order: params.order ?? 'desc',
        country: params.country,
        type: params.type,
        search: params.search,
      }),
      parseAdminUsersResponse,
      { signal },
    ),
  );
}

export function fetchRooms(params: { page?: number; limit?: number } = {}) {
  return adminCall(() =>
    cfGet(
      withQuery('/admin/rooms', {
        page: String(params.page ?? 1),
        limit: String(params.limit ?? 50),
      }),
      parseAdminRoomsResponse,
    ),
  );
}

export function fetchRoomPlayers(roomCode: string) {
  return adminCall(() => cfGet(`/admin/rooms/${roomCode}/players`, parseAdminRoomPlayersResponse));
}

/** Read authoritative balances and the most recent admin grant records. */
export function fetchUserRewards(userId: string, signal?: AbortSignal) {
  return adminCall(() =>
    cfGet(
      `/admin/users/${encodeURIComponent(userId)}/rewards`,
      (value) => adminUserRewardsSchema.parse(value),
      { signal },
    ),
  );
}

/** Submit or replay one confirmed grant; callers retain its ID until the result is known. */
export function grantUserReward(userId: string, input: AdminRewardInput) {
  return adminCall(() =>
    cfPost(`/admin/users/${encodeURIComponent(userId)}/rewards`, input, (value) =>
      adminRewardGrantSchema.parse(value),
    ),
  );
}

export function fetchStats(from: string, to: string) {
  return adminCall(() => cfGet(withQuery('/admin/stats', { from, to }), parseAdminStatsResponse));
}

export function fetchAnalytics(from: string, to: string) {
  return adminCall(() =>
    cfGet(withQuery('/admin/analytics', { from, to }), parseAdminAnalyticsResponse),
  );
}

export function fetchAIUsage(from: string, to: string) {
  return adminCall(() =>
    cfGet(withQuery('/admin/ai-usage', { from, to }), parseAdminAIUsageResponse),
  );
}

export function fetchRequestTraffic(from: string, to: string) {
  return adminCall(() =>
    cfGet(withQuery('/admin/request-traffic', { from, to }), parseAdminRequestTrafficResponse),
  );
}

export function fetchGameWordsStats(game: GameWordGame): Promise<GameWordsStats> {
  return adminCall(() =>
    cfGet(withQuery('/admin/games/words/stats', { game }), parseGameWordsStatsResponse),
  );
}

export function triggerGameWordSupply(
  game: GameWordGame,
  force: boolean,
): Promise<TriggerSupplyResult> {
  return adminCall(() =>
    cfPost('/admin/games/words/trigger-supply', { game, force }, parseTriggerSupplyResult),
  );
}
