/** Result access does not require a machine completion callback. */
import { act, renderHook } from '@testing-library/react-native';

import type { DrawResultItem } from '@/features/gacha/services/gachaApi';

import { useDrawPresentation } from '../useDrawPresentation';

const results = [{ itemId: 'reward', rarity: 'rare' }] as unknown as DrawResultItem[];

it('opens confirmed results without completion and can reopen after dismissal', () => {
  const cancel = jest.fn();
  const { result } = renderHook(() => useDrawPresentation(true, cancel));
  act(() => {
    result.current.begin();
    result.current.accept(results);
  });
  expect(result.current.presentation.phase).toBe('animating');
  act(() => result.current.showResults());
  expect(result.current.presentation).toEqual({ phase: 'results', results });
  act(() => result.current.dismiss());
  act(() => result.current.showResults());
  expect(result.current.presentation).toEqual({ phase: 'results', results });
});

it('shows confirmed results when backgrounded or animation is disabled', () => {
  const cancel = jest.fn();
  const { result, rerender } = renderHook(
    ({ shouldAnimate }: { shouldAnimate: boolean }) => useDrawPresentation(shouldAnimate, cancel),
    { initialProps: { shouldAnimate: true } },
  );
  act(() => result.current.accept(results));
  rerender({ shouldAnimate: false });
  expect(result.current.presentation.phase).toBe('results');
  act(() => {
    result.current.begin();
    result.current.accept(results);
  });
  expect(result.current.presentation.phase).toBe('results');
});

it('uses current visibility when an earlier request completes in the background', () => {
  const cancel = jest.fn();
  const { result, rerender } = renderHook(
    ({ shouldAnimate }: { shouldAnimate: boolean }) => useDrawPresentation(shouldAnimate, cancel),
    { initialProps: { shouldAnimate: true } },
  );
  const accept = result.current.accept;
  act(() => result.current.begin());
  rerender({ shouldAnimate: false });
  act(() => accept(results));
  expect(result.current.presentation).toEqual({ phase: 'results', results });
});
