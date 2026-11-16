import { GAME_WORD_GAMES, isGameWordGame } from '@game-judge/game-engine/product/wordSupply';
import {
  type WordSubmissionAction,
  wordSubmissionActionSchema,
  type WordSubmissionAgent,
  wordSubmissionAgentInputSchema,
  wordSubmissionAgentUpdateSchema,
  wordSubmissionAuditSchema,
  wordSubmissionIssuedCredentialSchema,
  type WordSubmissionItem,
  wordSubmissionSettingsSchema,
  wordSubmissionStatusSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { http, HttpResponse } from 'msw';
import * as z from 'zod/mini';

import { API_BASE_URL } from '@/config/api';
import {
  type AdminRewardGrant,
  adminRewardInputSchema,
  adminUserRewardsSchema,
} from '@/features/admin/model/adminRewards';
import { maintenanceSchema } from '@/features/maintenance/maintenance';

import {
  type AdminMockRewards,
  createAdminMockState,
  findUserRewards,
  getWordStats,
  listLibraryItems,
} from './state';

export const ADMIN_MOCK_PASSWORD = 'local-admin';

let state = createAdminMockState();

/** Reset the in-memory fixture state between handler contract tests. */
export function resetAdminMockState(): void {
  state = createAdminMockState();
}

function adminError(reason: string, status = 400): Response {
  return HttpResponse.json({ success: false, reason }, { status });
}

function isAuthorized(request: Request): boolean {
  return request.headers.get('X-Admin-Token') === ADMIN_MOCK_PASSWORD;
}

function unauthorized(): Response {
  return adminError('本地模拟管理员凭据无效', 401);
}

function authorizedResponse(request: Request): Response | null {
  return isAuthorized(request) ? null : unauthorized();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function response(request: Request, body: unknown): Response {
  const failure = authorizedResponse(request);
  return failure ?? jsonResponse(body);
}

function getWordSubmissionSettings() {
  const counts: Partial<Record<WordSubmissionItem['status'], number>> = {};
  for (const item of state.batches.flatMap((batch) => batch.items)) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  const settings = {
    accepting: state.acceptingSubmissions,
    pending: counts.pending ?? 0,
    pendingLimit: 5000,
    awaitingReview: (counts.approved ?? 0) + (counts.reviewing ?? 0),
    awaitingPublication: counts.passed ?? 0,
    failed: counts.failed ?? 0,
    published: counts.published ?? 0,
    submittedToday: 17,
    dailyLimit: 1000,
    modelBudget: {
      dailyUsed: 7,
      monthlyUsed: 82,
      byOperation: {
        generation: { dailyUsed: 4, monthlyUsed: 49 },
        review: { dailyUsed: 3, monthlyUsed: 33 },
      },
    },
  };
  return wordSubmissionSettingsSchema.parse(settings);
}

function agentById(id: string) {
  return state.agents.find((agent) => agent.id === id);
}

function pathSegment(request: Request, index: number): string | undefined {
  return new URL(request.url).pathname.split('/').filter(Boolean)[index];
}

function issueCredential(input: ReturnType<typeof wordSubmissionAgentInputSchema.parse>): Response {
  const id = crypto.randomUUID();
  const token = `wj_local_${crypto.randomUUID().replaceAll('-', '')}`;
  const agent = {
    ...input,
    id,
    status: 'active' as const,
    pending: 0,
    submittedToday: 0,
    createdAt: new Date().toISOString(),
    credential: {
      id: crypto.randomUUID(),
      prefix: token.slice(0, 12),
      expiresAt: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
      revokedAt: null,
    },
  };
  const issued = wordSubmissionIssuedCredentialSchema.parse({ agent, token });
  state.agents = [issued.agent, ...state.agents];
  return HttpResponse.json(issued);
}

function transitionBatch(batchId: string, action: WordSubmissionAction): boolean {
  const batch = state.batches.find((entry) => entry.id === batchId);
  if (batch === undefined) return false;

  const selectedItems = new Map(action.items.map((item) => [item.id, item]));
  const matchedIds = new Set<string>();
  const auditEvents: WordSubmissionAudit[] = [];
  const items = batch.items.map((item) => {
    const selected = selectedItems.get(item.id);
    if (selected === undefined) return item;
    if (selected.contentHash !== item.contentHash || selected.revision !== item.revision) {
      throw new Error('本地模拟投稿内容已变化，请刷新后重试');
    }

    matchedIds.add(item.id);
    const nextStatus: typeof item.status = (() => {
      switch (action.action) {
        case 'review':
          return 'reviewing';
        case 'publish':
          return 'published';
        case 'dismiss':
          return 'dismissed';
        case 'approve':
        case 'endorse':
          return 'approved';
        case 'unendorse':
          return 'pending';
        case 'unpublish':
          return 'unpublished';
      }
    })();
    auditEvents.push({
      id: state.nextAuditId + auditEvents.length,
      actionId: action.id,
      itemId: item.id,
      action: action.action,
      actor: 'shared-admin',
      reason: action.reason,
      createdAt: new Date().toISOString(),
    });
    return {
      ...item,
      status: nextStatus,
      ...(action.action === 'review' && {
        reviewId: action.id,
        reviewVersion: 'local-demo-v1',
        reviewModel: '示例审核模型',
        review: null,
      }),
      ...(action.action === 'approve' && { approvalReason: action.reason }),
    };
  });
  if (matchedIds.size !== selectedItems.size) {
    throw new Error('本地模拟投稿批次不包含请求中的全部词条');
  }

  state.batches = state.batches.map((entry) =>
    entry.id === batchId ? { ...batch, items } : entry,
  );
  state.audit = [...auditEvents.reverse(), ...state.audit];
  state.nextAuditId += auditEvents.length;
  return true;
}

async function wordSubmissionActionResponse(request: Request, batchId: string): Promise<Response> {
  const failure = authorizedResponse(request);
  if (failure !== null) return failure;
  const action = wordSubmissionActionSchema.parse(await request.json());
  if (!transitionBatch(batchId, action)) return adminError('未找到本地模拟投稿批次', 404);
  return HttpResponse.json({
    id: action.id,
    status: action.action === 'review' ? 'queued' : 'complete',
  });
}

function rewardResponse(rewards: AdminMockRewards): Response {
  return HttpResponse.json(adminUserRewardsSchema.parse(rewards));
}

const apiOrigin = new URL(API_BASE_URL).origin;
const allGameQuery = z.strictObject({ game: z.string() });
const agentStatusBody = z.strictObject({
  status: z.enum(['active', 'paused', 'revoked']),
});
const rotateBody = z.strictObject({
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]),
});
type WordSubmissionAudit = z.output<typeof wordSubmissionAuditSchema>;

