import type {
  WordSubmissionAgent,
  WordSubmissionBatch,
  WordSubmissionItem,
  WordSubmissionSettings,
} from '@game-judge/game-engine/product/wordSupply';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';

import { SubmissionAgentsPage } from '../words/SubmissionAgents';
import { SubmissionsPage } from '../words/SubmissionsPage';

vi.mock('@/features/admin/services/wordSubmissionsApi', () => ({
  wordSubmissionsApi: {
    settings: vi.fn(),
    setAccepting: vi.fn(),
    agents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    rotate: vi.fn(),
    setAgentStatus: vi.fn(),
    batches: vi.fn(),
    batch: vi.fn(),
    audit: vi.fn(),
    action: vi.fn(),
    dispatch: vi.fn(),
  },
}));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));
vi.mock('@/utils/alert', () => ({
  CANCEL_BUTTON: { text: '取消', style: 'cancel' },
  showAlert: vi.fn(),
}));

const settings: WordSubmissionSettings = {
  accepting: true,
  pending: 4,
  pendingLimit: 5000,
  awaitingReview: 1,
  awaitingPublication: 1,
  failed: 1,
  published: 1,
  submittedToday: 9,
  dailyLimit: 1000,
  modelBudget: { dailyUsed: 0, dailyLimit: 8, monthlyUsed: 0, monthlyLimit: 120 },
};
function candidate(status: WordSubmissionItem['status'], index: number): WordSubmissionItem {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    clientItemId: `item-${index}`,
    identity: `word-${index}`,
    title: `词语${index}`,
    contentHash: 'a'.repeat(64),
    category: 'animals',
    content: { word: `词语${index}` },
    status,
    duplicateOf: null,
    reviewId: null,
    reviewVersion: '1',
    reviewModel: 'test-model',
    review: {
      passed: status !== 'rejected',
      canOverride: true,
      reason: '独立结论',
      checks: { isAppropriate: true },
      details: {},
    },
    failure: null,
    approvalReason: null,
    revision: 1,
  };
}
const batch: WordSubmissionBatch = {
  id: '10000000-0000-4000-8000-000000000001',
  game: 'drawguess',
  agentId: '20000000-0000-4000-8000-000000000001',
  agentName: 'Muse',
  createdAt: '2026-11-13T00:00:00.000Z',
  items: (
    [
      'pending',
      'passed',
      'rejected',
      'failed',
      'reviewing',
      'published',
      'dismissed',
      'unpublished',
      'duplicate',
    ] as const
  ).map(candidate),
};
const authorization: WordSubmissionAgent = {
  id: batch.agentId,
  name: 'Muse',
  description: '个人词库助手',
  games: ['drawguess'],
  status: 'active',
  dailyQuota: 100,
  pendingQuota: 200,
  pending: 2,
  submittedToday: 3,
  createdAt: batch.createdAt,
  credential: {
    id: '30000000-0000-4000-8000-000000000001',
    prefix: 'wst_test',
    expiresAt: '2026-12-13T00:00:00.000Z',
    revokedAt: null,
  },
};
function mount(section = 'batch', extraSearch = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/admin/words/drawguess',
        element:
          section === 'agents' ? (
            <SubmissionAgentsPage game="drawguess" />
          ) : (
            <SubmissionsPage game="drawguess" />
          ),
      },
    ],
    {
      initialEntries: [
        `/admin/words/drawguess?section=${section === 'agents' ? 'agents' : 'submissions'}${section === 'batch' ? `&batch=${batch.id}` : ''}${extraSearch}`,
      ],
    },
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
  vi.mocked(wordSubmissionsApi.batch).mockResolvedValue(batch);
  vi.mocked(wordSubmissionsApi.settings).mockResolvedValue(settings);
  vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [] });
  vi.mocked(wordSubmissionsApi.audit).mockResolvedValue({ events: [], statuses: [] });
  vi.mocked(wordSubmissionsApi.batches).mockResolvedValue({ batches: [], nextCursor: null });
});

