import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminErrorResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
} from '@/features/admin/services/adminResponseCodec';

describe('adminResponseCodec', () => {
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
        total: 1,
        page: 1,
        limit: 50,
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
  ])('fails fast for malformed payloads', (decode) => {
    expect(decode).toThrow();
  });
});
