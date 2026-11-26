import { DECRYPTO_WORD_CATEGORY_CATALOG } from '@game-judge/game-engine/games/decrypto/public';
import type {
  WordSubmissionAgent,
  wordSubmissionAuditSchema,
  WordSubmissionBatch,
  WordSubmissionItem,
  WordSubmissionStatus,
} from '@game-judge/game-engine/product/wordSupply';
import type * as z from 'zod/mini';

import type {
  AdminAIUsage,
  AdminAnalytics,
  AdminD1Insights,
  AdminD1Usage,
  AdminRequestTraffic,
  AdminRoom,
  AdminRoomPlayer,
  AdminStats,
  AdminUser,
  GameWordGame,
  GameWordsStats,
  WordLibraryItem,
} from '@/features/admin/model/adminContracts';
import { type AdminRewardGrant, adminUserRewardsSchema } from '@/features/admin/model/adminRewards';
import type { MaintenanceConfig } from '@/features/maintenance/maintenance';

import { ADMIN_MOCK_DRAWGUESS_CATEGORIES } from './drawGuessCategories';
import { ADMIN_MOCK_FIBKING_CATEGORIES } from './fibkingCategories';
import { ADMIN_MOCK_UNDERCOVER_CATEGORIES } from './undercoverCategories';

const SYSTEM_AGENT_ID = '00000000-0000-4000-8000-000000000001';
const COMMUNITY_AGENT_ID = '00000000-0000-4000-8000-000000000002';
const MOCK_ACTIVE_COUNTS: Readonly<Record<GameWordGame, Readonly<Record<string, number>>>> = {
  fibking: { literature: 42, food: 28, animals: 19 },
  undercover: { food: 42, animals: 28, dailyLife: 19 },
  drawguess: { animals: 42, food: 28, dailyObjects: 19 },
  decrypto: { animals: 12, food: 12, dailyObjects: 8 },
};

const GAME_CATEGORIES: Readonly<
  Record<GameWordGame, readonly { readonly id: string; readonly name: string }[]>
> = {
  fibking: ADMIN_MOCK_FIBKING_CATEGORIES,
  undercover: ADMIN_MOCK_UNDERCOVER_CATEGORIES,
  drawguess: ADMIN_MOCK_DRAWGUESS_CATEGORIES,
  decrypto: DECRYPTO_WORD_CATEGORY_CATALOG.entries,
};

type SubmissionSeed = {
  id: string;
  batchId: string;
  game: GameWordGame;
  title: string;
  category: string;
  agentName: string;
  status: WordSubmissionStatus;
  content: Record<string, unknown>;
  review: WordSubmissionItem['review'];
};

