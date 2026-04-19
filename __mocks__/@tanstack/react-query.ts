/**
 * Auto-mock for @tanstack/react-query in Jest tests.
 * Provides stub hooks and a passthrough QueryClientProvider
 * so components can render without a real QueryClient context.
 */
const React = require('react');

const noopRefetch = jest.fn().mockResolvedValue({ data: undefined });
const noopMutate = jest.fn();

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
  useMutation: jest.fn().mockReturnValue({
    mutate: noopMutate,
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
  }),
  useQueryClient: jest.fn().mockReturnValue({
    fetchQuery: jest.fn().mockResolvedValue(undefined),
    invalidateQueries: jest.fn().mockResolvedValue(undefined),
    getQueryData: jest.fn().mockReturnValue(undefined),
    setQueryData: jest.fn(),
  }),
  QueryClient: jest.fn().mockImplementation(() => ({
    mount: jest.fn(),
    unmount: jest.fn(),
    getDefaultOptions: jest.fn().mockReturnValue({}),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  queryOptions: (opts: Record<string, unknown>) => opts,
};
