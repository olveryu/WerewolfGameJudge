import { DRAWGUESS_WORD_CATEGORIES } from '@game-judge/game-engine/games/drawguess/public';
import {
  GAME_WORD_GAMES,
  wordSubmissionAgentsSchema,
  wordSubmissionAuditSchema,
  wordSubmissionBatchSchema,
  wordSubmissionSettingsSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as z from 'zod/mini';

import { API_BASE_URL } from '@/config/api';
import { adminUserRewardsSchema } from '@/features/admin/model/adminRewards';
import { parseAdminErrorResponse } from '@/features/admin/services/adminAuth';
import {
  parseAdminAIUsageResponse,
  parseAdminAnalyticsResponse,
  parseAdminCountriesResponse,
  parseAdminD1InsightsResponse,
  parseAdminD1UsageResponse,
  parseAdminRequestTrafficResponse,
  parseAdminRoomPlayersResponse,
  parseAdminRoomsResponse,
  parseAdminStatsResponse,
  parseAdminUsersResponse,
  parseGameWordsStatsResponse,
  parseLibraryItemsResponse,
} from '@/features/admin/services/adminResponseCodec';
import { maintenanceSchema } from '@/features/maintenance/maintenance';

import { ADMIN_MOCK_PASSWORD, adminMockHandlers, resetAdminMockState } from './handlers';
import { createAdminMockState, getWordStats, listLibraryItems } from './state';

const server = setupServer(...adminMockHandlers);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetAdminMockState();
});
afterAll(() => server.close());

describe('admin mock fixtures', () => {
  it('satisfy the production response decoders and shared word-supply schemas', () => {
    const state = createAdminMockState();
    const firstUser = state.users[0];
    const firstBatch = state.batches[0];

    expect(parseAdminUsersResponse({ users: state.users, nextCursor: null }).users).toHaveLength(4);
    expect(parseAdminCountriesResponse({ countries: ['CN', 'TW', 'US'] }).countries).toHaveLength(
      3,
    );
    expect(
      parseAdminRoomsResponse({
        rooms: state.rooms,
        total: state.rooms.length,
        page: 1,
        limit: 50,
      }).rooms,
    ).toHaveLength(3);
    expect(
      parseAdminRoomPlayersResponse({ players: Object.values(state.roomPlayers).flat() }).players,
    ).toHaveLength(3);
    expect(parseAdminStatsResponse(state.stats).registered).toBeGreaterThan(0);
    expect(parseAdminD1UsageResponse(state.d1Usage).rowsRead).toBeGreaterThan(0);
    expect(parseAdminD1InsightsResponse(state.d1Insights).queries).toHaveLength(3);
    expect(parseAdminAnalyticsResponse(state.analytics).countries).toHaveLength(3);
    expect(parseAdminAIUsageResponse(state.aiUsage).providers).toHaveLength(2);
    expect(parseAdminRequestTrafficResponse(state.requestTraffic).http.routes).toHaveLength(3);
    expect(maintenanceSchema.parse(state.maintenance).enabled).toBe(false);
    if (firstUser === undefined) throw new Error('Admin mock has no sample user');
    expect(adminUserRewardsSchema.parse(state.rewards[firstUser.id])).toBeDefined();
    expect(wordSubmissionAgentsSchema.parse({ agents: state.agents }).agents).toHaveLength(3);

    for (const game of GAME_WORD_GAMES) {
      expect(parseGameWordsStatsResponse(getWordStats(game)).game).toBe(game);
      expect(parseLibraryItemsResponse(listLibraryItems(state, game)).game).toBe(game);
    }

    if (firstBatch === undefined) throw new Error('Admin mock has no sample batch');
    expect(wordSubmissionBatchSchema.parse(firstBatch).items).toHaveLength(1);
    for (const batch of state.batches.slice(1)) wordSubmissionBatchSchema.parse(batch);
    expect(z.array(wordSubmissionAuditSchema).parse(state.audit)).toHaveLength(7);
  });

  it('returns strict library responses and filters by exact category in admin-mock', () => {
    const state = createAdminMockState();
    const allItems = listLibraryItems(state, 'drawguess');
    const category = allItems.items[0]?.category;
    if (category === undefined) throw new Error('Admin mock has no sample word items');

    const filtered = listLibraryItems(state, 'drawguess', undefined, undefined, category);
    expect(filtered).not.toHaveProperty('categories');
    expect(parseLibraryItemsResponse(filtered).items).toHaveLength(filtered.items.length);
    expect(filtered.items.length).toBeGreaterThan(0);
    expect(filtered.items.every((item) => item.category === category)).toBe(true);
  });

  it('retains zero-inventory categories in multi-category game fixtures', () => {
    for (const game of ['fibking', 'undercover', 'drawguess'] as const) {
      const categories = getWordStats(game).categories;
      expect(categories.some(({ active }) => active === 0)).toBe(true);
    }

    const drawGuessCategories = getWordStats('drawguess').categories;
    expect(drawGuessCategories.map(({ id }) => id)).toEqual(DRAWGUESS_WORD_CATEGORIES);
    expect(drawGuessCategories.find(({ id }) => id === 'plants')).toMatchObject({
      active: 0,
      total: 0,
    });
  });

  it('provides the single populated Decrypto category in mock stats', () => {
    const categories = getWordStats('decrypto').categories;
    expect(categories).toEqual([expect.objectContaining({ id: 'general', name: '常用词' })]);
    expect(categories[0]?.active).toBeGreaterThan(0);
  });

  it('authenticates with the local password and returns a visible error for unimplemented APIs', async () => {
    const session = await fetch(`${API_BASE_URL}/admin/session`, {
      headers: { 'X-Admin-Token': ADMIN_MOCK_PASSWORD },
    });
    expect(session.status).toBe(200);

    const settings = await fetch(`${API_BASE_URL}/admin/word-submissions/settings`, {
      headers: { 'X-Admin-Token': ADMIN_MOCK_PASSWORD },
    });
    expect(wordSubmissionSettingsSchema.parse(await settings.json()).pending).toBe(2);

    const unauthorized = await fetch(`${API_BASE_URL}/admin/users`);
    expect(unauthorized.status).toBe(401);

    const unimplemented = await fetch(`${API_BASE_URL}/admin/not-implemented`, {
      headers: { 'X-Admin-Token': ADMIN_MOCK_PASSWORD },
    });
    expect(unimplemented.status).toBe(501);
    expect(parseAdminErrorResponse(await unimplemented.json())).toContain('/admin/not-implemented');
  });

  it('keeps supported writes in the in-memory admin state', async () => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Admin-Token': ADMIN_MOCK_PASSWORD,
    };
    const updated = await fetch(`${API_BASE_URL}/admin/word-submissions/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accepting: false }),
    });
    expect(wordSubmissionSettingsSchema.parse(await updated.json()).accepting).toBe(false);

    const reread = await fetch(`${API_BASE_URL}/admin/word-submissions/settings`, {
      headers: { 'X-Admin-Token': ADMIN_MOCK_PASSWORD },
    });
    expect(wordSubmissionSettingsSchema.parse(await reread.json()).accepting).toBe(false);
  });

  it('accepts the load-timing beacon without contacting a Worker', async () => {
    const response = await fetch(`${API_BASE_URL}/telemetry/load-timing`, {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(204);
  });
});
