import { act, renderHook } from '@testing-library/react';

import { alertStore, dismissAlert } from '@/utils/alert';

import { useRoleViewing } from '../useRoleViewing';

interface Props {
  effectiveSeat: number | null;
  identityKey: string | number | null;
  hasViewed: boolean;
  viewedSeatCount: number;
  submitViewed: () => Promise<boolean>;
}

function renderViewing(initial: Props) {
  return renderHook((props: Props) => useRoleViewing({ ...props, occupiedSeatCount: 6 }), {
    initialProps: initial,
  });
}

async function chooseView() {
  const alert = alertStore.getSnapshot();
  const view = alert?.buttons[1]?.onPress;
  if (alert === null || view === undefined) throw new Error('Missing identity view prompt');
  await act(async () => view());
  act(() => dismissAlert(alert.generation));
}

afterEach(() => {
  const alert = alertStore.getSnapshot();
  if (alert !== null) dismissAlert(alert.generation);
});

describe('useRoleViewing', () => {
  it('does not disclose or submit on cancellation, and records the first view only after acknowledgement', async () => {
    let resolveViewed: (value: boolean) => void = () => undefined;
    const submitViewed = vi.fn(() => new Promise<boolean>((resolve) => (resolveViewed = resolve)));
    const { result } = renderViewing({
      effectiveSeat: 2,
      identityKey: 1,
      hasViewed: false,
      viewedSeatCount: 2,
      submitViewed,
    });
    act(() => result.current.open());
    const alert = alertStore.getSnapshot();
    expect(alert?.buttons.map((button) => button.text)).toEqual(['取消', '查看']);
    if (alert === null) throw new Error('Missing identity prompt');
    act(() => dismissAlert(alert.generation));
    expect(result.current.isOpen).toBe(false);
    expect(submitViewed).not.toHaveBeenCalled();

    act(() => result.current.open());
    await chooseView();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.shouldPlayAnimation).toBe(true);
    expect(result.current.remainingCards).toBe(4);
    expect(submitViewed).not.toHaveBeenCalled();
    act(() => result.current.close());
    expect(result.current.isPending).toBe(true);
    expect(submitViewed).toHaveBeenCalledTimes(1);
    await act(async () => resolveViewed(true));
    expect(result.current.isOpen).toBe(false);
  });

  it('keeps the card open when acknowledgement fails', async () => {
    const submitViewed = vi.fn(async () => false);
    const { result } = renderViewing({
      effectiveSeat: 2,
      identityKey: 1,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed,
    });
    act(() => result.current.open());
    await chooseView();
    await act(async () => result.current.close());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('asks before a repeat view and closes without another submission', async () => {
    const submitViewed = vi.fn(async () => true);
    const { result } = renderViewing({
      effectiveSeat: 2,
      identityKey: 1,
      hasViewed: true,
      viewedSeatCount: 5,
      submitViewed,
    });
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(false);
    await chooseView();
    expect(result.current.shouldPlayAnimation).toBe(false);
    expect(result.current.remainingCards).toBe(1);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(submitViewed).not.toHaveBeenCalled();
  });

  it('does not reveal a stale card after the seat or deal changes', async () => {
    const submitViewed = vi.fn(async () => true);
    const props = {
      effectiveSeat: 2,
      identityKey: 1,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed,
    };
    const { result, rerender } = renderViewing(props);
    act(() => result.current.open());
    rerender({ ...props, effectiveSeat: 4 });
    await chooseView();
    expect(result.current.isOpen).toBe(false);
    expect(submitViewed).not.toHaveBeenCalled();
  });

  it('fails fast without a seat or a deal', () => {
    const props = {
      effectiveSeat: null,
      identityKey: 1,
      hasViewed: false,
      viewedSeatCount: 0,
      submitViewed: vi.fn(async () => true),
    };
    const { result, rerender } = renderViewing(props);
    expect(() => result.current.open()).toThrow('without an effective seat');
    rerender({ ...props, effectiveSeat: 1, identityKey: null });
    expect(() => result.current.open()).toThrow('without a viewable identity');
  });
});
