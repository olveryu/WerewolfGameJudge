/** Admin request traffic query and aggregation tests. */

import { describe, expect, it } from 'vitest';

import {
  createAdminRequestTrafficSummary,
  createRequestTrafficQueryPlan,
} from '../requestTrafficSummary';

describe('request traffic summary', () => {
  it('uses sampling weights and range-appropriate time buckets', () => {
    const plan = createRequestTrafficQueryPlan(
      new Date('2026-08-31T00:00:00.000Z'),
      new Date('2026-08-31T01:00:00.000Z'),
    );

    expect(plan.bucketSeconds).toBe(60);
    expect(plan.httpSql).toContain('SUM(_sample_interval) AS requestCount');
    expect(plan.httpSql).toContain('SUM(_sample_interval * double1) AS durationTotalMs');
    expect(plan.httpSql).toContain("blob1 = 'HTTP_REQUEST'");
    expect(plan.realtimeSql).toContain("blob1 = 'WEBSOCKET_MESSAGE'");
  });

  it('aggregates routes, errors, legacy polling, WebSocket traffic, and empty buckets', () => {
    const fromDate = new Date('2026-08-31T00:00:00.000Z');
    const toDate = new Date('2026-08-31T00:02:00.000Z');
    const firstBucket = fromDate.getTime() / 1_000;
    const summary = createAdminRequestTrafficSummary(
      { requests: 25, errors: 1, subrequests: 6 },
      [
        {
          bucket: firstBucket,
          method: 'POST',
          route: '/room/command',
          status: 200,
          requestCount: 10,
          durationTotalMs: 100,
        },
        {
          bucket: firstBucket,
          method: 'POST',
          route: '/room/command',
          status: 500,
          requestCount: 2,
          durationTotalMs: 100,
        },
        {
          bucket: firstBucket,
          method: 'POST',
          route: '/room/state',
          status: 404,
          requestCount: 3,
          durationTotalMs: 30,
        },
        {
          bucket: firstBucket,
          method: 'GET',
          route: '/ws',
          status: 101,
          requestCount: 4,
          durationTotalMs: 40,
        },
        {
          bucket: firstBucket,
          method: 'GET',
          route: '/ws',
          status: 401,
          requestCount: 1,
          durationTotalMs: 5,
        },
      ],
      [
        { messageType: 'STATE_SYNC_REQUEST', messageCount: 6 },
        { messageType: 'USER_EVENT_ACK', messageCount: 2 },
        { messageType: 'INVALID_CLIENT_MESSAGE', messageCount: 1 },
      ],
      { fromDate, toDate, bucketSeconds: 60 },
      '2026-08-31T00:02:00.000Z',
    );

    expect(summary).toMatchObject({
      generatedAt: '2026-08-31T00:02:00.000Z',
      platform: { requests: 25, errors: 1, subrequests: 6 },
      requestCountDelta: 5,
      http: {
        totalRequests: 20,
        clientErrorRequests: 4,
        serverErrorRequests: 2,
        legacyRoomStateRequests: 3,
        successfulWebSocketConnections: 4,
        failedWebSocketConnections: 1,
      },
      realtime: {
        stateSyncRequests: 6,
        userEventAcks: 2,
        invalidClientMessages: 1,
      },
    });
    expect(summary.http.routes[0]).toEqual({
      method: 'POST',
      route: '/room/command',
      count: 12,
      errorCount: 2,
      avgDurationMs: 17,
      sharePercent: 60,
      statusCounts: [
        { status: 200, count: 10 },
        { status: 500, count: 2 },
      ],
    });
    expect(summary.http.series).toEqual([
      { timestamp: '2026-08-31T00:00:00.000Z', count: 20 },
      { timestamp: '2026-08-31T00:01:00.000Z', count: 0 },
    ]);
  });
});
