/** Shard exchange uses the shared confirmation before submitting a mutation. */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { ShardExchangePage } from '@/routes/shardExchange/ShardExchangePage';
import { showAlert } from '@/utils/alert';

const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));

vi.mock('@/utils/alert', () => ({ showAlert: vi.fn() }));
vi.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => ({ data: { unlockedItems: [] }, isLoading: false }),
}));
vi.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: { shards: 100_000 }, isLoading: false }),
}));
vi.mock('@/features/gacha/queries/gachaMutations', () => ({
  useExchangeShardMutation: () => ({ mutate: mocks.exchange, isPending: false }),
  usePendingGachaOperation: () => ({ pendingOperation: null, confirmRecovery: vi.fn() }),
}));
vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
  ResidentAvatarTile: () => <span data-testid="resident-tile" />,
}));
vi.mock('@/routes/gacha/components/RewardPreview', () => ({
  RewardPreview: () => null,
  getRewardDisplayName: (_productUi: unknown, _type: string, id: string) => id,
}));

beforeAll(async () => {
  await loadClientProductUi();
});

it('opens the shared confirmation and exchanges only after approval', async () => {
  const router = createMemoryRouter(
    [{ path: '/shard-exchange/:roomCode?', element: <ShardExchangePage /> }],
    { initialEntries: ['/shard-exchange'] },
  );
  // eslint-disable-next-line testing-library/no-unnecessary-act -- the sync act inside render leaves the use() retry unflushed; only an async act settles it.
  await act(async () => {
    render(<RouterProvider router={router} />);
  });

  const [firstExchange] = screen.getAllByRole('button', { name: /^用 \d+ 碎片兑换「/ });
  if (firstExchange === undefined) throw new Error('No exchange button rendered');
  await userEvent.click(firstExchange);

  expect(showAlert).toHaveBeenCalledWith('确认兑换', expect.any(String), expect.any(Array));
  expect(mocks.exchange).not.toHaveBeenCalled();
  const confirm = vi.mocked(showAlert).mock.calls[0]?.[2]?.find((button) => button.text === '兑换');
  if (confirm?.onPress === undefined) throw new Error('Missing 兑换 confirmation button');
  const { onPress } = confirm;
  // The confirmation runs outside React.
  await act(async () => {
    await onPress();
  });
  expect(mocks.exchange).toHaveBeenCalledTimes(1);
});
