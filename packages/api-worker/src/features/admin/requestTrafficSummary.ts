/** Sampling-aware request traffic query planning and Admin response aggregation. */

import { WEBSOCKET_MESSAGE_EVENT_KIND } from '../../platform/telemetry/realtimeTraffic';
import { HTTP_REQUEST_EVENT_KIND } from '../../platform/telemetry/requestTraffic';
import type {
  RealtimeTrafficAnalyticsRow,
  RequestTrafficAnalyticsRow,
} from './providers/analyticsEngine';
import type { WorkerInvocationAnalytics } from './providers/workerAnalytics';

const SECOND_MS = 1_000;
const MINUTE_SECONDS = 60;
const FIVE_MINUTES_SECONDS = 5 * MINUTE_SECONDS;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const SIX_HOURS_SECONDS = 6 * HOUR_SECONDS;
const HOUR_MS = 60 * 60 * SECOND_MS;
const DAY_MS = 24 * HOUR_MS;
const PERCENT_SCALE = 100;
const WEBSOCKET_ROUTE = '/ws';
const WEBSOCKET_UPGRADE_STATUS = 101;

export const REQUEST_TRAFFIC_MAX_RANGE_MS = 30 * DAY_MS;

export interface RequestTrafficQueryPlan {
  readonly bucketSeconds: number;
  readonly httpSql: string;
  readonly realtimeSql: string;
}

export interface AdminRequestTrafficSummary {
  readonly generatedAt: string;
  readonly platform: WorkerInvocationAnalytics;
  readonly requestCountDelta: number;
  readonly http: {
    readonly totalRequests: number;
    readonly clientErrorRequests: number;
    readonly serverErrorRequests: number;
    readonly successfulWebSocketConnections: number;
    readonly failedWebSocketConnections: number;
    readonly routes: ReadonlyArray<{
      readonly method: string;
      readonly route: string;
      readonly count: number;
      readonly errorCount: number;
      readonly avgDurationMs: number;
      readonly sharePercent: number;
      readonly statusCounts: ReadonlyArray<{
        readonly status: number;
        readonly count: number;
      }>;
    }>;
    readonly series: ReadonlyArray<{ readonly timestamp: string; readonly count: number }>;
  };
  readonly realtime: {
    readonly stateSyncRequests: number;
    readonly userEventAcks: number;
    readonly invalidClientMessages: number;
  };
}

interface SummaryRange {
  readonly fromDate: Date;
  readonly toDate: Date;
  readonly bucketSeconds: number;
}

interface MutableRouteMetric {
  readonly method: string;
  readonly route: string;
  count: number;
  errorCount: number;
  durationTotalMs: number;
  readonly statusCounts: Map<number, number>;
}

function selectBucketSeconds(durationMs: number): number {
  if (durationMs <= 6 * HOUR_MS) return MINUTE_SECONDS;
  if (durationMs <= 2 * DAY_MS) return FIVE_MINUTES_SECONDS;
  if (durationMs <= 14 * DAY_MS) return HOUR_SECONDS;
  return SIX_HOURS_SECONDS;
}

function toAnalyticsDateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}

/** Build bounded SQL queries whose counts remain correct under Analytics Engine sampling. */
export function createRequestTrafficQueryPlan(
  fromDate: Date,
  toDate: Date,
): RequestTrafficQueryPlan {
  const durationMs = toDate.getTime() - fromDate.getTime();
  if (durationMs <= 0 || durationMs > REQUEST_TRAFFIC_MAX_RANGE_MS) {
    throw new Error('Request traffic range must be positive and no greater than 30 days');
  }
  const bucketSeconds = selectBucketSeconds(durationMs);
  const analyticsFrom = toAnalyticsDateTime(fromDate);
  const analyticsTo = toAnalyticsDateTime(toDate);
  const rangePredicate = `timestamp >= toDateTime('${analyticsFrom}') AND timestamp < toDateTime('${analyticsTo}')`;

  return {
    bucketSeconds,
    httpSql: `
      SELECT
        intDiv(toUInt32(timestamp), ${bucketSeconds}) * ${bucketSeconds} AS bucket,
        blob2 AS method,
        blob3 AS route,
        blob4 AS status,
        SUM(_sample_interval) AS requestCount,
        SUM(_sample_interval * double1) AS durationTotalMs
      FROM request_traffic
      WHERE blob1 = '${HTTP_REQUEST_EVENT_KIND}' AND ${rangePredicate}
      GROUP BY bucket, method, route, status
      ORDER BY bucket ASC, requestCount DESC
    `,
    realtimeSql: `
      SELECT
        blob2 AS messageType,
        SUM(_sample_interval) AS messageCount
      FROM request_traffic
      WHERE blob1 = '${WEBSOCKET_MESSAGE_EVENT_KIND}' AND ${rangePredicate}
      GROUP BY messageType
      ORDER BY messageCount DESC
    `,
  };
}