it.each([false, true])(
  'edits authorization parameters without issuing another credential (renew=%s)',
  async (renew) => {
    vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [authorization] });
    vi.mocked(wordSubmissionsApi.updateAgent).mockResolvedValue(authorization);
    const { user } = mount('agents');
    await user.click(await screen.findByRole('button', { name: '查看 Muse 授权' }));
    const details = await screen.findByRole('dialog', { name: 'Muse' });
    await user.click(within(details).getByRole('button', { name: '修改授权参数' }));
    const editor = await screen.findByRole('dialog', { name: '修改 Agent 授权' });
    const fields = within(editor);
    expect(fields.getByRole('textbox', { name: '名称' })).toHaveValue('Muse');
    expect(fields.getByRole('button', { name: '保持到期时间' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.clear(fields.getByRole('textbox', { name: '名称' }));
    await user.type(fields.getByRole('textbox', { name: '名称' }), 'Muse edited');
    await user.clear(fields.getByRole('textbox', { name: '用途说明' }));
    await user.type(fields.getByRole('textbox', { name: '用途说明' }), '新用途');
    await user.click(fields.getByRole('checkbox', { name: '瞎掰王' }));
    await user.clear(fields.getByRole('spinbutton', { name: '每日投稿上限' }));
    await user.type(fields.getByRole('spinbutton', { name: '每日投稿上限' }), '50');
    await user.clear(fields.getByRole('spinbutton', { name: '未处理候选上限' }));
    await user.type(fields.getByRole('spinbutton', { name: '未处理候选上限' }), '80');
    if (renew) await user.click(fields.getByRole('button', { name: '90 天' }));
    await user.click(fields.getByRole('button', { name: '保存授权参数' }));
    await waitFor(() =>
      expect(wordSubmissionsApi.updateAgent).toHaveBeenCalledWith(authorization.id, {
        name: 'Muse edited',
        description: '新用途',
        games: ['drawguess', 'fibking'],
        dailyQuota: 50,
        pendingQuota: 80,
        ...(renew ? { expiresInDays: 90 } : {}),
      }),
    );
    expect(wordSubmissionsApi.createAgent).not.toHaveBeenCalled();
    expect(wordSubmissionsApi.rotate).not.toHaveBeenCalled();
  },
);

it('confirms deletion of revoked authorizations and removes them from the refreshed list', async () => {
  vi.mocked(wordSubmissionsApi.agents)
    .mockResolvedValueOnce({ agents: [{ ...authorization, status: 'revoked' }] })
    .mockResolvedValue({ agents: [] });
  vi.mocked(wordSubmissionsApi.deleteAgent).mockResolvedValue({ success: true });
  const { user } = mount('agents');
  await user.click(await screen.findByRole('button', { name: '查看 Muse 授权' }));
  const details = await screen.findByRole('dialog', { name: 'Muse' });
  expect(within(details).queryByRole('button', { name: '修改授权参数' })).not.toBeInTheDocument();
  await user.click(within(details).getByRole('button', { name: '删除授权…' }));
  expect(wordSubmissionsApi.deleteAgent).not.toHaveBeenCalled();
  const confirmation = vi
    .mocked(showAlert)
    .mock.calls.at(-1)?.[2]
    ?.find((button) => button.text === '删除');
  if (confirmation?.onPress === undefined) throw new Error('Expected delete confirmation');
  await act(() => confirmation.onPress?.());
  await waitFor(() =>
    expect(wordSubmissionsApi.deleteAgent).toHaveBeenCalledWith(authorization.id),
  );
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: '查看 Muse 授权' })).not.toBeInTheDocument(),
  );
});

it('selects only unlocked visible candidates, maintains indeterminate state, and clears on filtering', async () => {
  const { user } = mount();
  const all = await screen.findByRole('checkbox', { name: '全选当前结果' });
  await user.click(screen.getByRole('checkbox', { name: '选择词语0' }));
  expect(all).toBePartiallyChecked();
  await user.click(all);
  expect(screen.getByText('已选 4 / 当前可选 4')).toBeInTheDocument();
  for (const index of [4, 5, 6, 7, 8])
    expect(screen.getByRole('checkbox', { name: `选择词语${index}` })).toBeDisabled();
  expect(screen.getByRole('button', { name: '发布所选 (1)' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '审核所选 (2)' })).toBeEnabled();
  await user.click(
    within(screen.getByRole('group', { name: '筛选候选状态' })).getByRole('button', {
      name: '待确认发布 1',
    }),
  );
  expect(all).not.toBeChecked();
  expect(screen.getByText('已选 0 / 当前可选 1')).toBeInTheDocument();
  await user.click(all);
  expect(screen.getByText('已选 1 / 当前可选 1')).toBeInTheDocument();
});

