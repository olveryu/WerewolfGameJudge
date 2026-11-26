import { act, renderHook, waitFor } from '@testing-library/react';

import { readDecryptoTakeoverView } from '@/games/decrypto/services/decryptoTakeoverView';
import {
  buildDecryptoTestLobby,
  prepareDecryptoTestGame,
  startDecryptoTestGame,
} from '@/test-utils/decryptoState';
import { handleError } from '@/utils/errorPipeline';

import { useDecryptoTakeoverView } from '../hooks/useDecryptoTakeoverView';

vi.mock('@/games/decrypto/services/decryptoTakeoverView', () => ({
  readDecryptoTakeoverView: vi.fn(),
}));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function deferredView() {
  type View = Awaited<ReturnType<typeof readDecryptoTakeoverView>>;
  let resolve: ((view: View) => void) | undefined;
  const promise = new Promise<View>((complete) => {
    resolve = complete;
  });
  return {
    promise,
    resolve: (view: View) => {
      if (resolve === undefined) throw new Error('Missing deferred resolver');
      resolve(view);
    },
  };
}

it('aborts the old seat request and never renders its late private response', async () => {
  const state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
  const first = deferredView();
  const second = deferredView();
  vi.mocked(readDecryptoTakeoverView)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result, rerender } = renderHook<
    ReturnType<typeof useDecryptoTakeoverView>,
    number | null
  >(
    (controlledSeat: number | null) =>
      useDecryptoTakeoverView({ state, revision: 1, roomCode: '1234', controlledSeat }),
    { initialProps: 2 },
  );
  const firstSignal = vi.mocked(readDecryptoTakeoverView).mock.calls[0]?.[2];
  rerender(3);
  expect(firstSignal?.aborted).toBe(true);
  await act(async () => second.resolve({ seat: 3, state }));
  expect(result.current.view).toBe(state);
  await act(async () => first.resolve({ seat: 2, state }));
  expect(result.current.view).toBe(state);
  rerender(null);
  expect(result.current.view).toBeNull();
  expect(result.current.isLoading).toBe(false);
});

it('discards the previous revision while refreshing and waits for a matching authoritative state', async () => {
  const state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
  const next = { ...state, phaseRevision: state.phaseRevision + 1 };
  vi.mocked(readDecryptoTakeoverView)
    .mockResolvedValueOnce({ seat: 2, state })
    .mockResolvedValueOnce({ seat: 2, state: next });
  const { result, rerender } = renderHook(
    ({ revision, currentState }) =>
      useDecryptoTakeoverView({
        state: currentState,
        revision,
        roomCode: '1234',
        controlledSeat: 2,
      }),
    { initialProps: { revision: 1, currentState: state } },
  );
  await waitFor(() => expect(result.current.view).toBe(state));
  rerender({ revision: 2, currentState: next });
  expect(result.current.view).toBeNull();
  expect(result.current.isLoading).toBe(true);
  await waitFor(() => expect(result.current.view).toBe(next));
});

it('reports a private-view read error and lets the user retry instead of using hidden placeholders', async () => {
  const state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
  const error = new Error('unavailable');
  vi.mocked(readDecryptoTakeoverView)
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce({ seat: 2, state });
  const { result } = renderHook(() =>
    useDecryptoTakeoverView({ state, revision: 1, roomCode: '1234', controlledSeat: 2 }),
  );
  await waitFor(() => expect(result.current.hasError).toBe(true));
  expect(result.current.view).toBeNull();
  expect(handleError).toHaveBeenCalledWith(error, expect.objectContaining({ feedback: 'toast' }));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.view).toBe(state));
  expect(result.current.hasError).toBe(false);
});
