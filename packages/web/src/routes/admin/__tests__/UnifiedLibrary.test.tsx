import type {
  GameWordsStats,
  WordLibraryItem,
  WordLibraryItems,
  WordSubmissionBatch,
  wordSubmissionListSchema,
} from '@game-judge/game-engine/product/wordSupply';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { z } from 'zod';

import {
  approveWordCandidates,
  dismissWordCandidates,
  fetchGameWordsStats,
  fetchLibraryItems,
} from '@/features/admin/services/adminApi';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { showPrompt } from '@/utils/alert';

import { UnifiedLibrary } from '../words/UnifiedLibrary';

vi.mock('@/features/admin/services/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminApi')>()),
  fetchGameWordsStats: vi.fn(),
  fetchLibraryItems: vi.fn(),
  approveWordCandidates: vi.fn(),
  dismissWordCandidates: vi.fn(),
}));
vi.mock('@/features/admin/services/wordSubmissionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/wordSubmissionsApi')>()),
  wordSubmissionsApi: {
    batches: vi.fn(),
    batch: vi.fn(),
    action: vi.fn(),
  },
}));
vi.mock('@/utils/alert', () => ({
  CANCEL_BUTTON: { text: '取消', style: 'cancel' },
  showAlert: vi.fn(),
  showPrompt: vi.fn((_title: string, options: { onConfirm: (value: string) => void }) => {
    options.onConfirm('词太常见，不用审了。');
  }),
}));

const stats: GameWordsStats = {
  game: 'drawguess',
  supplyEnabled: true,
  monthlySupply: { month: '2026-11', published: 10, reserved: 0, batchLimit: 20, wordTarget: 100 },
  reviewDecisions: [
    { decision: 'accepted', count: 4 },
    { decision: 'rejected', count: 6 },
  ],
  reviewCheckStats: [],
  queryLeaderboard: [],
  tavilyRequestsUsed: null,
  tavilyMonthlyQuota: null,
  modelBudget: {
    dailyUsed: 0,
    dailyLimit: 8,
    monthlyUsed: 0,
    monthlyLimit: 120,
    byOperation: {
      generation: { dailyUsed: 0, monthlyUsed: 0 },
      review: { dailyUsed: 0, monthlyUsed: 0 },
    },
  },
  categories: [
    {
      id: 'animals',
      name: '动物',
      active: 12,
      total: 14,
      pending: 1,
      batches: 2,
      yieldCount: 10,
      lastAttempt: null,
      coolingDown: false,
      menuEligible: null,
    },
    {
      id: 'food',
      name: '饮食',
      active: 3,
      total: 5,
      pending: 2,
      batches: 1,
      yieldCount: 4,
      lastAttempt: null,
      coolingDown: false,
      menuEligible: null,
    },
  ],
};
const candidateItem: WordLibraryItem = {
  key: 'candidate:cand-1',
  source: 'candidate',
  id: 'cand-1',
  batchId: null,
  agentName: null,
  game: 'drawguess',
  title: '大熊猫',
  category: '动物',
  definition: '大熊猫是一种熊。',
  evidenceCount: 2,
  createdAt: '2026-11-14T00:00:00.000Z',
  status: 'pending',
  duplicateOf: null,
  contentHash: null,
  revision: null,
};
const submissionItem: WordLibraryItem = {
  key: 'submission:item-1',
  source: 'submission',
  id: 'item-1',
  batchId: 'batch-1',
  agentName: 'Muse',
  game: 'drawguess',
  title: '玫瑰花',
  category: '饮食',
  definition: '花。',
  evidenceCount: 1,
  createdAt: '2026-11-13T00:00:00.000Z',
  status: 'pending',
  duplicateOf: 'inventory:玫瑰花',
  contentHash: 'a'.repeat(64),
  revision: 1,
};
const approvedItem: WordLibraryItem = {
  ...submissionItem,
  key: 'submission:item-2',
  id: 'item-2',
  title: '月季',
  status: 'approved',
  duplicateOf: null,
  contentHash: 'b'.repeat(64),
  revision: 2,
};
const libraryData: WordLibraryItems = {
  game: 'drawguess',
  items: [candidateItem, submissionItem, approvedItem],
  totals: {
    candidates: { pending: 1 },
    submissions: { pending: 1, approved: 1, published: 2, failed: 1 },
  },
  nextCursor: null,
};
type BatchListEntry = z.output<typeof wordSubmissionListSchema>['batches'][number];
function batch(overrides: Partial<BatchListEntry> & { id: string }): BatchListEntry {
  return {
    game: 'drawguess',
    agentId: '20000000-0000-4000-8000-000000000001',
    agentName: 'Muse',
    createdAt: '2026-11-13T00:00:00.000Z',
    counts: { pending: 1 },
    inventoryExists: false,
    ...overrides,
  };
}
const batchDetail: WordSubmissionBatch = {
  id: '10000000-0000-4000-8000-000000000001',
  game: 'drawguess',
  agentId: '20000000-0000-4000-8000-000000000001',
  agentName: 'Muse',
  createdAt: '2026-11-13T00:00:00.000Z',
  items: [
    {
      id: '30000000-0000-4000-8000-000000000001',
      clientItemId: 'item-1',
      identity: '玫瑰花',
      contentHash: 'a'.repeat(64),
      title: '玫瑰花',
      category: '饮食',
      content: { word: '玫瑰花' },
      status: 'pending',
      duplicateOf: null,
      reviewId: null,
      reviewVersion: null,
      reviewModel: null,
      review: null,
      failure: null,
      approvalReason: null,
      revision: 1,
    },
  ],
};

