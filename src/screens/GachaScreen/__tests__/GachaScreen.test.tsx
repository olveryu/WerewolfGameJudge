/** Gacha query states must not present missing data as a confirmed zero balance. */
import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';

import { GachaScreen } from '../GachaScreen';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'gacha-user', isAnonymous: false } }),
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: jest.fn(),
  useDrawMutation: () => ({ mutate: jest.fn(), isPending: false }),
  usePendingGachaOperation: () => ({ pendingOperation: null, confirmRecovery: jest.fn() }),
}));
jest.mock('../components/CapsuleMachine', () => ({ CapsuleMachine: () => null }));
jest.mock('../components/SingleResultReveal', () => ({ SingleResultReveal: () => null }));
jest.mock('../components/TenResultOverlay', () => ({ TenResultOverlay: () => null }));
jest.mock('../components/RateDisclosureModal', () => ({ RateDisclosureModal: () => null }));
jest.mock('../components/DrawButton', () => ({ DrawButton: () => null }));
jest.mock('../components/TicketTabBar', () => ({ TicketTabBar: () => null }));
jest.mock('../components/PityProgressBar', () => ({ PityProgressBar: () => null }));

const navigation = {
  canGoBack: () => false,
  navigate: jest.fn(),
} as unknown as ComponentProps<typeof GachaScreen>['navigation'];
const refetch = jest.fn();
const status = { normalDraws: 7, goldenDraws: 2, normalPity: 1, goldenPity: 0, shards: 13 };

function setQuery(data: typeof status | undefined, isError: boolean) {
  jest.mocked(useGachaStatusQuery).mockReturnValue({
    data,
    isError,
    isPending: false,
    isFetching: false,
    fetchStatus: 'idle',
    refetch,
  } as unknown as ReturnType<typeof useGachaStatusQuery>);
}

function screen() {
  return <GachaScreen navigation={navigation} route={{ key: 'gacha', name: 'Gacha' }} />;
}

describe('GachaScreen query states', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a retry action without balances when the initial read fails', () => {
    setQuery(undefined, true);
    const view = render(screen());
    expect(view.getByText('资产读取失败，请重试')).toBeTruthy();
    expect(view.queryByText('碎片')).toBeNull();
    expect(view.queryByText('券不足')).toBeNull();
    fireEvent.press(view.getByText('重新读取'));
    expect(refetch).toHaveBeenCalledTimes(1);

    setQuery(status, false);
    view.rerender(screen());
    expect(view.queryByText('资产读取失败，请重试')).toBeNull();
    expect(view.getByText('13')).toBeTruthy();
  });

  it('labels cached balances when a refresh fails', () => {
    setQuery(status, true);
    const view = render(screen());
    expect(view.getByText('刷新失败，当前显示上次读取的资产')).toBeTruthy();
    expect(view.getByText('13')).toBeTruthy();
  });

  it('renders a confirmed zero balance without an error', () => {
    setQuery({ ...status, normalDraws: 0, goldenDraws: 0, shards: 0 }, false);
    const view = render(screen());
    expect(view.getByText('碎片')).toBeTruthy();
    expect(view.queryByText('重新读取')).toBeNull();
  });
});
