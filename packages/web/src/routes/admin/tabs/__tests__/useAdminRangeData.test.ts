/** Admin range reports: a late response for an earlier range never replaces the newer one. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { useAdminRangeData } from '../useAdminRangeData';

function renderRangeData(
  fetchForRange: (from: string, to: string, signal: AbortSignal) => Promise<string>,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(() => useAdminRangeData('report', fetchForRange), {
    wrapper: ({ children }: { readonly children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
}

it('aborts the earlier range and keeps the newer report when the earlier one lands late', async () => {
  let resolveFirst: (report: string) => void = () => undefined;
  const fetchForRange = vi
    .fn<(from: string, to: string, signal: AbortSignal) => Promise<string>>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockResolvedValueOnce('second');
  const { result } = renderRangeData(fetchForRange);
  expect(result.current.loading).toBe(true);

  act(() => result.current.handleRangeChange({ from: 'a', to: 'b' }));
  act(() => result.current.handleRangeChange({ from: 'c', to: 'd' }));
  await waitFor(() => expect(result.current.data).toBe('second'));
  expect(fetchForRange.mock.calls[0]?.[2].aborted).toBe(true);

  await act(async () => resolveFirst('first'));
  expect(result.current.data).toBe('second');
  expect(result.current.error).toBeNull();
});

it('reports a failed range as an error message, not as stale data', async () => {
  const fetchForRange = vi
    .fn<(from: string, to: string, signal: AbortSignal) => Promise<string>>()
    .mockResolvedValueOnce('first')
    .mockRejectedValueOnce(new Error('ADMIN_NOT_AUTHENTICATED'));
  const { result } = renderRangeData(fetchForRange);

  act(() => result.current.handleRangeChange({ from: 'a', to: 'b' }));
  await waitFor(() => expect(result.current.data).toBe('first'));
  act(() => result.current.handleRangeChange({ from: 'c', to: 'd' }));

  await waitFor(() => expect(result.current.error).toBe('ADMIN_NOT_AUTHENTICATED'));
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
});