it('opens an agent detail from its row without using the detail button', async () => {
  vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [authorization] });
  const { user } = mount('agents');
  await user.click(await screen.findByRole('cell', { name: '3 / 100' }));
  expect(await screen.findByRole('dialog', { name: 'Muse' })).toBeVisible();
});

it('opens candidate details from the row while leaving selection controls independent', async () => {
  const { user } = mount();
  const checkbox = await screen.findByRole('checkbox', { name: '选择词语0' });
  const row = checkbox.closest('tr');
  if (row === null) throw new Error('Candidate row not found');

  await user.click(checkbox);
  expect(screen.queryByRole('dialog', { name: '词条详情' })).not.toBeInTheDocument();

  await user.click(within(row).getByRole('cell', { name: 'animals' }));
  const drawer = await screen.findByRole('dialog', { name: '词条详情' });
  expect(drawer).toBeVisible();
  await user.click(within(drawer).getByRole('button', { name: '关闭详情' }));
  row.focus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('dialog', { name: '词条详情' })).toBeVisible();
});

it('opens a submission batch from its row without following only the batch link', async () => {
  vi.mocked(wordSubmissionsApi.batches).mockResolvedValue({
    batches: [
      {
        id: batch.id,
        game: batch.game,
        agentId: batch.agentId,
        agentName: batch.agentName,
        createdAt: batch.createdAt,
        counts: { pending: 1 },
      },
    ],
    nextCursor: null,
  });
  const { router, user } = mount('submissions');
  const source = await screen.findByRole('cell', { name: 'Muse' });
  await user.click(source);
  await waitFor(() => expect(router.state.location.search).toContain(`batch=${batch.id}`));
});

it('starts all pending/failed items independently of selection and never includes locked items', async () => {
  const { user } = mount();
  await user.click(await screen.findByRole('button', { name: '审核全部待审 (2)' }));
  const dialog = await screen.findByRole('dialog', { name: '启动独立审核' });
  expect(within(dialog).getByText('词语0')).toBeInTheDocument();
  expect(within(dialog).getByText('词语3')).toBeInTheDocument();
  expect(within(dialog).queryByText('词语1')).not.toBeInTheDocument();
  expect(wordSubmissionsApi.action).not.toHaveBeenCalled();
});

it('reviews at exhausted quotas without a reason and freezes retries', async () => {
  vi.mocked(wordSubmissionsApi.settings).mockResolvedValue({
    ...settings,
    modelBudget: { dailyUsed: 93, dailyLimit: 8, monthlyUsed: 696, monthlyLimit: 120 },
  });
  vi.mocked(wordSubmissionsApi.action)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: crypto.randomUUID(), status: 'queued' });
  const { user } = mount();
  const review = await screen.findByRole('button', { name: '审核全部待审 (2)' });
  expect(review).toBeEnabled();
  expect(screen.queryByRole('button', { name: /强制审核/ })).not.toBeInTheDocument();
  await user.click(review);
  const dialog = await screen.findByRole('dialog', { name: '启动独立审核' });
  expect(within(dialog).getByText(/可能产生费用/)).toBeInTheDocument();
  expect(wordSubmissionsApi.action).not.toHaveBeenCalled();
  expect(within(dialog).queryByRole('textbox', { name: '操作原因' })).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: '启动独立审核 (2)' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('offline');
  await user.click(within(dialog).getByRole('button', { name: '重试同一请求' }));
  await waitFor(() => expect(wordSubmissionsApi.action).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(wordSubmissionsApi.action).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]?.[1]).toMatchObject({
    action: 'review',
    reason: '',
    items: [{ id: batch.items[0]?.id }, { id: batch.items[3]?.id }],
  });
});