function mount(game: 'drawguess' | 'fibking' = 'drawguess', extraSearch = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/admin/words/drawguess', element: <UnifiedLibrary game="drawguess" /> },
      { path: '/admin/words/fibking', element: <UnifiedLibrary game="fibking" /> },
    ],
    { initialEntries: [`/admin/words/${game}${extraSearch}`] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router, user: userEvent.setup() };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchGameWordsStats).mockImplementation(async (game) =>
    game === 'fibking'
      ? { ...stats, game: 'fibking', tavilyRequestsUsed: 736, tavilyMonthlyQuota: 1000 }
      : stats,
  );
  vi.mocked(fetchLibraryItems).mockResolvedValue(libraryData);
  vi.mocked(approveWordCandidates).mockResolvedValue({
    game: 'drawguess',
    approvedIds: ['cand-1'],
    skippedIds: [],
  });
  vi.mocked(dismissWordCandidates).mockResolvedValue({
    game: 'drawguess',
    dismissedIds: ['cand-1'],
    skippedIds: [],
  });
  vi.mocked(wordSubmissionsApi.batches).mockResolvedValue({
    batches: [
      batch({ id: '10000000-0000-4000-8000-000000000001', inventoryExists: true }),
      batch({ id: '10000000-0000-4000-8000-000000000002', counts: { passed: 1 } }),
    ],
    totals: { pending: 2, approved: 1, reviewing: 4, passed: 5 },
    nextCursor: null,
  });
  vi.mocked(wordSubmissionsApi.batch).mockResolvedValue(batchDetail);
  vi.mocked(wordSubmissionsApi.action).mockResolvedValue({
    id: '40000000-0000-4000-8000-000000000001',
    status: 'complete',
  });
});

