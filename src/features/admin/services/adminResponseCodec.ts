/** Exact runtime decoders for every admin endpoint response. */

import { parseGameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import { parseRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';

import type {
  AdminAIUsage,
  AdminAnalytics,
  AdminRequestTraffic,
  AdminRoom,
  AdminRoomPlayer,
  AdminRoomPlayersResponse,
  AdminRoomsResponse,
  AdminStats,
  AdminUser,
  AdminUsersResponse,
} from '@/features/admin/model/adminContracts';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function assertExactKeys(value: JsonObject, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const canonicalExpected = [...expected].sort();
  if (
    actual.length !== canonicalExpected.length ||
    actual.some((key, index) => key !== canonicalExpected[index])
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function parseString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  return value;
}

function parseNonEmptyString(value: unknown, label: string): string {
  const parsed = parseString(value, label);
  if (parsed.length === 0) throw new Error(`${label} must not be empty`);
  return parsed;
}

function parseNullableString(value: unknown, label: string): string | null {
  return value === null ? null : parseString(value, label);
}

function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`);
  return value;
}

function parseNonnegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function parseNonnegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
  return value;
}

function parseSafeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return value;
}

function parseHttpStatus(value: unknown, label: string): number {
  const status = parseSafeInteger(value, label);
  if (status < 100 || status > 599) throw new Error(`${label} must be an HTTP status code`);
  return status;
}

function parsePercentage(value: unknown, label: string): number {
  const percentage = parseNonnegativeNumber(value, label);
  if (percentage > 100) throw new Error(`${label} must not exceed 100`);
  return percentage;
}

function parseArray<T>(
  value: unknown,
  label: string,
  parseItem: (item: unknown, itemLabel: string) => T,
): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((item, index) => parseItem(item, `${label}[${index}]`));
}

function parseAdminUser(value: unknown, label: string): AdminUser {
  const object = requireObject(value, label);
  assertExactKeys(
    object,
    [
      'id',
      'displayName',
      'email',
      'isAnonymous',
      'lastCountry',
      'lastColo',
      'createdAt',
      'updatedAt',
      'level',
      'xp',
      'gamesPlayed',
    ],
    label,
  );
  return {
    id: parseNonEmptyString(object.id, `${label}.id`),
    displayName: parseNullableString(object.displayName, `${label}.displayName`),
    email: parseNullableString(object.email, `${label}.email`),
    isAnonymous: parseBoolean(object.isAnonymous, `${label}.isAnonymous`),
    lastCountry: parseNullableString(object.lastCountry, `${label}.lastCountry`),
    lastColo: parseNullableString(object.lastColo, `${label}.lastColo`),
    createdAt: parseString(object.createdAt, `${label}.createdAt`),
    updatedAt: parseString(object.updatedAt, `${label}.updatedAt`),
    level: parseNonnegativeInteger(object.level, `${label}.level`),
    xp: parseNonnegativeInteger(object.xp, `${label}.xp`),
    gamesPlayed: parseNonnegativeInteger(object.gamesPlayed, `${label}.gamesPlayed`),
  };
}

function parseRoomStatus(value: unknown, label: string): AdminRoom['status'] {
  if (value !== 'creating' && value !== 'active' && value !== 'deleting' && value !== 'failed') {
    throw new Error(`${label} must be a canonical room status`);
  }
  return value;
}

function parseAdminRoom(value: unknown, label: string): AdminRoom {
  const object = requireObject(value, label);
  assertExactKeys(
    object,
    [
      'id',
      'code',
      'gameType',
      'status',
      'reconciliationAttemptCount',
      'reconcileAfter',
      'lastError',
      'hostUserId',
      'hostName',
      'hostCountry',
      'gamesStarted',
      'lastStartedAt',
      'participantCount',
      'createdAt',
    ],
    label,
  );
  return {
    id: parseNonEmptyString(object.id, `${label}.id`),
    code: parseRoomCode(object.code),
    gameType: parseGameType(object.gameType),
    status: parseRoomStatus(object.status, `${label}.status`),
    reconciliationAttemptCount: parseNonnegativeInteger(
      object.reconciliationAttemptCount,
      `${label}.reconciliationAttemptCount`,
    ),
    reconcileAfter: parseNullableString(object.reconcileAfter, `${label}.reconcileAfter`),
    lastError: parseNullableString(object.lastError, `${label}.lastError`),
    hostUserId: parseNonEmptyString(object.hostUserId, `${label}.hostUserId`),
    hostName: parseNullableString(object.hostName, `${label}.hostName`),
    hostCountry: parseNullableString(object.hostCountry, `${label}.hostCountry`),
    gamesStarted: parseNonnegativeInteger(object.gamesStarted, `${label}.gamesStarted`),
    lastStartedAt: parseNullableString(object.lastStartedAt, `${label}.lastStartedAt`),
    participantCount: parseNonnegativeInteger(object.participantCount, `${label}.participantCount`),
    createdAt: parseString(object.createdAt, `${label}.createdAt`),
  };
}

function parseAdminRoomPlayer(value: unknown, label: string): AdminRoomPlayer {
  const object = requireObject(value, label);
  assertExactKeys(
    object,
    [
      'userId',
      'displayName',
      'lastCountry',
      'lastColo',
      'createdAt',
      'joinedAt',
      'level',
      'xp',
      'gamesPlayed',
    ],
    label,
  );
  return {
    userId: parseNonEmptyString(object.userId, `${label}.userId`),
    displayName: parseNullableString(object.displayName, `${label}.displayName`),
    lastCountry: parseNullableString(object.lastCountry, `${label}.lastCountry`),
    lastColo: parseNullableString(object.lastColo, `${label}.lastColo`),
    createdAt: parseString(object.createdAt, `${label}.createdAt`),
    joinedAt: parseString(object.joinedAt, `${label}.joinedAt`),
    level: parseNonnegativeInteger(object.level, `${label}.level`),
    xp: parseNonnegativeInteger(object.xp, `${label}.xp`),
    gamesPlayed: parseNonnegativeInteger(object.gamesPlayed, `${label}.gamesPlayed`),
  };
}

function parseNamedCount(
  value: unknown,
  label: string,
  name: 'country' | 'colo' | 'isp' | 'label',
): { readonly nameValue: string; readonly count: number } {
  const object = requireObject(value, label);
  assertExactKeys(object, [name, 'count'], label);
  return {
    nameValue: parseString(object[name], `${label}.${name}`),
    count: parseNonnegativeInteger(object.count, `${label}.count`),
  };
}

export function parseAdminErrorResponse(value: unknown): string {
  const object = requireObject(value, 'Admin error response');
  assertExactKeys(object, ['success', 'reason'], 'Admin error response');
  if (object.success !== false) throw new Error('Admin error response success must be false');
  return parseNonEmptyString(object.reason, 'Admin error response reason');
}

export function parseAdminUsersResponse(value: unknown): AdminUsersResponse {
  const object = requireObject(value, 'Admin users response');
  assertExactKeys(object, ['users', 'total', 'page', 'limit'], 'Admin users response');
  return {
    users: parseArray(object.users, 'Admin users', parseAdminUser),
    total: parseNonnegativeInteger(object.total, 'Admin users total'),
    page: parseNonnegativeInteger(object.page, 'Admin users page'),
    limit: parseNonnegativeInteger(object.limit, 'Admin users limit'),
  };
}

export function parseAdminRoomsResponse(value: unknown): AdminRoomsResponse {
  const object = requireObject(value, 'Admin rooms response');
  assertExactKeys(object, ['rooms', 'total', 'page', 'limit'], 'Admin rooms response');
  return {
    rooms: parseArray(object.rooms, 'Admin rooms', parseAdminRoom),
    total: parseNonnegativeInteger(object.total, 'Admin rooms total'),
    page: parseNonnegativeInteger(object.page, 'Admin rooms page'),
    limit: parseNonnegativeInteger(object.limit, 'Admin rooms limit'),
  };
}

export function parseAdminRoomPlayersResponse(value: unknown): AdminRoomPlayersResponse {
  const object = requireObject(value, 'Admin room players response');
  assertExactKeys(object, ['players'], 'Admin room players response');
  return {
    players: parseArray(object.players, 'Admin room players', parseAdminRoomPlayer),
  };
}

export function parseAdminStatsResponse(value: unknown): AdminStats {
  const object = requireObject(value, 'Admin stats response');
  assertExactKeys(
    object,
    ['registered', 'active', 'totalGames', 'countries', 'colos'],
    'Admin stats response',
  );
  return {
    registered: parseNonnegativeInteger(object.registered, 'Admin stats registered'),
    active: parseNonnegativeInteger(object.active, 'Admin stats active'),
    totalGames: parseNonnegativeInteger(object.totalGames, 'Admin stats totalGames'),
    countries: parseArray(object.countries, 'Admin stats countries', (item, label) => {
      const { nameValue, count } = parseNamedCount(item, label, 'country');
      return { country: nameValue, count };
    }),
    colos: parseArray(object.colos, 'Admin stats colos', (item, label) => {
      const { nameValue, count } = parseNamedCount(item, label, 'colo');
      return { colo: nameValue, count };
    }),
  };
}

export function parseAdminAnalyticsResponse(value: unknown): AdminAnalytics {
  const object = requireObject(value, 'Admin analytics response');
  assertExactKeys(
    object,
    ['avgLoadMs', 'avgTtfbMs', 'totalRequests', 'countries', 'colos', 'isps'],
    'Admin analytics response',
  );
  return {
    avgLoadMs: parseNonnegativeNumber(object.avgLoadMs, 'Admin analytics avgLoadMs'),
    avgTtfbMs: parseNonnegativeNumber(object.avgTtfbMs, 'Admin analytics avgTtfbMs'),
    totalRequests: parseNonnegativeInteger(object.totalRequests, 'Admin analytics totalRequests'),
    countries: parseArray(object.countries, 'Admin analytics countries', (item, label) => {
      const country = requireObject(item, label);
      assertExactKeys(country, ['country', 'count', 'avgLoadMs'], label);
      return {
        country: parseString(country.country, `${label}.country`),
        count: parseNonnegativeInteger(country.count, `${label}.count`),
        avgLoadMs: parseNonnegativeNumber(country.avgLoadMs, `${label}.avgLoadMs`),
      };
    }),
    colos: parseArray(object.colos, 'Admin analytics colos', (item, label) => {
      const { nameValue, count } = parseNamedCount(item, label, 'colo');
      return { colo: nameValue, count };
    }),
    isps: parseArray(object.isps, 'Admin analytics isps', (item, label) => {
      const { nameValue, count } = parseNamedCount(item, label, 'isp');
      return { isp: nameValue, count };
    }),
  };
}

export function parseAdminAIUsageResponse(value: unknown): AdminAIUsage {
  const object = requireObject(value, 'Admin AI usage response');
  assertExactKeys(
    object,
    [
      'totalRequests',
      'avgTtfrMs',
      'errorRate',
      'providers',
      'models',
      'countries',
      'statuses',
      'topUsers',
    ],
    'Admin AI usage response',
  );
  const parseLabelCounts = (valueToParse: unknown, label: string) =>
    parseArray(valueToParse, label, (item, itemLabel) => {
      const { nameValue, count } = parseNamedCount(item, itemLabel, 'label');
      return { label: nameValue, count };
    });
  return {
    totalRequests: parseNonnegativeInteger(object.totalRequests, 'Admin AI usage totalRequests'),
    avgTtfrMs: parseNonnegativeNumber(object.avgTtfrMs, 'Admin AI usage avgTtfrMs'),
    errorRate: parseNonnegativeNumber(object.errorRate, 'Admin AI usage errorRate'),
    providers: parseLabelCounts(object.providers, 'Admin AI usage providers'),
    models: parseLabelCounts(object.models, 'Admin AI usage models'),
    countries: parseLabelCounts(object.countries, 'Admin AI usage countries'),
    statuses: parseLabelCounts(object.statuses, 'Admin AI usage statuses'),
    topUsers: parseArray(object.topUsers, 'Admin AI usage topUsers', (item, label) => {
      const topUser = requireObject(item, label);
      assertExactKeys(topUser, ['userId', 'displayName', 'count'], label);
      return {
        userId: parseNonEmptyString(topUser.userId, `${label}.userId`),
        displayName: parseNullableString(topUser.displayName, `${label}.displayName`),
        count: parseNonnegativeInteger(topUser.count, `${label}.count`),
      };
    }),
  };
}

export function parseAdminRequestTrafficResponse(value: unknown): AdminRequestTraffic {
  const object = requireObject(value, 'Admin request traffic response');
  assertExactKeys(
    object,
    ['generatedAt', 'platform', 'requestCountDelta', 'http', 'realtime'],
    'Admin request traffic response',
  );

  const platform = requireObject(object.platform, 'Admin request traffic platform');
  assertExactKeys(
    platform,
    ['requests', 'errors', 'subrequests'],
    'Admin request traffic platform',
  );
  const http = requireObject(object.http, 'Admin request traffic HTTP');
  assertExactKeys(
    http,
    [
      'totalRequests',
      'clientErrorRequests',
      'serverErrorRequests',
      'successfulWebSocketConnections',
      'failedWebSocketConnections',
      'routes',
      'series',
    ],
    'Admin request traffic HTTP',
  );
  const realtime = requireObject(object.realtime, 'Admin request traffic realtime');
  assertExactKeys(
    realtime,
    ['stateSyncRequests', 'userEventAcks', 'invalidClientMessages'],
    'Admin request traffic realtime',
  );

  return {
    generatedAt: parseNonEmptyString(object.generatedAt, 'Admin request traffic generatedAt'),
    platform: {
      requests: parseNonnegativeInteger(platform.requests, 'Admin request traffic requests'),
      errors: parseNonnegativeInteger(platform.errors, 'Admin request traffic errors'),
      subrequests: parseNonnegativeInteger(
        platform.subrequests,
        'Admin request traffic subrequests',
      ),
    },
    requestCountDelta: parseSafeInteger(
      object.requestCountDelta,
      'Admin request traffic requestCountDelta',
    ),
    http: {
      totalRequests: parseNonnegativeInteger(
        http.totalRequests,
        'Admin request traffic totalRequests',
      ),
      clientErrorRequests: parseNonnegativeInteger(
        http.clientErrorRequests,
        'Admin request traffic clientErrorRequests',
      ),
      serverErrorRequests: parseNonnegativeInteger(
        http.serverErrorRequests,
        'Admin request traffic serverErrorRequests',
      ),
      successfulWebSocketConnections: parseNonnegativeInteger(
        http.successfulWebSocketConnections,
        'Admin request traffic successfulWebSocketConnections',
      ),
      failedWebSocketConnections: parseNonnegativeInteger(
        http.failedWebSocketConnections,
        'Admin request traffic failedWebSocketConnections',
      ),
      routes: parseArray(http.routes, 'Admin request traffic routes', (item, label) => {
        const route = requireObject(item, label);
        assertExactKeys(
          route,
          [
            'method',
            'route',
            'count',
            'errorCount',
            'avgDurationMs',
            'sharePercent',
            'statusCounts',
          ],
          label,
        );
        return {
          method: parseNonEmptyString(route.method, `${label}.method`),
          route: parseNonEmptyString(route.route, `${label}.route`),
          count: parseNonnegativeInteger(route.count, `${label}.count`),
          errorCount: parseNonnegativeInteger(route.errorCount, `${label}.errorCount`),
          avgDurationMs: parseNonnegativeNumber(route.avgDurationMs, `${label}.avgDurationMs`),
          sharePercent: parsePercentage(route.sharePercent, `${label}.sharePercent`),
          statusCounts: parseArray(
            route.statusCounts,
            `${label}.statusCounts`,
            (item, itemLabel) => {
              const statusCount = requireObject(item, itemLabel);
              assertExactKeys(statusCount, ['status', 'count'], itemLabel);
              return {
                status: parseHttpStatus(statusCount.status, `${itemLabel}.status`),
                count: parseNonnegativeInteger(statusCount.count, `${itemLabel}.count`),
              };
            },
          ),
        };
      }),
      series: parseArray(http.series, 'Admin request traffic series', (item, label) => {
        const point = requireObject(item, label);
        assertExactKeys(point, ['timestamp', 'count'], label);
        return {
          timestamp: parseNonEmptyString(point.timestamp, `${label}.timestamp`),
          count: parseNonnegativeInteger(point.count, `${label}.count`),
        };
      }),
    },
    realtime: {
      stateSyncRequests: parseNonnegativeInteger(
        realtime.stateSyncRequests,
        'Admin request traffic stateSyncRequests',
      ),
      userEventAcks: parseNonnegativeInteger(
        realtime.userEventAcks,
        'Admin request traffic userEventAcks',
      ),
      invalidClientMessages: parseNonnegativeInteger(
        realtime.invalidClientMessages,
        'Admin request traffic invalidClientMessages',
      ),
    },
  };
}