export const adminMockHandlers = [
  http.get(`${apiOrigin}/admin/tavily-usage`, ({ request }) =>
    response(request, { planUsage: 750, planLimit: 1000, paygoUsage: 0, paygoLimit: 0 }),
  ),
  http.get(`${apiOrigin}/maintenance`, () => HttpResponse.json(state.maintenance)),
  http.post(`${apiOrigin}/telemetry/load-timing`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${apiOrigin}/admin/session`, ({ request }) =>
    isAuthorized(request)
      ? HttpResponse.json({ success: true })
      : adminError('本地模拟管理员凭据无效', 401),
  ),
  http.get(`${apiOrigin}/admin/maintenance`, ({ request }) => response(request, state.maintenance)),
  http.post(`${apiOrigin}/admin/maintenance`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    state.maintenance = maintenanceSchema.parse(await request.json());
    return HttpResponse.json(state.maintenance);
  }),
  http.get(`${apiOrigin}/admin/users/countries`, ({ request }) =>
    response(request, { countries: ['CN', 'TW', 'US'] }),
  ),
  http.get(`${apiOrigin}/admin/users`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const query = new URL(request.url).searchParams;
    const country = query.get('country');
    const type = query.get('type');
    const search = query.get('q')?.toLocaleLowerCase();
    const users = state.users.filter(
      (user) =>
        (country === null || user.lastCountry === country) &&
        (type === null ||
          (type === 'anonymous' && user.isAnonymous) ||
          (type === 'registered' && !user.isAnonymous)) &&
        (search === undefined ||
          user.id.toLocaleLowerCase().includes(search) ||
          user.displayName?.toLocaleLowerCase().includes(search) ||
          user.email?.toLocaleLowerCase().includes(search)),
    );
    return HttpResponse.json({ users, nextCursor: null });
  }),
  http.get(`${apiOrigin}/admin/rooms`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const query = new URL(request.url).searchParams;
    const page = Math.max(1, Number(query.get('page') ?? 1));
    const limit = Math.max(1, Number(query.get('limit') ?? 50));
    const offset = (page - 1) * limit;
    return HttpResponse.json({
      rooms: state.rooms.slice(offset, offset + limit),
      total: state.rooms.length,
      page,
      limit,
    });
  }),
  http.get(`${apiOrigin}/admin/rooms/:code/players`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const code = pathSegment(request, 2);
    if (code === undefined) return adminError('本地模拟房间路径无效', 404);
    const players = state.roomPlayers[code];
    return players === undefined
      ? adminError('未找到本地模拟房间', 404)
      : HttpResponse.json({ players });
  }),
  http.get(`${apiOrigin}/admin/users/:userId/rewards`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const userId = pathSegment(request, 2);
    if (userId === undefined) return adminError('本地模拟用户路径无效', 404);
    const rewards = findUserRewards(state, userId);
    return rewards === undefined ? adminError('未找到本地模拟用户', 404) : rewardResponse(rewards);
  }),
  http.post(`${apiOrigin}/admin/users/:userId/rewards`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const userId = pathSegment(request, 2);
    if (userId === undefined) return adminError('本地模拟用户路径无效', 404);
    const input = adminRewardInputSchema.parse(await request.json());
    const current = findUserRewards(state, userId);
    if (current === undefined) return adminError('未找到本地模拟用户', 404);
    const previous = current.grants.find((grant) => grant.id === input.id);
    if (previous !== undefined) return HttpResponse.json(previous);
    const balanceBefore = input.drawType === 'normal' ? current.normalDraws : current.goldenDraws;
    const grant: AdminRewardGrant = {
      ...input,
      userId,
      balanceBefore,
      balanceAfter: balanceBefore + input.count,
      createdAt: new Date().toISOString(),
    };
    state.rewards[userId] = {
      ...current,
      ...(input.drawType === 'normal'
        ? { normalDraws: grant.balanceAfter }
        : { goldenDraws: grant.balanceAfter }),
      grants: [grant, ...current.grants],
    };
    return HttpResponse.json(grant);
  }),
  http.get(`${apiOrigin}/admin/stats`, ({ request }) => response(request, state.stats)),
  http.get(`${apiOrigin}/admin/d1-usage`, ({ request }) => response(request, state.d1Usage)),
  http.get(`${apiOrigin}/admin/d1-insights`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const query = new URL(request.url).searchParams;
    return HttpResponse.json({
      ...state.d1Insights,
      from:
        query.get('range') === 'today'
          ? new Date().toISOString().slice(0, 10)
          : state.d1Insights.from,
      to: new Date().toISOString(),
    });
  }),
  http.get(`${apiOrigin}/admin/analytics`, ({ request }) => response(request, state.analytics)),
  http.get(`${apiOrigin}/admin/ai-usage`, ({ request }) => response(request, state.aiUsage)),
  http.get(`${apiOrigin}/admin/request-traffic`, ({ request }) =>
    response(request, state.requestTraffic),
  ),
  http.get(`${apiOrigin}/admin/games/words/stats`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const parsedQuery = allGameQuery.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsedQuery.success || !isGameWordGame(parsedQuery.data.game)) {
      return adminError(`game 必须是以下之一：${GAME_WORD_GAMES.join(', ')}`);
    }
    return HttpResponse.json(getWordStats(parsedQuery.data.game));
  }),
  http.post(`${apiOrigin}/admin/games/words/trigger-supply`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const body = allGameQuery.parse(await request.json());
    if (!isGameWordGame(body.game)) return adminError('不支持的本地模拟游戏');
    return HttpResponse.json({ game: body.game, workflowId: `local-${crypto.randomUUID()}` });
  }),
  http.get(`${apiOrigin}/admin/words/:game/library-items`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const game = pathSegment(request, 2);
    if (game === undefined || !isGameWordGame(game)) return adminError('不支持的本地模拟游戏');
    const query = new URL(request.url).searchParams;
    const statusValue = query.get('status') ?? undefined;
    const status =
      statusValue === undefined ? undefined : wordSubmissionStatusSchema.safeParse(statusValue);
    if (status !== undefined && !status.success) return adminError('不支持的投稿状态');
    return HttpResponse.json(
      listLibraryItems(
        state,
        game,
        status?.data,
        query.get('search') ?? undefined,
        query.get('category') ?? undefined,
      ),
    );
  }),
  http.get(`${apiOrigin}/admin/word-submissions/settings`, ({ request }) =>
    response(request, getWordSubmissionSettings()),
  ),
  http.post(`${apiOrigin}/admin/word-submissions/settings`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const body = z.strictObject({ accepting: z.boolean() }).parse(await request.json());
    state.acceptingSubmissions = body.accepting;
    return HttpResponse.json(getWordSubmissionSettings());
  }),
  http.get(`${apiOrigin}/admin/word-submissions/agents`, ({ request }) =>
    response(request, { agents: state.agents }),
  ),
  http.post(`${apiOrigin}/admin/word-submissions/agents`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const input = wordSubmissionAgentInputSchema.parse(await request.json());
    return issueCredential(input);
  }),
  http.patch(`${apiOrigin}/admin/word-submissions/agents/:id`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟 Agent 路径无效', 404);
    const current = agentById(id);
    if (current === undefined) return adminError('未找到本地模拟 Agent', 404);
    const input = wordSubmissionAgentUpdateSchema.parse(await request.json());
    const updated: WordSubmissionAgent = {
      ...current,
      name: input.name,
      description: input.description,
      games: input.games,
      dailyQuota: input.dailyQuota,
      pendingQuota: input.pendingQuota,
    };
    state.agents = state.agents.map((agent) => (agent.id === id ? updated : agent));
    return HttpResponse.json(updated);
  }),
  http.delete(`${apiOrigin}/admin/word-submissions/agents/:id`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined || agentById(id) === undefined) {
      return adminError('未找到本地模拟 Agent', 404);
    }
    state.agents = state.agents.filter((agent) => agent.id !== id);
    return HttpResponse.json({ success: true });
  }),
  http.post(`${apiOrigin}/admin/word-submissions/agents/:id/rotate`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟 Agent 路径无效', 404);
    const current = agentById(id);
    if (current === undefined) return adminError('未找到本地模拟 Agent', 404);
    const body = rotateBody.parse(await request.json());
    const token = `wj_local_${crypto.randomUUID().replaceAll('-', '')}`;
    const agent: WordSubmissionAgent = {
      ...current,
      credential: {
        id: crypto.randomUUID(),
        prefix: token.slice(0, 12),
        expiresAt: new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString(),
        revokedAt: null,
      },
    };
    state.agents = state.agents.map((entry) => (entry.id === id ? agent : entry));
    return HttpResponse.json({ agent, token });
  }),
  http.post(`${apiOrigin}/admin/word-submissions/agents/:id/status`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟 Agent 路径无效', 404);
    const current = agentById(id);
    if (current === undefined) return adminError('未找到本地模拟 Agent', 404);
    const body = agentStatusBody.parse(await request.json());
    const updated = {
      ...current,
      status: body.status,
      credential:
        body.status === 'revoked' && current.credential !== null
          ? { ...current.credential, revokedAt: new Date().toISOString() }
          : current.credential,
    };
    state.agents = state.agents.map((agent) => (agent.id === id ? updated : agent));
    return HttpResponse.json(updated);
  }),
  http.get(`${apiOrigin}/admin/word-submissions/batches/:id`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟投稿批次路径无效', 404);
    const batch = state.batches.find((entry) => entry.id === id);
    return batch === undefined
      ? adminError('未找到本地模拟投稿批次', 404)
      : HttpResponse.json(batch);
  }),
  http.get(`${apiOrigin}/admin/word-submissions/batches/:id/audit`, ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟投稿批次路径无效', 404);
    const batch = state.batches.find((entry) => entry.id === id);
    if (batch === undefined) return adminError('未找到本地模拟投稿批次', 404);
    const itemIds = new Set(batch.items.map((item) => item.id));
    return HttpResponse.json({
      events: z
        .array(wordSubmissionAuditSchema)
        .parse(state.audit.filter((event) => event.itemId !== null && itemIds.has(event.itemId))),
      statuses: ['pending', 'approved', 'reviewing', 'passed', 'published', 'rejected'],
    });
  }),
  http.post(`${apiOrigin}/admin/word-submissions/batches/:id/actions`, async ({ request }) => {
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟投稿批次路径无效', 404);
    return wordSubmissionActionResponse(request, id);
  }),
  http.post(`${apiOrigin}/admin/word-submissions/batches/:id/dispatch`, async ({ request }) => {
    const failure = authorizedResponse(request);
    if (failure !== null) return failure;
    const id = pathSegment(request, 3);
    if (id === undefined) return adminError('本地模拟投稿批次路径无效', 404);
    const body = z.strictObject({ actionId: z.uuid() }).parse(await request.json());
    const batch = state.batches.find((entry) => entry.id === id);
    return batch === undefined
      ? adminError('未找到本地模拟投稿批次', 404)
      : HttpResponse.json({ success: body.actionId.length > 0 });
  }),
  http.all(`${apiOrigin}/*`, ({ request }) => {
    const url = new URL(request.url);
    return adminError(`本地管理后台模拟未实现此 API：${request.method} ${url.pathname}`, 501);
  }),
];
