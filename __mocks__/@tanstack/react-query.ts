/**
 * Auto-mock for @tanstack/react-query in Jest tests.
 *
 * useMutation: returns a thin observer where mutate(args, callbacks) actually
 * invokes the registered mutationFn and forwards onSuccess/onError. Faithful
 * enough that protocol-layer ack flows (useAckMutation) exercise the full
 * mutationFn → callback chain in tests, without spinning up a real
 * QueryClient / observer.
 *
 * useIsMutating: tracks active in-flight mutations via a module-level counter,
 * mirroring the real lib's filter-by-mutationKey aggregation.
 */
import type React from 'react';

const noopRefetch = jest.fn().mockResolvedValue({ data: undefined });

type MutationOptions = {
  mutationKey?: readonly unknown[];
  mutationFn?: (args: unknown) => Promise<unknown>;
  onSuccess?: (data: unknown, args: unknown) => void;
  onError?: (error: unknown, args: unknown) => void;
};

interface MutationRecord {
  key: readonly unknown[];
  pending: number;
}

const inflight: MutationRecord[] = [];

function startMutation(key: readonly unknown[]): () => void {
  let record = inflight.find((r) => keysEqual(r.key, key));
  if (!record) {
    record = { key, pending: 0 };
    inflight.push(record);
  }
  record.pending++;
  return () => {
    record.pending--;
    if (record.pending <= 0) {
      const idx = inflight.indexOf(record);
      if (idx >= 0) inflight.splice(idx, 1);
    }
  };
}

function keysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length > b.length) return false;
  // partial-prefix match (mirrors TanStack default exact: false behavior for filter)
  return a.every((seg, i) => seg === b[i]);
}

function buildMutate(opts: MutationOptions) {
  return jest.fn(
    (
      args?: unknown,
      callbacks?: { onSuccess?: typeof opts.onSuccess; onError?: typeof opts.onError },
    ) => {
      const finish = startMutation(opts.mutationKey ?? []);
      const fn = opts.mutationFn;
      if (!fn) {
        finish();
        return;
      }
      void Promise.resolve(fn(args)).then(
        (data) => {
          opts.onSuccess?.(data, args);
          callbacks?.onSuccess?.(data, args);
          finish();
        },
        (err) => {
          opts.onError?.(err, args);
          callbacks?.onError?.(err, args);
          finish();
        },
      );
    },
  );
}

module.exports = {
  useQuery: jest.fn().mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    isPending: true,
    isError: false,
    isSuccess: false,
    isFetching: false,
    refetch: noopRefetch,
  }),
  useMutation: jest.fn().mockImplementation((opts: MutationOptions) => {
    const mutate = buildMutate(opts);
    return {
      mutate,
      mutateAsync: mutate,
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
    };
  }),
  useIsMutating: jest.fn().mockImplementation((filter?: { mutationKey?: readonly unknown[] }) => {
    const filterKey = filter?.mutationKey;
    if (!filterKey) return inflight.reduce((sum, r) => sum + r.pending, 0);
    return inflight
      .filter((r) => keysEqual(filterKey, r.key))
      .reduce((sum, r) => sum + r.pending, 0);
  }),
  useQueryClient: jest.fn().mockReturnValue({
    fetchQuery: jest.fn().mockResolvedValue(undefined),
    ensureQueryData: jest.fn().mockResolvedValue(undefined),
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    getQueryData: jest.fn().mockReturnValue(undefined),
    setQueryData: jest.fn(),
  }),
  QueryClient: jest.fn().mockImplementation(() => ({
    mount: jest.fn(),
    unmount: jest.fn(),
    getDefaultOptions: jest.fn().mockReturnValue({}),
    prefetchQuery: jest.fn().mockResolvedValue(undefined),
  })),
  MutationCache: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  queryOptions: (opts: Record<string, unknown>) => opts,
};
