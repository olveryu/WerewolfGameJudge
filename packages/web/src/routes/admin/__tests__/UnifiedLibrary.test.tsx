import type {
  GameWordsStats,
  WordLibraryItem,
  WordLibraryItems,
  WordSubmissionBatch,
} from '@game-judge/game-engine/product/wordSupply';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { fetchGameWordsStats, fetchLibraryItems } from '@/features/admin/services/adminApi';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';

import { UnifiedLibrary } from '../words/UnifiedLibrary';

vi.mock('@/features/admin/services/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminApi')>()),
  fetchGameWordsStats: vi.fn(),
  fetchLibraryItems: vi.fn(),
}));
vi.mock('@/features/admin/services/wordSubmissionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/wordSubmissionsApi')>()),
  wordSubmissionsApi: {
    batch: vi.fn(),
    audit: vi.fn(),
    action: vi.fn(),
    dispatch: vi.fn(),
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
    monthlyUsed: 0,
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
/** A supply-generated word: a submission from the system agent. */
const supplyItem: WordLibraryItem = {
  id: 'item-0',
  batchId: 'batch-supply',
  agentName: '系统补词',
  game: 'drawguess',
  title: '大熊猫',
  category: '动物',
  definition: '大熊猫是一种熊。',
  createdAt: '2026-11-14T00:00:00.000Z',
  status: 'pending',
  duplicateOf: null,
  contentHash: 'c'.repeat(64),
  revision: 0,
};
const submissionItem: WordLibraryItem = {
  id: 'item-1',
  batchId: 'batch-1',
  agentName: 'Muse',
  game: 'drawguess',
  title: '玫瑰花',
  category: '饮食',
  definition: '花。',
  createdAt: '2026-11-13T00:00:00.000Z',
  status: 'pending',
  duplicateOf: 'inventory:玫瑰花',
  contentHash: 'a'.repeat(64),
  revision: 1,
};
const approvedItem: WordLibraryItem = {
  ...submissionItem,
  id: 'item-2',
  title: '月季',
  status: 'approved',
  duplicateOf: null,
  contentHash: 'b'.repeat(64),
  revision: 2,
};
const libraryData: WordLibraryItems = {
  game: 'drawguess',
  items: [supplyItem, submissionItem, approvedItem],
  totals: {
    submissions: { pending: 2, approved: 1, published: 2, failed: 1 },
  },
  nextCursor: null,
};
const batchDetail: WordSubmissionBatch = {
  id: '10000000-0000-4000-8000-000000000001',
  game: 'drawguess',
  agentId: '20000000-0000-4000-8000-000000000001',
  agentName: 'Muse',
  createdAt: '2026-11-13T00:00:00.000Z',
  items: [
    {
      id: 'item-1',
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
  vi.mocked(wordSubmissionsApi.batch).mockResolvedValue(batchDetail);
  vi.mocked(wordSubmissionsApi.audit).mockResolvedValue({ events: [], statuses: [] });
  vi.mocked(wordSubmissionsApi.action).mockResolvedValue({
    id: '40000000-0000-4000-8000-000000000001',
    status: 'complete',
  });
});

describe('unified library', () => {
  it('shows the three-cell stat strip from stats plus submission totals', async () => {
    mount();
    await screen.findByText('大熊猫');
    // 在库 12 + 3；通过率 4 / (4 + 6)；待批准 投稿 2。
    expect(screen.getByRole('button', { name: '在库词数：15，查看完整数值' })).toBeVisible();
    expect(screen.getByRole('button', { name: '投稿审核通过率：40%，查看完整数值' })).toBeVisible();
    expect(screen.getByRole('button', { name: '待你批准：2，查看完整数值' })).toBeVisible();
    expect(screen.getByText('模型审核有结论的投稿中通过的占比，人工通过不计入。')).toBeVisible();
  });

  it('shows the source row from the submission totals', async () => {
    mount();
    await screen.findByText('大熊猫');
    const sources = screen.getByText('已发布').closest('dl');
    expect(sources).not.toBeNull();
    expect(within(sources as HTMLElement).getByText('15 条')).toBeVisible();
    expect(screen.getByText('已发布').nextElementSibling).toHaveTextContent('2 条');
    expect(screen.getByText('待批准').nextElementSibling).toHaveTextContent('2 条');
    expect(screen.getByText('审核失败待重审').nextElementSibling).toHaveTextContent('1 条');
  });

  it('distinguishes pending approval from approved submissions awaiting review', async () => {
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      ...libraryData,
      totals: {
        submissions: { pending: 2, approved: 5 },
      },
    });
    mount();
    expect(await screen.findByRole('button', { name: '待你批准：2，查看完整数值' })).toBeVisible();
    expect(screen.getByText('待批准').nextElementSibling).toHaveTextContent('2 条');
    expect(
      screen.getByText('已批准待审核', { selector: '.admin-library-summary-key' })
        .nextElementSibling,
    ).toHaveTextContent('5 条');
    expect(within(screen.getByRole('list', { name: '词库流程' })).getByText('7')).toBeVisible();
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

  it('has no source filter: the stream is submissions only', async () => {
    mount();
    await screen.findByText('大熊猫');
    expect(screen.queryByText('全部来源')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent 投稿')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索投稿' })).toHaveAttribute(
      'placeholder',
      '搜索投稿的词语、分类',
    );
  });

  it('marks a supply-generated word as a submission from the system agent', async () => {
    mount();
    await screen.findByText('大熊猫');
    // The card badge names the source by agent: system-generated words read
    // 后台生成, agent submissions read Agent投稿.
    const card = screen.getByText('大熊猫').closest('article');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('后台生成')).toBeVisible();
    expect(within(card as HTMLElement).getByText(/来源 系统补词/)).toBeVisible();
  });

  it('shows the duplicate reminder only on the submission row', async () => {
    mount();
    await screen.findByText('大熊猫');
    // Only the card whose word is already in the inventory shows the
    // reminder; the supply card does not.
    const duplicateCard = (await screen.findByText('玫瑰花')).closest('article');
    expect(duplicateCard).not.toBeNull();
    expect(within(duplicateCard as HTMLElement).getByText('已有相同词在库')).toBeVisible();
    const supplyCard = screen.getByText('大熊猫').closest('article');
    expect(supplyCard).not.toBeNull();
    expect(within(supplyCard as HTMLElement).queryByText('已有相同词在库')).not.toBeInTheDocument();
  });

  it('never renders a batches panel or batch links', async () => {
    mount('drawguess', '?batch=10000000-0000-4000-8000-000000000001');
    await screen.findByText('大熊猫');
    expect(screen.queryByText('投稿批次')).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /打开投稿批次/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /查看投稿批次/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '投稿批次审核' })).not.toBeInTheDocument();
  });

  it('opens the item drawer from a card title and closes back to the list', async () => {
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      ...libraryData,
      items: [{ ...submissionItem, batchId: batchDetail.id }],
    });
    const { user } = mount('drawguess', '?search=玫瑰&status=pending');
    await user.click(await screen.findByRole('button', { name: '查看玫瑰花审核详情' }));
    const drawer = await screen.findByRole('dialog', { name: '词条详情' });
    expect(wordSubmissionsApi.batch).toHaveBeenCalledWith(batchDetail.id, expect.any(AbortSignal));
    expect(within(drawer).getByRole('heading', { name: '玫瑰花' })).toBeVisible();
    await user.click(within(drawer).getByRole('button', { name: '关闭' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '词条详情' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('玫瑰花')).toBeVisible();
  });

  it('confirms a stalled review dispatch from the item drawer', async () => {
    const reviewingItem: WordLibraryItem = {
      ...submissionItem,
      id: 'item-5',
      title: '茉莉',
      status: 'reviewing',
      duplicateOf: null,
      contentHash: 'e'.repeat(64),
      revision: 1,
      batchId: batchDetail.id,
    };
    vi.mocked(fetchLibraryItems).mockResolvedValue({ ...libraryData, items: [reviewingItem] });
    vi.mocked(wordSubmissionsApi.batch).mockResolvedValue({
      ...batchDetail,
      items: [
        {
          id: 'item-5',
          clientItemId: 'item-5',
          identity: '茉莉',
          contentHash: 'e'.repeat(64),
          title: '茉莉',
          category: '饮食',
          content: { word: '茉莉' },
          status: 'reviewing',
          duplicateOf: null,
          reviewId: 'review-1',
          reviewVersion: null,
          reviewModel: null,
          review: null,
          failure: null,
          approvalReason: null,
          revision: 1,
        },
      ],
    });
    vi.mocked(wordSubmissionsApi.dispatch).mockResolvedValue({ success: true });
    const { user } = mount();
    await user.click(await screen.findByRole('button', { name: '查看茉莉审核详情' }));
    const drawer = await screen.findByRole('dialog', { name: '词条详情' });
    await user.click(within(drawer).getByRole('button', { name: '确认审核任务启动' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.dispatch).toHaveBeenCalledWith(batchDetail.id, 'review-1'),
    );
  });

  it('filters the card stream by status', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准待审核' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('searches the submission stream by word', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    expect(screen.getByText('搜索投稿；库存只显示数量。')).toBeVisible();
    await user.type(screen.getByRole('searchbox', { name: '搜索投稿' }), '玫瑰花');
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
      ...submissionItem,
      id: 'item-2',
      title: '长颈鹿',
    };
    const approved: WordLibraryItem = {
      ...submissionItem,
      id: 'item-9',
      title: '金丝猴',
      status: 'approved',
    };
    vi.mocked(fetchLibraryItems).mockImplementation(async (_game, params) => {
      if (params?.status === 'approved')
        return { ...libraryData, items: [approved], nextCursor: null };
      if (params?.cursor === 'C1') return { ...libraryData, items: [page2], nextCursor: null };
      return { ...libraryData, items: [supplyItem], nextCursor: 'C1' };
    });
    const { user } = mount();
    await screen.findByText('大熊猫');
    const nextButton = screen.getByRole('button', { name: '下一页' });
    expect(nextButton).not.toBeDisabled();
    await user.click(nextButton);
    await screen.findByText('长颈鹿');
    expect(screen.getByText('第 2 页')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准待审核' }));
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
    await user.click(screen.getByRole('button', { name: '已批准待审核' }));
    await waitFor(() =>
      expect(fetchLibraryItems).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved' },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText('已选 1 / 当前可选 3')).not.toBeInTheDocument();
  });

  it('clears the card selection when the page changes', async () => {
    const page2: WordLibraryItem = {
      ...submissionItem,
      id: 'item-2',
      title: '长颈鹿',
    };
    vi.mocked(fetchLibraryItems).mockImplementation(async (_game, params) => {
      if (params?.cursor === 'C1') return { ...libraryData, items: [page2], nextCursor: null };
      return { ...libraryData, items: [supplyItem], nextCursor: 'C1' };
    });
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('checkbox', { name: '选择大熊猫' }));
    expect(screen.getByText('已选 1 / 当前可选 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('长颈鹿');
    expect(screen.getByText('第 2 页')).toBeVisible();
    // Paging remounts the card stream, so the selection is cleared with it.
    expect(screen.getByText('已选 0 / 当前可选 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '上一页' }));
    await screen.findByText('大熊猫');
    expect(screen.getByText('第 1 页')).toBeVisible();
    expect(screen.getByText('已选 0 / 当前可选 1')).toBeVisible();
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

  it('never renders the removed candidate bulk labels', async () => {
    mount();
    await screen.findByText('大熊猫');
    expect(screen.queryByRole('button', { name: '批量审核' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '批量发布' })).not.toBeInTheDocument();
  });

  it('starts review for approved items from the bulk bar', async () => {
    const { user } = mount();
    await screen.findByText('月季');
    await user.click(screen.getByRole('checkbox', { name: '选择月季' }));
    expect(screen.getByRole('button', { name: '启动独立审核 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '启动独立审核 1' }));
    await user.click(await screen.findByRole('button', { name: '启动独立审核 (1)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({
          action: 'review',
          items: [expect.objectContaining({ id: 'item-2' })],
        }),
      ),
    );
    expect(await screen.findByText(/已启动独立审核 1 条/)).toBeVisible();
  });

  it('publishes passed items from the bulk bar', async () => {
    const passedItem: WordLibraryItem = {
      ...submissionItem,
      id: 'item-4',
      title: '牡丹',
      status: 'passed',
      duplicateOf: null,
      contentHash: 'd'.repeat(64),
      revision: 1,
    };
    vi.mocked(fetchLibraryItems).mockResolvedValue({ ...libraryData, items: [passedItem] });
    const { user } = mount();
    await screen.findByText('牡丹');
    await user.click(screen.getByRole('checkbox', { name: '选择牡丹' }));
    expect(screen.getByRole('button', { name: '确认发布 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '确认发布 1' }));
    await user.click(await screen.findByRole('button', { name: '确认发布 (1)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({
          action: 'publish',
          items: [expect.objectContaining({ id: 'item-4' })],
        }),
      ),
    );
    expect(await screen.findByText('已确认发布 1 条。')).toBeVisible();
  });

  it('approves pending items from the bulk bar without a reason', async () => {
    const { user } = mount();
    await screen.findByText('玫瑰花');
    await user.click(screen.getByRole('checkbox', { name: '选择玫瑰花' }));
    expect(screen.getByRole('button', { name: '人工通过 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '人工通过 1' }));
    const dialog = await screen.findByRole('dialog', { name: '人工通过' });
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '人工通过 (1)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({
          action: 'approve',
          items: [expect.objectContaining({ id: 'item-1' })],
        }),
      ),
    );
    expect(await screen.findByText('已人工通过 1 条。')).toBeVisible();
  });

  it('says a cross-batch selection confirms per batch', async () => {
    const secondSubmission: WordLibraryItem = {
      ...submissionItem,
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
    expect(screen.getByText('所选条目分属 2 个批次，将按批次分别确认。')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '批量批准 2' }));
    const dialog = await screen.findByRole('dialog', { name: '批准进入审核' });
    expect(
      within(dialog).getByText(
        '所选条目分属多个批次，将按批次分别确认；本次确认只针对当前批次的词条。',
      ),
    ).toBeVisible();
  });

  it('endorses a pending submission through its action dialog', async () => {
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

  it('shows only submission actions in the bulk bar', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('checkbox', { name: '选择大熊猫' }));
    await user.click(screen.getByRole('checkbox', { name: '选择玫瑰花' }));
    await user.click(screen.getByRole('checkbox', { name: '选择月季' }));
    expect(screen.getByText('已选 3 / 当前可选 3')).toBeVisible();
    expect(screen.getByRole('button', { name: '批量批准 2' })).toBeVisible();
    expect(screen.getByRole('button', { name: '批量拒绝 3' })).toBeVisible();
    expect(screen.getByRole('button', { name: '批量撤回批准 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: '启动独立审核 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: '人工通过 2' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /确认发布/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /批量审核/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /批量发布/ })).not.toBeInTheDocument();
  });

  it('dismisses items from the bulk bar without a reason', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('checkbox', { name: '选择玫瑰花' }));
    await user.click(screen.getByRole('checkbox', { name: '选择月季' }));
    await user.click(screen.getByRole('button', { name: '批量拒绝 2' }));
    const dialog = await screen.findByRole('dialog', { name: '拒绝候选' });
    // The reason box stays, but it is optional: submitting with it empty works.
    expect(within(dialog).getByRole('textbox', { name: '操作原因' })).not.toBeRequired();
    await user.click(within(dialog).getByRole('button', { name: '拒绝候选 (2)' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.action).toHaveBeenCalledWith(
        'batch-1',
        expect.objectContaining({ action: 'dismiss', reason: '' }),
      ),
    );
    expect(await screen.findByText('已拒绝 2 条。')).toBeVisible();
  });

  it('uses separate action payloads and request IDs for different submission batches', async () => {
    const secondSubmission: WordLibraryItem = {
      ...submissionItem,
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
