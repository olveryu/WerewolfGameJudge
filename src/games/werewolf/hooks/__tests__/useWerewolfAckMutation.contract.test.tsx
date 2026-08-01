/**
 * @jest-environment jsdom
 *
 * Contract test — verifies the options shape we pass to TanStack's useMutation.
 * Mutation lifecycle (isPending, retry, useIsMutating aggregation) is TanStack's
 * concern; integration is exercised in policy + e2e tests downstream.
 */
import { useMutation } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';

import { useWerewolfAckMutation } from '@/games/werewolf/hooks/useWerewolfAckMutation';

const mockedUseMutation = useMutation as jest.MockedFunction<typeof useMutation>;

describe('useWerewolfAckMutation contract', () => {
  beforeEach(() => {
    mockedUseMutation.mockClear();
  });

  it('registers mutationKey ["ack", name]', () => {
    renderHook(() => useWerewolfAckMutation('reveal', () => Promise.resolve(undefined)));
    expect(mockedUseMutation.mock.calls[0]?.[0]?.mutationKey).toEqual(['ack', 'reveal']);
  });

  it('disables auto-retry (retry: 0) so UI controls re-show on failure', () => {
    renderHook(() => useWerewolfAckMutation('hunterStatus', () => Promise.resolve(undefined)));
    expect(mockedUseMutation.mock.calls[0]?.[0]?.retry).toBe(0);
  });

  it('forwards mutationFn unchanged', () => {
    const fn = jest.fn().mockResolvedValue({ success: true });
    renderHook(() => useWerewolfAckMutation('groupConfirm', fn));
    expect(mockedUseMutation.mock.calls[0]?.[0]?.mutationFn).toBe(fn);
  });

  it('forwards onSuccess callback', () => {
    const onSuccess = jest.fn();
    renderHook(() =>
      useWerewolfAckMutation('reveal', () => Promise.resolve(undefined), { onSuccess }),
    );
    expect(mockedUseMutation.mock.calls[0]?.[0]?.onSuccess).toBe(onSuccess);
  });

  it('forwards onError callback', () => {
    const onError = jest.fn();
    renderHook(() =>
      useWerewolfAckMutation('reveal', () => Promise.resolve(undefined), { onError }),
    );
    expect(mockedUseMutation.mock.calls[0]?.[0]?.onError).toBe(onError);
  });

  it.each(['reveal', 'hunterStatus', 'groupConfirm'] as const)('accepts ack name "%s"', (name) => {
    renderHook(() => useWerewolfAckMutation(name, () => Promise.resolve(undefined)));
    expect(mockedUseMutation.mock.calls[0]?.[0]?.mutationKey).toEqual(['ack', name]);
  });
});
