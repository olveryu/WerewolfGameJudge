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
import { useCallback, useState } from 'react';

const noopRefetch = jest.fn().mockResolvedValue({ data: undefined });

type MutationOptions = {
  mutationKey?: readonly unknown[];
  mutationFn?: (args: unknown) => Promise<unknown>;
  onSuccess?: (data: unknown, args: unknown) => void;
  onError?: (error: unknown, args: unknown) => void;
};

interface MutationCallbacks {
  readonly onSuccess?: MutationOptions['onSuccess'];
  readonly onError?: MutationOptions['onError'];
}

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

interface MutationState {
  readonly data: unknown;
  readonly error: unknown;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
}

const IDLE_MUTATION_STATE: MutationState = {
  data: undefined,
  error: null,
  isError: false,
  isPending: false,
  isSuccess: false,
};

function useMutationMock(opts: MutationOptions) {
  const [state, setState] = useState<MutationState>(IDLE_MUTATION_STATE);
  const mutateAsync = useCallback(
    async (args?: unknown, callbacks?: MutationCallbacks): Promise<unknown> => {
      const fn = opts.mutationFn;
      if (fn === undefined) throw new Error('Mocked useMutation requires mutationFn');
      const finish = startMutation(opts.mutationKey ?? []);
      setState({
        data: undefined,
        error: null,
        isError: false,
        isPending: true,
        isSuccess: false,
      });
      try {
        const data = await fn(args);
        opts.onSuccess?.(data, args);
        callbacks?.onSuccess?.(data, args);
        setState({ data, error: null, isError: false, isPending: false, isSuccess: true });
        return data;
      } catch (error) {
        opts.onError?.(error, args);
        callbacks?.onError?.(error, args);
        setState({ data: undefined, error, isError: true, isPending: false, isSuccess: false });
        throw error;
      } finally {
        finish();
      }
    },
    [opts],
  );
  const mutate = useCallback(
    (args?: unknown, callbacks?: MutationCallbacks): void => {
      void mutateAsync(args, callbacks).catch(() => undefined);
    },
    [mutateAsync],
  );
  return { mutate, mutateAsync, ...state };
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
  useMutation: jest.fn().mockImplementation(useMutationMock),
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
  QueryCache: jest.fn().mockImplementation(() => ({})),
  MutationCache: jest.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  queryOptions: (opts: Record<string, unknown>) => opts,
};