function createTrafficSeries(
  countsByBucket: ReadonlyMap<number, number>,
  range: SummaryRange,
): Array<{ timestamp: string; count: number }> {
  const fromSeconds = Math.floor(range.fromDate.getTime() / SECOND_MS);
  const toSeconds = Math.ceil(range.toDate.getTime() / SECOND_MS);
  const firstBucket = Math.floor(fromSeconds / range.bucketSeconds) * range.bucketSeconds;
  const series: Array<{ timestamp: string; count: number }> = [];
  for (let bucket = firstBucket; bucket < toSeconds; bucket += range.bucketSeconds) {
    series.push({
      timestamp: new Date(bucket * SECOND_MS).toISOString(),
      count: countsByBucket.get(bucket) ?? 0,
    });
  }
  return series;
}

/** Aggregate strict provider rows into the Admin request-traffic response contract. */
export function createAdminRequestTrafficSummary(
  platform: WorkerInvocationAnalytics,
  httpRows: readonly RequestTrafficAnalyticsRow[],
  realtimeRows: readonly RealtimeTrafficAnalyticsRow[],
  range: SummaryRange,
  generatedAt: string,
): AdminRequestTrafficSummary {
  let totalRequests = 0;
  let clientErrorRequests = 0;
  let serverErrorRequests = 0;
  let successfulWebSocketConnections = 0;
  let failedWebSocketConnections = 0;
  const routesByKey = new Map<string, MutableRouteMetric>();
  const countsByBucket = new Map<number, number>();

  for (const row of httpRows) {
    totalRequests += row.requestCount;
    countsByBucket.set(row.bucket, (countsByBucket.get(row.bucket) ?? 0) + row.requestCount);
    if (row.status >= 400 && row.status < 500) clientErrorRequests += row.requestCount;
    if (row.status >= 500) serverErrorRequests += row.requestCount;
    if (row.route === WEBSOCKET_ROUTE) {
      if (row.status === WEBSOCKET_UPGRADE_STATUS) {
        successfulWebSocketConnections += row.requestCount;
      } else {
        failedWebSocketConnections += row.requestCount;
      }
    }

    const routeKey = JSON.stringify([row.method, row.route]);
    const existing = routesByKey.get(routeKey);
    if (existing === undefined) {
      routesByKey.set(routeKey, {
        method: row.method,
        route: row.route,
        count: row.requestCount,
        errorCount: row.status >= 400 ? row.requestCount : 0,
        durationTotalMs: row.durationTotalMs,
        statusCounts: new Map([[row.status, row.requestCount]]),
      });
    } else {
      existing.count += row.requestCount;
      existing.errorCount += row.status >= 400 ? row.requestCount : 0;
      existing.durationTotalMs += row.durationTotalMs;
      existing.statusCounts.set(
        row.status,
        (existing.statusCounts.get(row.status) ?? 0) + row.requestCount,
      );
    }
  }

  const realtime = {
    stateSyncRequests: 0,
    userEventAcks: 0,
    invalidClientMessages: 0,
  };
  for (const row of realtimeRows) {
    switch (row.messageType) {
      case 'STATE_SYNC_REQUEST':
        realtime.stateSyncRequests += row.messageCount;
        break;
      case 'USER_EVENT_ACK':
        realtime.userEventAcks += row.messageCount;
        break;
      case 'INVALID_CLIENT_MESSAGE':
        realtime.invalidClientMessages += row.messageCount;
        break;
    }
  }

  const routes = [...routesByKey.values()]
    .map((route) => ({
      method: route.method,
      route: route.route,
      count: route.count,
      errorCount: route.errorCount,
      avgDurationMs: Math.round(route.durationTotalMs / route.count),
      sharePercent: (route.count / totalRequests) * PERCENT_SCALE,
      statusCounts: [...route.statusCounts.entries()]
        .sort(([leftStatus], [rightStatus]) => leftStatus - rightStatus)
        .map(([status, count]) => ({ status, count })),
    }))
    .sort((left, right) => right.count - left.count || left.route.localeCompare(right.route));

  return {
    generatedAt,
    platform,
    requestCountDelta: platform.requests - totalRequests,
    http: {
      totalRequests,
      clientErrorRequests,
      serverErrorRequests,
      successfulWebSocketConnections,
      failedWebSocketConnections,
      routes,
      series: createTrafficSeries(countsByBucket, range),
    },
    realtime,
  };
}
