import { skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { loadErrorMessage } from './loadErrorMessage';

/** One admin report time window, as reported by `TimeRangeSelector`. */
type AdminTimeRange = Readonly<{ from: string; to: string }>;

/**
 * Loads one admin report per selected time range. Each range is its own query, so a slower
 * response for an earlier range is aborted and never overwrites a newer one.
 * `handleRangeChange` feeds `TimeRangeSelector`.
 */
export function useAdminRangeData<T>(
  report: string,
  fetchForRange: (from: string, to: string, signal: AbortSignal) => Promise<T>,
) {
  const [range, setRange] = useState<AdminTimeRange | null>(null);
  const query = useQuery({
    queryKey: ['admin', report, range],
    queryFn:
      range === null ? skipToken : ({ signal }) => fetchForRange(range.from, range.to, signal),
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.isError ? loadErrorMessage(query.error) : null,
    handleRangeChange: setRange,
  };
}
