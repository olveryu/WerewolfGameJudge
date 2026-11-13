/**
 * adminApi — Admin portal HTTP client
 *
 * Independent of cfFetch (does not use JWT auth); authenticates via X-Admin-Token header.
 * Returns typed JSON or throws an error.
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import type {
  AdminD1Range,
  AdminD1Sort,
  GameWordGame,
  GameWordsStats,
  TimePreset,
  TriggerSupplyResult,
} from '@/features/admin/model/adminContracts';
import {
  adminRewardGrantSchema,
  type AdminRewardInput,
  adminUserRewardsSchema,
} from '@/features/admin/model/adminRewards';
import { AdminApiError, parseAdminErrorResponse } from '@/features/admin/services/adminAuth';
import {
  expireAdminSession,
  readAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminAutomaticSupplySettings,
  parseAdminCountriesResponse,
  parseAdminD1InsightsResponse,
  parseAdminD1UsageResponse,
  parseAdminRequestTrafficResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
  parseGameWordsStatsResponse,
  parseTriggerSupplyResult,
} from '@/features/admin/services/adminResponseCodec';
import { type MaintenanceConfig, maintenanceSchema } from '@/features/maintenance/maintenance';
import { composeAbortSignals, createTimeoutSignal } from '@/utils/abortSignal';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function getAdminToken(): string {
  const token = readAdminCredential();
  if (!token) throw new Error('ADMIN_NOT_AUTHENTICATED');
  return token;
}

/** Shared administrator transport with credential expiry, cancellation and response validation. */
export async function adminFetch<T>(
  path: string,
  parseResponse: (value: unknown) => T,
  query?: Record<string, string>,
  signal?: AbortSignal,
  requestBody?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const timeoutSignal = createTimeoutSignal(API_TIMEOUT_MS);
  const composed = composeAbortSignals(signal ? [signal, timeoutSignal] : [timeoutSignal]);
  try {
    const resp = await fetch(url.toString(), {
      headers: {
        'X-Admin-Token': getAdminToken(),
        ...(requestBody !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(requestBody !== undefined && { method: 'POST', body: JSON.stringify(requestBody) }),
      signal: composed.signal,
    });
    if (resp.status === 401 || resp.status === 403) expireAdminSession();
    const body: unknown = await resp.json();
    if (!resp.ok) throw new AdminApiError(resp.status, parseAdminErrorResponse(body));
    return parseResponse(body);
  } finally {
    composed.dispose();
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

/** Read site maintenance settings with independent administrator authentication. */
export function fetchAdminMaintenance(signal?: AbortSignal) {
  return adminFetch(
    '/admin/maintenance',
    (value) => maintenanceSchema.parse(value),
    undefined,
    signal,
  );
}

/** Save the maintenance switch and user-written announcement text. */
export function saveAdminMaintenance(configuration: MaintenanceConfig) {
  return adminFetch(
    '/admin/maintenance',
    (value) => maintenanceSchema.parse(value),
    undefined,
    undefined,
    configuration,
  );
}

interface FetchUsersParams {
  cursor?: string;
  sort?: string;
  order?: string;
  country?: string;
  type?: string;
  q?: string;
}

/** Load the indexed list of countries represented in the user directory. */
export function fetchUserCountries(signal?: AbortSignal) {
  return adminFetch('/admin/users/countries', parseAdminCountriesResponse, undefined, signal);
}

/** Read the per-game automatic supply policy independently of D1 inventory statistics. */
export function fetchAutomaticSupplySettings(game: GameWordGame, signal?: AbortSignal) {
  return adminFetch(
    '/admin/games/words/automatic-supply',
    parseAdminAutomaticSupplySettings,
    { game },
    signal,
  );
}

/** Only future scheduled tasks are affected; manual and already-started runs are unchanged. */
export function saveAutomaticSupplySettings(game: GameWordGame, enabled: boolean) {
  return adminFetch(
    '/admin/games/words/automatic-supply',
    parseAdminAutomaticSupplySettings,
    undefined,
    undefined,
    { game, enabled },
  );
}

export function fetchUsers(params: FetchUsersParams = {}, signal?: AbortSignal) {
  return adminFetch(
    '/admin/users',
    parseAdminUsersResponse,
    {
      ...(params.cursor && { cursor: params.cursor }),
      sort: params.sort ?? 'created_at',
      order: params.order ?? 'desc',
      ...(params.country && { country: params.country }),
      ...(params.type && { type: params.type }),
      ...(params.q && { q: params.q }),
    },
    signal,
  );
}

export function fetchRooms(params: { page?: number; limit?: number } = {}, signal?: AbortSignal) {
  return adminFetch(
    '/admin/rooms',
    parseAdminRoomsResponse,
    {
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 50),
    },
    signal,
  );
}

export function fetchRoomPlayers(roomCode: string, signal?: AbortSignal) {
  return adminFetch(
    `/admin/rooms/${encodeURIComponent(roomCode)}/players`,
    parseAdminRoomPlayersResponse,
    undefined,
    signal,
  );
}

/** Read authoritative balances and the most recent admin grant records. */
export function fetchUserRewards(userId: string, signal?: AbortSignal) {
  return adminFetch(
    `/admin/users/${encodeURIComponent(userId)}/rewards`,
    (value) => adminUserRewardsSchema.parse(value),
    undefined,
    signal,
  );
}

/** Submit or replay one confirmed grant; callers retain its ID until the result is known. */
export function grantUserReward(userId: string, input: AdminRewardInput) {
  return adminFetch(
    `/admin/users/${encodeURIComponent(userId)}/rewards`,
    (value) => adminRewardGrantSchema.parse(value),
    undefined,
    undefined,
    input,
  );
}

export function fetchStats(from: string, to: string, signal?: AbortSignal) {
  return adminFetch('/admin/stats', parseAdminStatsResponse, { from, to }, signal);
}

/** Read account-wide analytics without consuming D1 rows. */
export function fetchD1Usage(signal?: AbortSignal) {
  return adminFetch('/admin/d1-usage', parseAdminD1UsageResponse, undefined, signal);
}

/** Read sampled query rankings and trends without querying D1. */
export function fetchD1Insights(
  range: AdminD1Range,
  sort: AdminD1Sort,
  bucket: string | null,
  signal?: AbortSignal,
) {
  return adminFetch(
    '/admin/d1-insights',
    parseAdminD1InsightsResponse,
    {
      range,
      sort,
      ...(bucket === null ? {} : { bucket }),
    },
    signal,
  );
}

export function fetchAnalytics(from: string, to: string, signal?: AbortSignal) {
  return adminFetch('/admin/analytics', parseAdminAnalyticsResponse, { from, to }, signal);
}

export function fetchAIUsage(from: string, to: string, signal?: AbortSignal) {
  return adminFetch('/admin/ai-usage', parseAdminAIUsageResponse, { from, to }, signal);
}

export function fetchRequestTraffic(from: string, to: string, signal?: AbortSignal) {
  return adminFetch(
    '/admin/request-traffic',
    parseAdminRequestTrafficResponse,
    { from, to },
    signal,
  );
}

export function fetchGameWordsStats(
  game: GameWordGame,
  signal?: AbortSignal,
): Promise<GameWordsStats> {
  return adminFetch('/admin/games/words/stats', parseGameWordsStatsResponse, { game }, signal);
}

export function triggerGameWordSupply(
  game: GameWordGame,
  force: boolean,
): Promise<TriggerSupplyResult> {
  return adminFetch(
    '/admin/games/words/trigger-supply',
    parseTriggerSupplyResult,
    undefined,
    undefined,
    {
      game,
      force,
    },
  );
}