describe('unified library', () => {
  it('shows the three-cell stat strip from stats plus merged totals', async () => {
    mount();
    await screen.findByText('大熊猫');
    // 在库 12 + 3；通过率 4 / (4 + 6)；待批准 候选 1 + 投稿 1。
    expect(screen.getByRole('button', { name: '在库词数：15，查看完整数值' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: '后台候选审核通过率：40%，查看完整数值' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '待你批准：2，查看完整数值' })).toBeVisible();
    expect(
      screen.getByText('近 30 天后台候选的模型审核通过占比，不包括 Agent 投稿。'),
    ).toBeVisible();
  });

  it('shows the source row from the merged totals', async () => {
    mount();
    await screen.findByText('大熊猫');
    const sources = screen.getByText('Agent 已发布').closest('dl');
    expect(sources).not.toBeNull();
    expect(within(sources as HTMLElement).getByText('15 条')).toBeVisible();
    expect(within(sources as HTMLElement).getByText('2 条')).toBeVisible();
    expect(screen.getByText('Agent 待批准').nextElementSibling).toHaveTextContent('1 条');
    expect(screen.getByText('审核失败待重审').nextElementSibling).toHaveTextContent('1 条');
  });

  it('distinguishes pending approval from approved candidates awaiting review', async () => {
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      ...libraryData,
      totals: {
        candidates: { pending: 3, approved: 4 },
        submissions: { pending: 2, approved: 5 },
      },
    });
    mount();
    expect(await screen.findByRole('button', { name: '待你批准：5，查看完整数值' })).toBeVisible();
    expect(screen.getByText('Agent 待批准').nextElementSibling).toHaveTextContent('2 条');
    expect(
      screen.getByText('已批准待审核', { selector: '.admin-library-summary-key' })
        .nextElementSibling,
    ).toHaveTextContent('9 条');
    expect(within(screen.getByRole('list', { name: '词库流程' })).getByText('14')).toBeVisible();
  });

  it('shows the four-step flow bar without a monthly-published step', async () => {
    mount();
    const bar = await screen.findByRole('list', { name: '词库流程' });
    const stages = within(bar).getAllByRole('listitem');
    expect(stages.map((stage) => stage.textContent)).toEqual([
      '15库存',
      '3待审核 · 待处理',
      '0审核中',
      '0待发布',
    ]);
  });

  it('shows the Tavily meter for fibking only', async () => {
    mount('fibking');
    await screen.findByText('大熊猫');
    expect(screen.getByText('Tavily · 本月')).toBeVisible();
    expect(screen.getByText('736 / 1,000')).toBeVisible();
  });

  it('hides the Tavily meter for drawguess', async () => {
    mount();
    await screen.findByText('大熊猫');
    expect(screen.queryByText('Tavily · 本月')).not.toBeInTheDocument();
  });

  it('shows the inventory explanation instead of cards for source=inventory', async () => {
    mount('drawguess', '?source=inventory');
    await screen.findByText(
      '库存词只在统计与来源行里显示，不进入这条待处理流。这条流只列还没进库的候选与投稿。',
    );
    expect(screen.queryByText('大熊猫')).not.toBeInTheDocument();
  });

  it('shows the duplicate reminder only on the submission row', async () => {
    mount();
    await screen.findByText('大熊猫');
    expect(screen.getAllByText('已有相同词在库')).toHaveLength(2);
  });

  it('opens a batch row as an overlay on the library page', async () => {
    const { router, user } = mount();
    const row = await screen.findByRole('row', {
      name: '打开投稿批次 10000000-0000-4000-8000-000000000001',
    });
    await user.click(row);
    await waitFor(() =>
      expect(router.state.location.search).toContain('batch=10000000-0000-4000-8000-000000000001'),
    );
    expect(screen.getByText('投稿批次审核')).toBeVisible();
    expect(screen.getByText('大熊猫')).toBeVisible();
  });

  it('opens a submission card batch while preserving filters and returns to the library', async () => {
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      ...libraryData,
      items: [{ ...submissionItem, batchId: batchDetail.id }],
    });
    const { router, user } = mount('drawguess', '?search=玫瑰&status=pending');
    const card = (await screen.findByText('玫瑰花')).closest('article');
    expect(card).not.toBeNull();
    await user.click(
      within(card as HTMLElement).getByRole('button', { name: '查看投稿批次：玫瑰花' }),
    );
    expect(router.state.location.search).toContain(`batch=${batchDetail.id}`);
    expect(router.state.location.search).toContain('status=pending');
    const dialog = await screen.findByRole('dialog', { name: '投稿批次审核' });
    expect(wordSubmissionsApi.batch).toHaveBeenCalledWith(batchDetail.id, expect.any(AbortSignal));
    await user.click(within(dialog).getByRole('button', { name: '关闭投稿批次审核' }));
    await waitFor(() => expect(router.state.location.search).not.toContain('batch='));
    expect(router.state.location.search).toContain('status=pending');
    expect(screen.getByText('玫瑰花')).toBeVisible();
  });

  it('filters the card stream by status without filtering the batches zone', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved' },
        expect.any(AbortSignal),
      ),
    );
    expect(wordSubmissionsApi.batches).toHaveBeenCalledWith(
      { game: 'drawguess' },
      expect.any(AbortSignal),
    );
  });

  it('searches the merged stream by word', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    expect(screen.getByText('搜索后台候选和 Agent 投稿；库存只显示数量。')).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: '搜索候选或投稿' }), '玫瑰花');
    await user.click(screen.getByRole('button', { name: '搜' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { search: '玫瑰花' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('resets the card cursor when the status changes after paging', async () => {
    const page2: WordLibraryItem = {
      ...candidateItem,
      key: 'candidate:cand-2',
      id: 'cand-2',
      title: '长颈鹿',
    };
    const approved: WordLibraryItem = {
      ...candidateItem,
      key: 'candidate:cand-9',
      id: 'cand-9',
      title: '金丝猴',
      status: 'approved',
    };
    vi.mocked(fetchLibraryItems).mockImplementation(async (_game, params) => {
      if (params?.status === 'approved')
        return { ...libraryData, items: [approved], nextCursor: null };
      if (params?.cursor === 'C1') return { ...libraryData, items: [page2], nextCursor: null };
      return { ...libraryData, items: [candidateItem], nextCursor: 'C1' };
    });
    const { user } = mount();
    await screen.findByText('大熊猫');
    // Two "下一页" buttons exist (card stream, then the batches zone); the
    // stream pager renders first.
    const nextButtons = screen.getAllByRole('button', { name: '下一页' });
    expect(nextButtons[0]).not.toBeDisabled();
    await user.click(nextButtons[0] as HTMLElement);
    await screen.findByText('长颈鹿');
    expect(screen.getByText('第 2 页')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved' },
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText('金丝猴');
    expect(screen.queryByText('长颈鹿')).not.toBeInTheDocument();
    expect(screen.getByText('第 1 页')).toBeVisible();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
  });

  it('clears the card selection when the status changes', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('checkbox', { name: '选择大熊猫' }));
    expect(screen.getByText('已选 1 / 当前可选 3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved' },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText('已选 1 / 当前可选 3')).not.toBeInTheDocument();
  });

  it('dismisses a pending candidate from the row action', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    const card = screen.getByText('大熊猫').closest('article');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: '拒绝' }));
    expect(showPrompt).toHaveBeenCalledWith('拒绝候选', expect.anything());
    await waitFor(() =>
      expect(dismissWordCandidates).toHaveBeenCalledWith(
        'drawguess',
        ['cand-1'],
        '词太常见，不用审了。',
      ),
    );
    expect(await screen.findByText('已拒绝 1 条。')).toBeVisible();
  });

  it('keeps the success notice visible when the last row is dismissed', async () => {
    let calls = 0;
    vi.mocked(fetchLibraryItems).mockImplementation(async () => {
      calls += 1;
      return calls === 1
        ? libraryData
        : { ...libraryData, items: [], totals: { candidates: {}, submissions: {} } };
    });
    const { user } = mount();
    await screen.findByText('大熊猫');
    const card = screen.getByText('大熊猫').closest('article');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: '拒绝' }));
    await waitFor(() => expect(screen.getByText('已拒绝 1 条。')).toBeVisible());
    await waitFor(() => expect(screen.getByText('暂无待处理词条。')).toBeVisible());
    expect(screen.getByText('已拒绝 1 条。')).toBeVisible();
    expect(screen.queryByText('大熊猫')).not.toBeInTheDocument();
  });

  it('never renders the removed 自带 source label anywhere on the page', async () => {
    mount();
    await screen.findByText('大熊猫');
    expect(document.body.textContent).not.toMatch(/自带/);
  });

  it('never renders the removed monthly-published stat or quota meters', async () => {
    mount();
    await screen.findByText('大熊猫');
    // The removed 本月已发布 tile carried a "目标 100" hint; the removed
    // quota meters were 本月批次 and the two 模型 meters. Tavily · 本月
    // stays (covered by 'shows the Tavily meter for fibking only').
    expect(document.body.textContent).not.toMatch(/本月已发布/);
    expect(document.body.textContent).not.toMatch(/目标 100/);
    expect(screen.queryByText('本月批次')).not.toBeInTheDocument();
    expect(screen.queryByText('模型 · 近 24 小时')).not.toBeInTheDocument();
    expect(screen.queryByText('模型 · 近 30 天')).not.toBeInTheDocument();
  });

  it('endorses a pending submission through its batch dialog', async () => {
    const { user } = mount();
    await screen.findByText('玫瑰花');
    const card = screen.getByText('玫瑰花').closest('article');
    expect(card).not.toBeNull();
    await user.click(within(card as HTMLElement).getByRole('button', { name: '批准' }));
    await user.click(await screen.findByRole('button', { name: '批准进入审核 (1)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({ action: 'endorse' }),
      ),
    );
    expect(await screen.findByText('已批准进入审核 1 条。')).toBeVisible();
  });

  it('splits a mixed bulk approval by row source', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('checkbox', { name: '选择大熊猫' }));
    await user.click(screen.getByRole('checkbox', { name: '选择玫瑰花' }));
    await user.click(screen.getByRole('checkbox', { name: '选择月季' }));
    expect(screen.getByText('已选 3 / 当前可选 3')).toBeVisible();
    expect(screen.getByRole('button', { name: '批量批准 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: '批量拒绝 3' })).toBeVisible();
    expect(screen.getByRole('button', { name: '批量撤回批准 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '批量批准 2' }));
    expect(showPrompt).toHaveBeenCalledWith('批准进入审核', expect.anything());
    await waitFor(() =>
      expect(approveWordCandidates).toHaveBeenCalledWith(
        'drawguess',
        ['cand-1'],
        '词太常见，不用审了。',
      ),
    );
    await user.click(await screen.findByRole('button', { name: '批准进入审核 (1)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({ action: 'endorse' }),
      ),
    );
  });

  it('uses separate action payloads and request IDs for different submission batches', async () => {
    const secondSubmission: WordLibraryItem = {
      ...submissionItem,
      key: 'submission:item-3',
      id: 'item-3',
      batchId: 'batch-2',
      title: '向日葵',
      contentHash: 'c'.repeat(64),
      revision: 3,
    };
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      ...libraryData,
      items: [submissionItem, secondSubmission],
    });
    const { user } = mount();
    await screen.findByText('玫瑰花');
    await user.click(screen.getByRole('checkbox', { name: '选择玫瑰花' }));
    await user.click(screen.getByRole('checkbox', { name: '选择向日葵' }));
    await user.click(screen.getByRole('button', { name: '批量批准 2' }));
    await user.click(await screen.findByRole('button', { name: '批准进入审核 (1)' }));
    await waitFor(() => expect(wordSubmissionsApi.action).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole('button', { name: '批准进入审核 (1)' }));
    await waitFor(() => expect(wordSubmissionsApi.action).toHaveBeenCalledTimes(2));

    const [first, second] = vi.mocked(wordSubmissionsApi.action).mock.calls;
    expect(first?.[0]).toBe('batch-1');
    expect(first?.[1].items).toEqual([{ id: 'item-1', contentHash: 'a'.repeat(64), revision: 1 }]);
    expect(second?.[0]).toBe('batch-2');
    expect(second?.[1].items).toEqual([{ id: 'item-3', contentHash: 'c'.repeat(64), revision: 3 }]);
    expect(second?.[1].id).not.toBe(first?.[1].id);
  });
});