it('offers selected and single-item review without separate force controls', async () => {
  const { user } = mount();
  await user.click(await screen.findByRole('checkbox', { name: '全选当前结果' }));
  await user.click(screen.getByRole('button', { name: '审核所选 (2)' }));
  let dialog = await screen.findByRole('dialog', { name: '启动独立审核' });
  expect(within(dialog).queryByText('词语1')).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: '取消' }));
  await user.click(screen.getByRole('button', { name: '查看词语2审核详情' }));
  const drawer = await screen.findByRole('dialog', { name: '词条详情' });
  await user.click(within(drawer).getByRole('button', { name: '重新审核…' }));
  dialog = await screen.findByRole('dialog', { name: '启动独立审核' });
  expect(within(dialog).getByText('词语2')).toBeInTheDocument();
  expect(wordSubmissionsApi.action).not.toHaveBeenCalled();
});

it('does not depend on the budget request for administrator review', async () => {
  vi.mocked(wordSubmissionsApi.settings).mockRejectedValue(new Error('settings offline'));
  mount();
  expect(await screen.findByRole('button', { name: '审核全部待审 (2)' })).toBeEnabled();
  expect(wordSubmissionsApi.settings).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /强制审核/ })).not.toBeInTheDocument();
});

it('bulk publishes only passed items and retries the same immutable action after network uncertainty', async () => {
  vi.mocked(wordSubmissionsApi.action)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: crypto.randomUUID(), status: 'complete' });
  const { user } = mount();
  await user.click(await screen.findByRole('checkbox', { name: '全选当前结果' }));
  await user.click(screen.getByRole('button', { name: '发布所选 (1)' }));
  const dialog = await screen.findByRole('dialog', { name: '确认发布' });
  await user.click(within(dialog).getByRole('button', { name: '确认发布 (1)' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('offline');
  await user.click(within(dialog).getByRole('button', { name: '重试同一请求' }));
  await waitFor(() => expect(wordSubmissionsApi.action).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(wordSubmissionsApi.action).mock.calls;
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0]?.[1]).toMatchObject({
    action: 'publish',
    items: [{ id: batch.items[1]?.id, revision: 1 }],
  });
  expect(calls[0]?.[1].items).toHaveLength(1);
});

it('keeps contextual actions in the drawer and preserves the original verdict after human approval', async () => {
  vi.mocked(wordSubmissionsApi.batch).mockResolvedValue({
    ...batch,
    items: [
      {
        ...candidate('passed', 2),
        review: candidate('rejected', 2).review,
        approvalReason: '人工已核对',
      },
    ],
  });
  const { user } = mount();
  await user.click(await screen.findByRole('button', { name: '查看词语2审核详情' }));
  const drawer = await screen.findByRole('dialog', { name: '词条详情' });
  expect(within(drawer).getByText(/原模型结论：未通过/)).toBeInTheDocument();
  expect(within(drawer).getByText('人工批准原因：人工已核对')).toBeInTheDocument();
  const publish = within(drawer).getByRole('button', { name: '确认发布…' });
  expect(publish.closest('footer')).toHaveClass('admin-drawer-footer');
  await user.click(publish);
  expect(await screen.findByRole('dialog', { name: '确认发布' })).toBeInTheDocument();
});

it('uses choice-sheet filters and resets pagination when a filter changes', async () => {
  const { user, router } = mount('list', '&cursor=42');
  await user.click(await screen.findByRole('button', { name: '游戏：全部游戏' }));
  const dialog = await screen.findByRole('dialog', { name: '选择游戏' });
  await user.click(within(dialog).getByRole('button', { name: '谁是卧底' }));
  await waitFor(() => expect(router.state.location.search).toContain('game=undercover'));
  expect(router.state.location.search).not.toContain('cursor');
  expect(wordSubmissionsApi.batches).toHaveBeenLastCalledWith(
    { game: 'undercover' },
    expect.any(AbortSignal),
  );
  await user.click(screen.getByRole('button', { name: '清空筛选' }));
  await waitFor(() => expect(router.state.location.search).toBe('?section=submissions'));
});

