/**
 * useRoleViewing: first view submits, opens only on confirmation with
 * reveal facts frozen from the pre-confirm record; a rejection opens
 * nothing; an already-viewed seat opens immediately without animation;
 * a seat change closes the card.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useRoleViewing } from '../useRoleViewing';

interface Props {
  effectiveSeat: number | null;
  hasViewed: boolean;
  viewedSeatCount: number;
  submitViewed: () => Promise<boolean>;
}

function renderViewing(initial: Props) {
  return renderHook((props: Props) => useRoleViewing({ ...props, occupiedSeatCount: 6 }), {
    initialProps: initial,
  });
}

describe('useRoleViewing', () => {
  it('opens after confirmation with the pre-confirm reveal facts frozen', async () => {
    let confirm!: (value: boolean) => void;
    const submitViewed = jest.fn(() => new Promise<boolean>((resolve) => (confirm = resolve)));
    const { result, rerender } = renderViewing({
      effectiveSeat: 2,
      hasViewed: false,
      viewedSeatCount: 2,
      submitViewed,
    });

    act(() => result.current.open());
    expect(result.current.isPending).toBe(true);
    expect(result.current.isOpen).toBe(false);
    expect(submitViewed).toHaveBeenCalledTimes(1);

    // The record lands underneath (this seat now counted) before the card opens.
    rerender({ effectiveSeat: 2, hasViewed: true, viewedSeatCount: 3, submitViewed });
    await act(async () => confirm(true));
    expect(result.current.isPending).toBe(false);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.shouldPlayAnimation).toBe(true);
    expect(result.current.remainingCards).toBe(4);
  });

  it('opens nothing when the submit is rejected', async () => {
    const submitViewed = jest.fn(async () => false);
    const { result } = renderViewing({
      effectiveSeat: 2,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed,
    });
    await act(async () => result.current.open());
    expect(result.current.isPending).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('opens an already-viewed seat immediately without a submit or animation', () => {
    const submitViewed = jest.fn(async () => true);
    const { result } = renderViewing({
      effectiveSeat: 2,
      hasViewed: true,
      viewedSeatCount: 5,
      submitViewed,
    });
    act(() => result.current.open());
    expect(submitViewed).not.toHaveBeenCalled();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.shouldPlayAnimation).toBe(false);
    expect(result.current.remainingCards).toBe(1);
  });

  it('closes on an effective seat change and ignores a late confirmation', async () => {
    let confirm!: (value: boolean) => void;
    const submitViewed = jest.fn(() => new Promise<boolean>((resolve) => (confirm = resolve)));
    const { result, rerender } = renderViewing({
      effectiveSeat: 2,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed,
    });
    act(() => result.current.open());
    rerender({ effectiveSeat: 4, hasViewed: false, viewedSeatCount: 0, submitViewed });
    expect(result.current.isPending).toBe(false);
    await act(async () => confirm(true));
    expect(result.current.isOpen).toBe(false);
  });

  it('fails fast without an effective seat or when already open', () => {
    const submitViewed = jest.fn(async () => true);
    const unseated = renderViewing({
      effectiveSeat: null,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed,
    });
    expect(() => unseated.result.current.open()).toThrow(
      '[FAIL-FAST] Role viewing opened without an effective seat',
    );

    const viewed = renderViewing({
      effectiveSeat: 1,
      hasViewed: true,
      viewedSeatCount: 1,
      submitViewed,
    });
    act(() => viewed.result.current.open());
    expect(() => viewed.result.current.open()).toThrow(
      '[FAIL-FAST] Role viewing opened while already open or pending',
    );
  });
});
