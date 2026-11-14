import type {
  GameWordsStats,
  WordCandidateListItem,
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
  fetchWordCandidates,
} from '@/features/admin/services/adminApi';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { showPrompt } from '@/utils/alert';

import { UnifiedLibrary } from '../words/UnifiedLibrary';

vi.mock('@/features/admin/services/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminApi')>()),
  fetchGameWordsStats: vi.fn(),
  fetchWordCandidates: vi.fn(),
  approveWordCandidates: vi.fn(),
  dismissWordCandidates: vi.fn(),
}));
vi.mock('@/features/admin/services/wordSubmissionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/wordSubmissionsApi')>()),
  wordSubmissionsApi: {
    batches: vi.fn(),
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
  reviewDecisions: [],
  reviewCheckStats: [],
  queryLeaderboard: [],
  tavilyRequestsUsed: 0,
  tavilyMonthlyQuota: 1000,
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
const candidate: WordCandidateListItem = {
  id: 'cand-1',
  game: 'drawguess',
  title: '大熊猫',
  category: 'animals',
  evidenceCount: null,
  createdAt: '2026-11-14T00:00:00.000Z',
  status: 'pending',
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

function mount(extraSearch = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: '/admin/words/drawguess', element: <UnifiedLibrary game="drawguess" /> }],
    { initialEntries: [`/admin/words/drawguess?section=library${extraSearch}`] },
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
  vi.mocked(fetchGameWordsStats).mockResolvedValue(stats);
  vi.mocked(fetchWordCandidates).mockResolvedValue({
    game: 'drawguess',
    candidates: [candidate],
    nextCursor: null,
  });
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
});

describe('unified library', () => {
  it('shows the five-stage flow bar with honest per-game counts', async () => {
    mount();
    const bar = await screen.findByRole('list', { name: '词库流程' });
    // 库存 12 + 3; 待审核 (1 + 2) + pending 2 + approved 1; 审核中 4; 待发布 5; 本月已发布 10.
    const stages = within(bar).getAllByRole('listitem');
    expect(stages.map((stage) => stage.textContent)).toEqual([
      '15库存',
      '6待审核 · 待处理',
      '4审核中',
      '5待发布',
      '10本月已发布',
    ]);
  });

  it('hides the inventory and candidate panels for source=submissions', async () => {
    mount('&source=submissions');
    await screen.findByText('外部投稿批次');
    expect(screen.queryByText('库存分类')).not.toBeInTheDocument();
    expect(screen.queryByText('待批准候选')).not.toBeInTheDocument();
  });

  it('hides the batches panel for source=inventory', async () => {
    mount('&source=inventory');
    await screen.findByText('库存分类');
    expect(screen.queryByText('外部投稿批次')).not.toBeInTheDocument();
  });

  it('shows the duplicate reminder only on submission rows', async () => {
    mount();
    await screen.findByText('已有相同词在库');
    expect(screen.getAllByText('已有相同词在库')).toHaveLength(1);
    const inventory = screen.getByRole('heading', { name: '库存分类' }).closest('section');
    expect(inventory).not.toBeNull();
    expect(within(inventory as HTMLElement).queryByText('已有相同词在库')).not.toBeInTheDocument();
  });

  it('opens a batch row at the submissions workspace URL', async () => {
    const { router, user } = mount();
    const row = await screen.findByRole('row', {
      name: '打开投稿批次 10000000-0000-4000-8000-000000000001',
    });
    await user.click(row);
    await waitFor(() =>
      expect(router.state.location.search).toContain(
        'section=submissions&batch=10000000-0000-4000-8000-000000000001',
      ),
    );
  });

  it('filters both panels by a shared status', async () => {
    const { user } = mount();
    await screen.findByRole('heading', { name: '待批准候选' });
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '已批准' }));
    await waitFor(() =>
      expect(fetchWordCandidates).toHaveBeenCalledWith(
        'drawguess',
        { status: 'approved', cursor: undefined },
        expect.any(AbortSignal),
      ),
    );
    expect(wordSubmissionsApi.batches).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' }),
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('heading', { name: '已批准候选' })).toBeVisible();
  });

  it('hides the candidate panel for a submission-only status', async () => {
    const { user } = mount();
    await screen.findByRole('heading', { name: '待批准候选' });
    await user.click(screen.getByRole('button', { name: '状态：全部状态' }));
    await user.click(screen.getByRole('button', { name: '审核中' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.batches).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'reviewing' }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByText('待批准候选')).not.toBeInTheDocument();
    expect(screen.getByText('外部投稿批次')).toBeVisible();
  });

  it('dismisses a pending candidate from the row action', async () => {
    const { user } = mount();
    await screen.findByText('大熊猫');
    await user.click(screen.getByRole('button', { name: '拒绝' }));
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
});