it('explains review infrastructure failures without offering publication or a human bypass', async () => {
  vi.mocked(wordSubmissionsApi.batch).mockResolvedValue({
    ...batch,
    items: [{ ...candidate('failed', 3), review: null, failure: 'model-review:configuration' }],
  });
  const { user } = mount();
  await user.click(await screen.findByRole('button', { name: '查看词语3审核详情' }));
  const drawer = await screen.findByRole('dialog', { name: '词条详情' });
  expect(within(drawer).getByRole('alert')).toHaveTextContent('审核未完成，不能发布');
  expect(within(drawer).getByText('诊断码：model-review:configuration')).toBeInTheDocument();
  expect(within(drawer).queryByRole('button', { name: '确认发布…' })).not.toBeInTheDocument();
  expect(within(drawer).queryByRole('button', { name: '人工批准…' })).not.toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: '重试审核…' })).toBeEnabled();
});

it('recomputes credential expiry when the authorization list is refreshed', async () => {
  const initialTime = Date.parse('2026-11-13T00:00:00.000Z');
  const clock = vi.spyOn(Date, 'now').mockReturnValue(initialTime);
  try {
    vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({
      agents: [
        {
          id: batch.agentId,
          name: 'Muse',
          description: '',
          games: ['drawguess'],
          status: 'active',
          dailyQuota: 100,
          pendingQuota: 200,
          pending: 0,
          submittedToday: 0,
          createdAt: batch.createdAt,
          credential: {
            id: '30000000-0000-4000-8000-000000000001',
            prefix: 'wst_test',
            expiresAt: '2026-11-13T00:00:01.000Z',
            revokedAt: null,
          },
        },
      ],
    });
    const { client } = mount('agents');
    expect(await screen.findByText('有效', { exact: true })).toBeInTheDocument();
    clock.mockReturnValue(initialTime + 2000);
    await act(() => client.refetchQueries({ queryKey: ['admin', 'word-submissions'] }));
    expect(await screen.findByText('已过期', { exact: true })).toBeInTheDocument();
  } finally {
    clock.mockRestore();
  }
});

it('shows issuance secrets only in local dialog state and reports copy failure without caching the token', async () => {
  const issued = {
    agent: {
      id: batch.agentId,
      name: 'Muse',
      description: '',
      games: ['drawguess'] as const,
      status: 'active' as const,
      dailyQuota: 100,
      pendingQuota: 200,
      pending: 0,
      submittedToday: 0,
      createdAt: batch.createdAt,
      credential: null,
    },
    token: 'wst_' + 'b'.repeat(64),
  };
  vi.mocked(wordSubmissionsApi.createAgent).mockResolvedValue({
    ...issued,
    agent: { ...issued.agent, games: [...issued.agent.games] },
  });
  const { user, client } = mount('agents');
  await user.click(await screen.findByRole('button', { name: '新建授权' }));
  const form = await screen.findByRole('dialog', { name: '新建 Agent 授权' });
  await user.type(within(form).getByRole('textbox', { name: '名称' }), 'Muse');
  await user.click(within(form).getByRole('button', { name: '创建并显示凭证' }));
  const secret = await screen.findByRole('dialog', { name: '请立即保存完整凭证' });
  expect(within(secret).getByRole('textbox', { name: '完整投稿凭证' })).toHaveValue(issued.token);
  expect(within(secret).getByRole('button', { name: '关闭面板' })).toBeDisabled();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('clipboard denied'));
  await user.click(within(secret).getByRole('button', { name: '复制凭证' }));
  expect(await within(secret).findByRole('status')).toHaveTextContent('复制失败');
  expect(handleError).toHaveBeenCalled();
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((entry) => entry.state),
    ),
  ).not.toContain(issued.token);
  expect(
    JSON.stringify(
      client
        .getMutationCache()
        .getAll()
        .map((entry) => entry.state),
    ),
  ).not.toContain(issued.token);
  await user.click(within(secret).getByRole('button', { name: '我已保存，关闭' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
