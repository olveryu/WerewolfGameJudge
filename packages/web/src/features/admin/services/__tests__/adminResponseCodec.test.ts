import { GAME_WORD_GAMES } from '@game-judge/game-engine/product/wordSupply';

import { parseAdminErrorResponse } from '@/features/admin/services/adminAuth';
import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminD1InsightsResponse,
  parseAdminRequestTrafficResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
  parseGameWordsStatsResponse,
  parseLibraryItemsResponse,
  parseTriggerSupplyResult,
} from '@/features/admin/services/adminResponseCodec';

describe('adminResponseCodec', () => {
  it('rejects raw SQL and invalid metrics in D1 insights', () => {
    const base = {
      from: '2026-11-12T00:00:00Z',
      to: '2026-11-12T01:00:00Z',
      generatedAt: '2026-11-12T01:00:00Z',
      queries: [{ id: 'id', label: '未识别查询', reads: 12, writes: 1, count: 2 }],
      series: [{ timestamp: '2026-11-12T00:00:00Z', reads: 12, writes: 1 }],
    };
    expect(parseAdminD1InsightsResponse(base)).toEqual(base);
    expect(() =>
      parseAdminD1InsightsResponse({
        ...base,
        queries: [{ ...base.queries[0], query: 'secret' }],
      }),
    ).toThrow();
    expect(() =>
      parseAdminD1InsightsResponse({
        ...base,
        series: [{ timestamp: 'invalid', reads: -1, writes: 0 }],
      }),
    ).toThrow();
  });

  it('decodes every current admin response contract', () => {
    expect(
      parseAdminUsersResponse({
        users: [
          {
            id: 'user-1',
            displayName: null,
            email: null,
            isAnonymous: true,
            lastCountry: null,
            lastColo: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-02',
            level: 0,
            xp: 0,
            gamesPlayed: 0,
          },
        ],
        nextCursor: null,
      }).users[0]?.id,
    ).toBe('user-1');

    expect(
      parseAdminRoomsResponse({
        rooms: [
          {
            id: 'room-id',
            code: '1234',
            gameType: 'fibking',
            status: 'active',
            reconciliationAttemptCount: 0,
            reconcileAfter: null,
            lastError: null,
            hostUserId: 'host-1',
            hostName: null,
            hostCountry: null,
            gamesStarted: 1,
            lastStartedAt: null,
            participantCount: 4,
            createdAt: '2026-01-01',
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      }).rooms[0]?.gameType,
    ).toBe('fibking');

    expect(
      parseAdminRoomPlayersResponse({
        players: [
          {
            userId: 'user-1',
            displayName: null,
            lastCountry: null,
            lastColo: null,
            createdAt: '2026-01-01',
            joinedAt: '2026-01-02',
            level: 0,
            xp: 0,
            gamesPlayed: 0,
          },
        ],
      }).players,
    ).toHaveLength(1);

    expect(
      parseAdminStatsResponse({
        registered: 1,
        active: 1,
        totalGames: 2,
        countries: [{ country: 'US', count: 1 }],
        colos: [{ colo: 'IAD', count: 1 }],
      }).totalGames,
    ).toBe(2);

    expect(
      parseAdminAnalyticsResponse({
        avgLoadMs: 12,
        avgTtfbMs: 3,
        totalRequests: 1,
        countries: [{ country: 'US', count: 1, avgLoadMs: 12 }],
        colos: [{ colo: 'IAD', count: 1 }],
        isps: [{ isp: 'Example', count: 1 }],
      }).avgLoadMs,
    ).toBe(12);

    expect(
      parseAdminAIUsageResponse({
        totalRequests: 1,
        avgTtfrMs: 8,
        errorRate: 0,
        providers: [{ label: 'provider', count: 1 }],
        models: [{ label: 'model', count: 1 }],
        countries: [{ label: 'US', count: 1 }],
        statuses: [{ label: 'ok', count: 1 }],
        topUsers: [{ userId: 'user-1', displayName: null, count: 1 }],
      }).providers[0]?.label,
    ).toBe('provider');

    expect(
      parseAdminRequestTrafficResponse({
        generatedAt: '2026-08-31T00:02:00.000Z',
        platform: { requests: 25, errors: 1, subrequests: 6 },
        requestCountDelta: -2,
        http: {
          totalRequests: 27,
          clientErrorRequests: 2,
          serverErrorRequests: 1,
          successfulWebSocketConnections: 4,
          failedWebSocketConnections: 1,
          routes: [
            {
              method: 'POST',
              route: '/room/command',
              count: 12,
              errorCount: 1,
              avgDurationMs: 17,
              sharePercent: 44.4,
              statusCounts: [
                { status: 200, count: 11 },
                { status: 500, count: 1 },
              ],
            },
          ],
          series: [{ timestamp: '2026-08-31T00:00:00.000Z', count: 12 }],
        },
        realtime: {
          stateSyncRequests: 6,
          commandRequests: 6,
          stateUpdateBroadcasts: 3,
          stateUpdateDeliveries: 12,
          stateUpdateBytes: 2400,
          downlinkDeliveries: 17,
          downlinkBytes: 3300,
          invalidClientMessages: 1,
        },
      }).requestCountDelta,
    ).toBe(-2);

    expect(parseAdminErrorResponse({ success: false, reason: 'INTERNAL_ERROR' })).toBe(
      'INTERNAL_ERROR',
    );
  });

  it.each([
    () => parseAdminErrorResponse({ reason: 'INTERNAL_ERROR' }),
    () => parseAdminUsersResponse({ users: [], total: 0, page: 1, limit: 50, extra: true }),
    () =>
      parseAdminRoomsResponse({
        rooms: [],
        total: 0,
        page: 1,
        limit: Number.NaN,
      }),
    () =>
      parseAdminAnalyticsResponse({
        avgLoadMs: -1,
        avgTtfbMs: 0,
        totalRequests: 0,
        countries: [],
        colos: [],
        isps: [],
      }),
    () =>
      parseAdminRequestTrafficResponse({
        generatedAt: '2026-08-31T00:02:00.000Z',
        platform: { requests: 1, errors: 0, subrequests: 0 },
        requestCountDelta: 0,
        http: {
          totalRequests: -1,
          clientErrorRequests: 0,
          serverErrorRequests: 0,
          successfulWebSocketConnections: 0,
          failedWebSocketConnections: 0,
          routes: [],
          series: [],
        },
        realtime: {
          stateSyncRequests: 0,
          stateUpdateBroadcasts: 0,
          commandRequests: 0,
          stateUpdateDeliveries: 0,
          stateUpdateBytes: 0,
          downlinkDeliveries: 0,
          downlinkBytes: 0,
          invalidClientMessages: 0,
        },
      }),
    () =>
      parseAdminRequestTrafficResponse({
        generatedAt: '2026-08-31T00:02:00.000Z',
        platform: { requests: 1, errors: 0, subrequests: 0 },
        requestCountDelta: 0,
        http: {
          totalRequests: 1,
          clientErrorRequests: 0,
          serverErrorRequests: 0,
          successfulWebSocketConnections: 0,
          failedWebSocketConnections: 0,
          routes: [
            {
              method: 'GET',
              route: '/health',
              count: 1,
              errorCount: 0,
              avgDurationMs: 1,
              sharePercent: 100,
              statusCounts: [{ status: 99, count: 1 }],
            },
          ],
          series: [],
        },
        realtime: {
          stateSyncRequests: 0,
          stateUpdateBroadcasts: 0,
          stateUpdateDeliveries: 0,
          commandRequests: 0,
          stateUpdateBytes: 0,
          downlinkDeliveries: 0,
          downlinkBytes: 0,
          invalidClientMessages: 0,
        },
      }),
  ])('fails fast for malformed payloads', (decode) => {
    expect(decode).toThrow();
  });

  it('decodes the game words dashboard including the per-row pack denominator', () => {
    const decoded = parseGameWordsStatsResponse({
      game: 'fibking',
      categories: [
        {
          id: 'literary',
          name: '文学',
          active: 3,
          total: 4,
          pending: 0,
          batches: 1,
          yieldCount: 2,
          lastAttempt: null,
          coolingDown: false,
          menuEligible: null,
        },
      ],
      modelBudget: {
        dailyUsed: 1,
        monthlyUsed: 2,
        byOperation: {
          generation: { dailyUsed: 1, monthlyUsed: 2 },
          review: { dailyUsed: 0, monthlyUsed: 0 },
        },
      },
      tavilyRequestsUsed: 128,
      tavilyMonthlyQuota: 1000,
      reviewDecisions: [{ decision: 'accepted', count: 2 }],
      reviewCheckStats: [{ check: 'isDefinitionAccurate', failCount: 1 }],
      queryLeaderboard: [{ label: '跳舞草', detail: '植物', publishedWords: 5, packs: 2 }],
      supplyEnabled: true,
    });
    expect(decoded.reviewCheckStats).toEqual([{ check: 'isDefinitionAccurate', failCount: 1 }]);
    expect(decoded.queryLeaderboard[0]).toEqual({
      label: '跳舞草',
      detail: '植物',
      publishedWords: 5,
      packs: 2,
    });
    expect(decoded.tavilyRequestsUsed).toBe(128);
    expect(decoded.tavilyMonthlyQuota).toBe(1000);
    // packs is required: a leaderboard row without it is rejected.
    expect(() =>
      parseGameWordsStatsResponse({
        game: 'fibking',
        categories: [],
        modelBudget: {
          dailyUsed: 0,
          monthlyUsed: 0,
          byOperation: {
            generation: { dailyUsed: 0, monthlyUsed: 0 },
            review: { dailyUsed: 0, monthlyUsed: 0 },
          },
        },
        tavilyRequestsUsed: null,
        tavilyMonthlyQuota: null,
        reviewDecisions: [],
        reviewCheckStats: [],
        queryLeaderboard: [{ label: 'x', detail: null, publishedWords: 1 }],
        supplyEnabled: false,
      }),
    ).toThrow();
  });

  it.each(GAME_WORD_GAMES)('accepts %s in dashboard and trigger responses', (game) => {
    const decoded = parseGameWordsStatsResponse({
      game,
      categories: [
        {
          id: 'animals',
          name: '动物',
          active: 0,
          total: 0,
          pending: 0,
          batches: 0,
          yieldCount: 0,
          lastAttempt: null,
          coolingDown: false,
          menuEligible: null,
        },
      ],
      modelBudget: {
        dailyUsed: 0,
        monthlyUsed: 0,
        byOperation: {
          generation: { dailyUsed: 0, monthlyUsed: 0 },
          review: { dailyUsed: 0, monthlyUsed: 0 },
        },
      },
      tavilyRequestsUsed: null,
      tavilyMonthlyQuota: null,
      reviewDecisions: [],
      reviewCheckStats: [],
      queryLeaderboard: [],
      supplyEnabled: true,
    });
    expect(decoded.game).toBe(game);
    const trigger = { game, workflowId: `${game}-manual-1` };
    expect(parseTriggerSupplyResult(trigger)).toEqual(trigger);
  });

  it('rejects unsupported word-supply games', () => {
    expect(() => parseTriggerSupplyResult({ game: 'werewolf', workflowId: 'run' })).toThrow(
      'unsupported game',
    );
  });

  it('decodes library items with supply and agent rows', () => {
    const decoded = parseLibraryItemsResponse({
      game: 'fibking',
      items: [
        {
          id: 'fib-1',
          batchId: 'batch-0',
          agentName: '系统补词',
          game: 'fibking',
          title: '甲',
          category: '法律制度',
          definition: '甲含义。',
          createdAt: '2026-01-01T00:00:00Z',
          status: 'pending',
          duplicateOf: null,
          contentHash: 'def',
          revision: 0,
        },
        {
          id: 'item-1',
          batchId: 'batch-1',
          agentName: 'Muse',
          game: 'fibking',
          title: '乙',
          category: '法律制度',
          definition: '已核实的释义。',
          createdAt: '2026-01-02T00:00:00Z',
          status: 'published',
          duplicateOf: 'inventory:已发布词',
          contentHash: 'abc',
          revision: 1,
        },
      ],
      totals: {
        submissions: { published: 1, failed: 2 },
      },
      nextCursor: '2026-01-02T00:00:00Z|item-1',
    });
    expect(decoded.game).toBe('fibking');
    expect(decoded.items).toHaveLength(2);
    expect(decoded.items[0]?.agentName).toBe('系统补词');
    expect(decoded.items[1]?.agentName).toBe('Muse');
    expect(decoded.items[1]?.duplicateOf).toBe('inventory:已发布词');
    expect(decoded.totals.submissions.failed).toBe(2);
    expect(decoded.nextCursor).toBe('2026-01-02T00:00:00Z|item-1');
    const base = {
      game: 'fibking',
      items: [],
      totals: { submissions: {} },
      nextCursor: null,
    };
    expect(() =>
      parseLibraryItemsResponse({
        ...base,
        items: [{ ...decoded.items[0], status: 'nope' }],
      }),
    ).toThrow('unsupported status');
    expect(() =>
      parseLibraryItemsResponse({
        ...base,
        totals: { submissions: { nope: 1 } },
      }),
    ).toThrow('unsupported status');
    expect(() => parseLibraryItemsResponse({ ...base, extra: true })).toThrow('unsupported fields');
  });
});
