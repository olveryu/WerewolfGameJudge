import { act, renderHook } from '@testing-library/react';

import { alertStore, dismissAlert, showAlertWithGeneration } from '@/utils/alert';

import { useScopedAlert } from '../useScopedAlert';

describe('useScopedAlert', () => {
  afterEach(() => {
    const alert = alertStore.getSnapshot();
    if (alert !== null) dismissAlert(alert.generation);
  });

  it('dismisses and reports the visible alert when its owning identity changes', () => {
    const onStale = vi.fn();
    const { result, rerender } = renderHook(({ identity }) => useScopedAlert(identity, onStale), {
      initialProps: { identity: 'night:1' },
    });

    const generation = showAlertWithGeneration('Old action');
    if (generation === null) throw new Error('Expected the tracked alert');
    act(() => result.current(generation));
    rerender({ identity: 'night:2' });

    expect(alertStore.getSnapshot()).toBeNull();
    expect(onStale).toHaveBeenCalledOnce();
    expect(onStale).toHaveBeenCalledWith(generation);
  });

  it('leaves a replacement alert intact without reporting the old one as visible', () => {
    const onStale = vi.fn();
    const { result, rerender } = renderHook(({ identity }) => useScopedAlert(identity, onStale), {
      initialProps: { identity: 'night:1' },
    });

    const generation = showAlertWithGeneration('Old action');
    if (generation === null) throw new Error('Expected the tracked alert');
    act(() => result.current(generation));
    const replacement = showAlertWithGeneration('New message');
    rerender({ identity: 'night:2' });

    expect(alertStore.getSnapshot()?.generation).toBe(replacement);
    expect(onStale).not.toHaveBeenCalled();
  });

  it('uses the latest stale callback when the identity and callback change together', () => {
    const previous = vi.fn();
    const latest = vi.fn();
    const { result, rerender } = renderHook(
      ({ identity, onStale }) => useScopedAlert(identity, onStale),
      { initialProps: { identity: 'night:1', onStale: previous } },
    );
    const generation = showAlertWithGeneration('Old action');
    if (generation === null) throw new Error('Expected the tracked alert');
    act(() => result.current(generation));

    rerender({ identity: 'night:2', onStale: latest });

    expect(previous).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(generation);
  });

  it('only dismisses the most recently tracked alert', () => {
    const { result, rerender } = renderHook(({ identity }) => useScopedAlert(identity), {
      initialProps: { identity: 'night:1' },
    });

    act(() => {
      result.current(showAlertWithGeneration('First action'));
      result.current(showAlertWithGeneration('Second action'));
    });
    rerender({ identity: 'night:2' });

    expect(alertStore.getSnapshot()).toBeNull();
  });
});
