/** Shard exchange uses the cross-platform confirmation before submitting a mutation. */
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { showAlert } from '@/utils/alert';

import { ShardExchangeScreen } from '../ShardExchangeScreen';

const mockExchange = jest.fn();
jest.mock('@/utils/alert', () => ({ showAlert: jest.fn() }));
jest.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => ({ data: { unlockedItems: [] }, isLoading: false }),
}));
jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: { shards: 100_000 }, isLoading: false }),
  useExchangeShardMutation: () => ({ mutate: mockExchange, isPending: false }),
  usePendingGachaOperation: () => ({ pendingOperation: null, confirmRecovery: jest.fn() }),
}));
jest.mock('@/features/product/context/ClientProductUiContext', () => ({
  useClientProductUi: () => ({}),
}));
jest.mock('../../GachaScreen/components/RewardPreview', () => ({
  RewardPreview: () => null,
  getRewardDisplayName: (_product: unknown, _type: string, id: string) => id,
}));

it('opens the shared confirmation and exchanges only after approval', async () => {
  const navigation = { canGoBack: () => false, navigate: jest.fn() } as unknown as ComponentProps<
    typeof ShardExchangeScreen
  >['navigation'];
  const view = render(
    <ShardExchangeScreen
      navigation={navigation}
      route={{ key: 'exchange', name: 'ShardExchange' }}
    />,
  );
  fireEvent.press(view.getAllByText(/^✦ /)[0]!);
  expect(showAlert).toHaveBeenCalledWith('确认兑换', expect.any(String), expect.any(Array));
  expect(mockExchange).not.toHaveBeenCalled();
  const confirm = jest
    .mocked(showAlert)
    .mock.calls[0]![2]!.find((button) => button.text === '兑换')!;
  await act(async () => {
    await confirm.onPress!();
  });
  expect(mockExchange).toHaveBeenCalledTimes(1);
});