const SUBMISSION_SEEDS: readonly SubmissionSeed[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    batchId: '20000000-0000-4000-8000-000000000001',
    game: 'fibking',
    title: '沆瀣一气',
    category: 'literature',
    agentName: '系统补词',
    status: 'pending',
    content: {
      coreMeaning: '比喻气味相投的人勾结在一起。',
      usageNote: '用于贬义语境，形容关系密切而不正当。',
      references: [{ url: 'https://example.test/idiom', note: '示例参考' }],
    },
    review: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    batchId: '20000000-0000-4000-8000-000000000002',
    game: 'fibking',
    title: '金陵',
    category: 'earth',
    agentName: '社区词库维护',
    status: 'approved',
    content: { coreMeaning: '南京的旧称之一。', usageNote: '历史地名。' },
    review: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    batchId: '20000000-0000-4000-8000-000000000003',
    game: 'fibking',
    title: '竹夫人',
    category: 'utensils',
    agentName: '社区词库维护',
    status: 'passed',
    content: { coreMeaning: '夏季供人抱着取凉的竹制器具。', usageNote: '传统生活器物。' },
    review: {
      passed: true,
      canOverride: false,
      reason: '词项与释义均符合审核标准。',
      checks: { isEstablishedTerm: true, isDefinitionAccurate: true, isAppropriate: true },
      details: { evidence: [{ title: '词典释义', evidenceQuote: '传统竹制寝具。' }] },
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    batchId: '20000000-0000-4000-8000-000000000004',
    game: 'undercover',
    title: '油条 / 麻花',
    category: 'food',
    agentName: '系统补词',
    status: 'pending',
    content: {
      commonTraits: '都是面食，也常作为早餐或零食。',
      differences: '一个松软，一个酥脆。',
    },
    review: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    batchId: '20000000-0000-4000-8000-000000000005',
    game: 'undercover',
    title: '海豚 / 鲸鱼',
    category: 'animals',
    agentName: '社区词库维护',
    status: 'rejected',
    content: { commonTraits: '都是生活在海洋中的哺乳动物。', differences: '体型和外形差异明显。' },
    review: {
      passed: false,
      canOverride: true,
      reason: '两个词的熟悉度差异较大。',
      checks: { isFamiliar: true, hasSimilarFamiliarity: false, isPlayableBothWays: false },
      details: { evidence: [{ query: '海豚 鲸鱼 熟悉度', evidenceQuote: '示例审核资料。' }] },
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    batchId: '20000000-0000-4000-8000-000000000006',
    game: 'drawguess',
    title: '纸风车',
    category: 'dailyObjects',
    agentName: '系统补词',
    status: 'passed',
    content: { topic: '手工玩具', difficulty: 2, potentialIssues: [] },
    review: {
      passed: true,
      canOverride: false,
      reason: '画法明确且适合游戏场景。',
      checks: { isConcreteAndDrawable: true, isSimplifiedChinese: true, isAppropriate: true },
      details: { evidence: [] },
    },
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    batchId: '20000000-0000-4000-8000-000000000007',
    game: 'drawguess',
    title: '踮脚',
    category: 'outdoorActivities',
    agentName: '社区词库维护',
    status: 'published',
    content: { topic: '身体动作', difficulty: 1, potentialIssues: [] },
    review: null,
  },
];

type WordSubmissionAudit = z.output<typeof wordSubmissionAuditSchema>;

export type AdminMockRewards = {
  normalDraws: number;
  goldenDraws: number;
  grants: AdminRewardGrant[];
};

/** Mutable, in-memory state shared by this browser tab's MSW handlers. */
export interface AdminMockState {
  maintenance: MaintenanceConfig;
  users: AdminUser[];
  rooms: AdminRoom[];
  roomPlayers: Record<string, AdminRoomPlayer[]>;
  rewards: Record<string, AdminMockRewards>;
  stats: AdminStats;
  d1Usage: AdminD1Usage;
  d1Insights: AdminD1Insights;
  analytics: AdminAnalytics;
  aiUsage: AdminAIUsage;
  requestTraffic: AdminRequestTraffic;
  agents: WordSubmissionAgent[];
  acceptingSubmissions: boolean;
  batches: WordSubmissionBatch[];
  audit: WordSubmissionAudit[];
  nextAuditId: number;
}

function timestamp(minutesAgo = 0): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function makeAgent(
  id: string,
  name: string,
  status: WordSubmissionAgent['status'],
  pending: number,
  submittedToday: number,
): WordSubmissionAgent {
  return {
    id,
    name,
    description: '用于本地管理后台界面预览的示例 Agent。',
    games: ['fibking', 'undercover', 'drawguess', 'decrypto'],
    dailyQuota: 100,
    pendingQuota: 50,
    status,
    pending,
    submittedToday,
    createdAt: timestamp(60 * 24 * 12),
    credential: {
      id: status === 'revoked' ? '30000000-0000-4000-8000-000000000003' : id,
      prefix: status === 'revoked' ? 'wj_revoked' : 'wj_local',
      expiresAt: timestamp(-60 * 24 * 60),
      revokedAt: status === 'revoked' ? timestamp(60 * 24) : null,
    },
  };
}

function makeSubmissionItem(
  seed: (typeof SUBMISSION_SEEDS)[number],
  index: number,
): WordSubmissionItem {
  const review = seed.review;
  return {
    id: seed.id,
    clientItemId: `mock-${index + 1}`,
    identity: `${seed.game}:${seed.title}`,
    contentHash: (index + 1).toString(16).padStart(64, '0'),
    title: seed.title,
    category: seed.category,
    content: seed.content,
    status: seed.status,
    duplicateOf: null,
    reviewId:
      review === null
        ? null
        : `40000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
    reviewVersion: review === null ? null : 'local-mock-v1',
    reviewModel: review === null ? null : '示例审核模型',
    review,
    failure: null,
    approvalReason: seed.status === 'approved' ? '示例人工批准，尚未发布。' : null,
    revision: 1,
  };
}

function makeLibraryItem(batch: WordSubmissionBatch, item: WordSubmissionItem): WordLibraryItem {
  const definition =
    typeof item.content.coreMeaning === 'string'
      ? item.content.coreMeaning
      : typeof item.content.commonTraits === 'string' &&
          typeof item.content.differences === 'string'
        ? `${item.content.commonTraits}；区别：${item.content.differences}`
        : null;
  return {
    id: item.id,
    batchId: batch.id,
    agentName: batch.agentName,
    game: batch.game,
    title: item.title,
    category: item.category,
    definition,
    createdAt: batch.createdAt,
    status: item.status,
    duplicateOf: item.duplicateOf,
    contentHash: item.contentHash,
    revision: item.revision,
  };
}

function makeBatches(): WordSubmissionBatch[] {
  return SUBMISSION_SEEDS.map((seed, index) => {
    const item = makeSubmissionItem(seed, index);
    return {
      id: seed.batchId,
      game: seed.game,
      agentId: seed.agentName === '系统补词' ? SYSTEM_AGENT_ID : COMMUNITY_AGENT_ID,
      agentName: seed.agentName,
      createdAt: timestamp(20 + index * 75),
      items: [item],
    };
  });
}

function makeAudit(batches: readonly WordSubmissionBatch[]): WordSubmissionAudit[] {
  return batches.map((batch, index) => ({
    id: index + 1,
    actionId: `50000000-0000-4000-8000-${(index + 1).toString().padStart(12, '0')}`,
    itemId: batch.items[0]?.id ?? null,
    action: batch.items[0]?.status === 'published' ? 'publish' : 'submit',
    actor: batch.agentName === '系统补词' ? 'review-workflow' : 'shared-admin',
    reason: '本地 UI 示例操作记录。',
    createdAt: batch.createdAt,
  }));
}

function makeUsers(): AdminUser[] {
  return [
    {
      id: 'user-local-1001',
      displayName: '林间听雨',
      email: 'lin@example.test',
      isAnonymous: false,
      lastCountry: 'CN',
      lastColo: 'HKG',
      createdAt: timestamp(60 * 24 * 45),
      updatedAt: timestamp(12),
      level: 18,
      xp: 1260,
      gamesPlayed: 84,
    },
    {
      id: 'user-local-1002',
      displayName: '纸飞机',
      email: null,
      isAnonymous: true,
      lastCountry: 'TW',
      lastColo: 'TPE',
      createdAt: timestamp(60 * 24 * 20),
      updatedAt: timestamp(95),
      level: 7,
      xp: 390,
      gamesPlayed: 21,
    },
    {
      id: 'user-local-1003',
      displayName: '周末玩家',
      email: 'weekend@example.test',
      isAnonymous: false,
      lastCountry: 'US',
      lastColo: 'SJC',
      createdAt: timestamp(60 * 24 * 8),
      updatedAt: timestamp(60 * 24 * 3),
      level: 11,
      xp: 720,
      gamesPlayed: 46,
    },
    {
      id: 'user-local-1004',
      displayName: null,
      email: null,
      isAnonymous: true,
      lastCountry: null,
      lastColo: null,
      createdAt: timestamp(60 * 24 * 2),
      updatedAt: timestamp(60 * 24 * 2),
      level: 1,
      xp: 0,
      gamesPlayed: 0,
    },
  ];
}

function makeRooms(): AdminRoom[] {
  return [
    {
      id: 'room-local-1001',
      code: '1001',
      gameType: 'werewolf',
      status: 'active',
      reconciliationAttemptCount: 0,
      reconcileAfter: null,
      lastError: null,
      hostUserId: 'user-local-1001',
      hostName: '林间听雨',
      hostCountry: 'CN',
      gamesStarted: 5,
      lastStartedAt: timestamp(35),
      participantCount: 7,
      createdAt: timestamp(95),
    },
    {
      id: 'room-local-1002',
      code: '1002',
      gameType: 'fibking',
      status: 'creating',
      reconciliationAttemptCount: 1,
      reconcileAfter: timestamp(-5),
      lastError: null,
      hostUserId: 'user-local-1002',
      hostName: '纸飞机',
      hostCountry: 'TW',
      gamesStarted: 0,
      lastStartedAt: null,
      participantCount: 3,
      createdAt: timestamp(12),
    },
    {
      id: 'room-local-1003',
      code: '1003',
      gameType: 'undercover',
      status: 'failed',
      reconciliationAttemptCount: 3,
      reconcileAfter: timestamp(30),
      lastError: 'Durable Object 初始化暂时失败（本地示例）',
      hostUserId: 'user-local-1003',
      hostName: '周末玩家',
      hostCountry: 'US',
      gamesStarted: 0,
      lastStartedAt: null,
      participantCount: 1,
      createdAt: timestamp(55),
    },
  ];
}

function makeRoomPlayers(): Record<string, AdminRoomPlayer[]> {
  return {
    '1001': [
      {
        userId: 'user-local-1001',
        displayName: '林间听雨',
        lastCountry: 'CN',
        lastColo: 'HKG',
        createdAt: timestamp(60 * 24 * 45),
        joinedAt: timestamp(90),
        level: 18,
        xp: 1260,
        gamesPlayed: 84,
      },
      {
        userId: 'user-local-1002',
        displayName: '纸飞机',
        lastCountry: 'TW',
        lastColo: 'TPE',
        createdAt: timestamp(60 * 24 * 20),
        joinedAt: timestamp(75),
        level: 7,
        xp: 390,
        gamesPlayed: 21,
      },
      {
        userId: 'user-local-1004',
        displayName: null,
        lastCountry: null,
        lastColo: null,
        createdAt: timestamp(60 * 24 * 2),
        joinedAt: timestamp(68),
        level: 1,
        xp: 0,
        gamesPlayed: 0,
      },
    ],
  };
}

function makeWordStats(game: GameWordGame): GameWordsStats {
  return {
    game,
    categories: GAME_CATEGORIES[game].map((category, index) => {
      const active = MOCK_ACTIVE_COUNTS[game][category.id] ?? 0;
      const hasInventory = active > 0;
      return {
        ...category,
        active,
        total: hasInventory ? active + 6 : 0,
        pending: hasInventory ? ([3, 1, 0][index % 3] ?? 0) : 0,
        batches: hasInventory ? ([6, 4, 3][index % 3] ?? 1) : 0,
        yieldCount: hasInventory ? ([18, 12, 8][index % 3] ?? 4) : 0,
        lastAttempt: hasInventory ? timestamp(60 * (index + 2)) : null,
        coolingDown: hasInventory && index === 1,
        menuEligible: game === 'undercover' ? active >= 30 : null,
      };
    }),
    modelBudget: {
      dailyUsed: 7,
      monthlyUsed: 82,
      byOperation: {
        generation: { dailyUsed: 4, monthlyUsed: 49 },
        review: { dailyUsed: 3, monthlyUsed: 33 },
      },
    },
    tavilyRequestsUsed: 23,
    tavilyMonthlyQuota: 1000,
    reviewDecisions: [
      { decision: 'accepted', count: 36 },
      { decision: 'rejected', count: 9 },
    ],
    reviewCheckStats: [{ check: 'hasSimilarFamiliarity', failCount: 4 }],
    queryLeaderboard: [
      { label: '生活常识', detail: '第一轮', publishedWords: 14, packs: 5 },
      { label: '传统文化', detail: null, publishedWords: 9, packs: 4 },
    ],
    supplyEnabled: true,
  };
}

/** Create realistic but disposable fixtures; no records are written to D1 or a Worker. */
export function createAdminMockState(): AdminMockState {
  const users = makeUsers();
  const rooms = makeRooms();
  const batches = makeBatches();
  const now = new Date();
  const rewards = adminUserRewardsSchema.parse({
    normalDraws: 18,
    goldenDraws: 2,
    grants: [],
  });

  return {
    maintenance: {
      enabled: false,
      message: '本地模拟维护公告：用于预览维护页面，不会影响真实服务。',
      endsAt: null,
    },
    users,
    rooms,
    roomPlayers: makeRoomPlayers(),
    rewards: Object.fromEntries(
      users.map((user, index) => [
        user.id,
        {
          normalDraws: [18, 7, 12, 0][index] ?? 0,
          goldenDraws: [2, 0, 1, 0][index] ?? 0,
          grants: [...rewards.grants],
        },
      ]),
    ),
    stats: {
      registered: 1284,
      active: 167,
      totalGames: 9326,
      countries: [
        { country: 'CN', count: 842 },
        { country: 'TW', count: 181 },
        { country: 'US', count: 104 },
      ],
      colos: [
        { colo: 'HKG', count: 412 },
        { colo: 'TPE', count: 181 },
        { colo: 'SJC', count: 104 },
      ],
    },
    d1Usage: {
      day: now.toISOString().slice(0, 10),
      rowsRead: 284_000,
      rowsWritten: 16_400,
      rowsReadLimit: 5_000_000,
      rowsWrittenLimit: 100_000,
      generatedAt: now.toISOString(),
    },
    d1Insights: {
      from: timestamp(60 * 24),
      to: now.toISOString(),
      generatedAt: now.toISOString(),
      queries: [
        { id: 'room-list', label: '房间列表查询', reads: 48200, writes: 0, count: 3820 },
        { id: 'user-profile', label: '用户资料读取', reads: 31700, writes: 0, count: 2900 },
        { id: 'reward-grant', label: '奖励发放', reads: 240, writes: 480, count: 80 },
      ],
      series: Array.from({ length: 12 }, (_, index) => ({
        timestamp: timestamp((11 - index) * 120),
        reads: 1200 + index * 140,
        writes: 180 + index * 18,
      })),
    },
    analytics: {
      avgLoadMs: 1320,
      avgTtfbMs: 186,
      totalRequests: 12640,
      countries: [
        { country: 'CN', count: 7280, avgLoadMs: 1480 },
        { country: 'TW', count: 2350, avgLoadMs: 960 },
        { country: 'US', count: 1820, avgLoadMs: 740 },
      ],
      colos: [
        { colo: 'HKG', count: 4120 },
        { colo: 'TPE', count: 2350 },
        { colo: 'SJC', count: 1820 },
      ],
      isps: [
        { isp: 'China Telecom', count: 3410 },
        { isp: 'Chunghwa Telecom', count: 1760 },
        { isp: 'Comcast', count: 920 },
      ],
    },
    aiUsage: {
      totalRequests: 426,
      avgTtfrMs: 920,
      errorRate: 0.018,
      providers: [
        { label: 'Google Gemini', count: 258 },
        { label: 'OpenAI', count: 168 },
      ],
      models: [
        { label: 'gemini-2.5-flash', count: 258 },
        { label: 'gpt-4.1-mini', count: 168 },
      ],
      countries: [
        { label: 'CN', count: 220 },
        { label: 'TW', count: 116 },
        { label: 'US', count: 90 },
      ],
      statuses: [
        { label: 'success', count: 418 },
        { label: 'error', count: 8 },
      ],
      topUsers: [
        { userId: users[0]?.id ?? 'user-local-1001', displayName: '林间听雨', count: 38 },
        { userId: users[2]?.id ?? 'user-local-1003', displayName: '周末玩家', count: 21 },
      ],
    },
    requestTraffic: {
      generatedAt: now.toISOString(),
      platform: { requests: 48200, errors: 116, subrequests: 2300 },
      requestCountDelta: 420,
      http: {
        totalRequests: 47780,
        clientErrorRequests: 86,
        serverErrorRequests: 30,
        successfulWebSocketConnections: 3120,
        failedWebSocketConnections: 14,
        routes: [
          {
            method: 'POST',
            route: '/room/command',
            count: 14720,
            errorCount: 34,
            avgDurationMs: 46,
            sharePercent: 30.8,
            statusCounts: [
              { status: 200, count: 14686 },
              { status: 409, count: 34 },
            ],
          },
          {
            method: 'GET',
            route: '/room/snapshot',
            count: 10340,
            errorCount: 8,
            avgDurationMs: 29,
            sharePercent: 21.6,
            statusCounts: [
              { status: 200, count: 10332 },
              { status: 404, count: 8 },
            ],
          },
          {
            method: 'POST',
            route: '/auth/refresh',
            count: 4820,
            errorCount: 11,
            avgDurationMs: 84,
            sharePercent: 10.1,
            statusCounts: [
              { status: 200, count: 4809 },
              { status: 401, count: 11 },
            ],
          },
        ],
        series: Array.from({ length: 24 }, (_, index) => ({
          timestamp: timestamp((23 - index) * 60),
          count: 240 + ((index * 47) % 180),
        })),
      },
      realtime: {
        stateSyncRequests: 8420,
        commandRequests: 14720,
        stateUpdateBroadcasts: 2630,
        stateUpdateDeliveries: 12480,
        stateUpdateBytes: 2_480_000,
        downlinkDeliveries: 1860,
        downlinkBytes: 312_000,
        invalidClientMessages: 6,
      },
    },
    agents: [
      makeAgent(COMMUNITY_AGENT_ID, '社区词库维护', 'active', 2, 12),
      makeAgent('00000000-0000-4000-8000-000000000004', '暂停中的示例 Agent', 'paused', 0, 4),
      makeAgent('00000000-0000-4000-8000-000000000005', '已撤销的示例 Agent', 'revoked', 0, 1),
    ],
    acceptingSubmissions: true,
    batches,
    audit: makeAudit(batches),
    nextAuditId: batches.length + 1,
  };
}

/** Project a submission batch into the compact rows expected by the library stream. */
export function listLibraryItems(
  state: AdminMockState,
  game: GameWordGame,
  status?: WordSubmissionStatus,
  search?: string,
  category?: string,
): {
  game: GameWordGame;
  items: WordLibraryItem[];
  totals: { submissions: Partial<Record<WordSubmissionStatus, number>> };
  nextCursor: null;
} {
  const batches = state.batches.filter((batch) => batch.game === game);
  const allItems = batches.flatMap((batch) =>
    batch.items.map((item) => makeLibraryItem(batch, item)),
  );
  const submissions: Partial<Record<WordSubmissionStatus, number>> = {};
  for (const item of allItems) {
    submissions[item.status] = (submissions[item.status] ?? 0) + 1;
  }
  const normalizedSearch = search?.toLocaleLowerCase();
  const items = allItems.filter(
    (item) =>
      (status === undefined || item.status === status) &&
      (category === undefined || item.category === category) &&
      (normalizedSearch === undefined || item.title.toLocaleLowerCase().includes(normalizedSearch)),
  );
  return { game, items, totals: { submissions }, nextCursor: null };
}

/** Recompute the game-specific inventory summary after a submission action. */
export function getWordStats(game: GameWordGame): GameWordsStats {
  return makeWordStats(game);
}

/** Return the full record for the selected user, with an explicit not-found result for unknown ids. */
export function findUserRewards(
  state: AdminMockState,
  userId: string,
): AdminMockRewards | undefined {
  return state.rewards[userId];
}
