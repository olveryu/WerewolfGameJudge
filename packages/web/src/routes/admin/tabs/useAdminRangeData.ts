import { useCallback, useState } from 'react';

import { loadErrorMessage } from './loadErrorMessage';

/**
 * Loads one admin report for each selected time range.
 * `fetchForRange` must be stable (a module function); `handleRangeChange` feeds `TimeRangeSelector`.
 */
export function useAdminRangeData<T>(fetchForRange: (from: string, to: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = useCallback(
    async (range: { from: string; to: string }) => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchForRange(range.from, range.to));
      } catch (cause: unknown) {
        setError(loadErrorMessage(cause));
      } finally {
        setLoading(false);
      }
    },
    [fetchForRange],
  );

  return { data, loading, error, handleRangeChange };
}
