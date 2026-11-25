import { act, renderHook } from '@testing-library/react';

import { useRoomHandNavigation } from '../useRoomHandNavigation';

type Input = Parameters<typeof useRoomHandNavigation>[0];

const initial: Input = {
  surface: 'hand',
  selection: null,
  hasManual: true,
  hasHost: true,
  groupKey: null,
};

describe('useRoomHandNavigation', () => {
  it.each([
    [
      'host',
      (hand: ReturnType<typeof useRoomHandNavigation>) => hand.openHost(),
      'room-entry:host',
    ],
    [
      'manual',
      (hand: ReturnType<typeof useRoomHandNavigation>) => hand.openManual(),
      'room-entry:manual',
    ],
    [
      'group',
      (hand: ReturnType<typeof useRoomHandNavigation>) => hand.openGroup('night-step'),
      'group:night-step',
    ],
  ] as const)(
    'returns from the %s hand to the main hand and hands seat selection focus back to its entry',
    (_, open, focus) => {
      const groupInput = { ...initial, groupKey: 'night-step' };
      const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
        initialProps: groupInput,
      });
      act(() => open(result.current));
      act(() => result.current.returnToMain());
      expect(result.current.face).toEqual({ kind: 'main' });
      expect(result.current.focus).toBe(focus);
      rerender({ ...groupInput, selection: { escapeCardId: 'selection:cancel' } });
      expect(result.current.focus).toBe('selection:cancel');
      act(() => result.current.clearFocus());
      rerender(groupInput);
      expect(result.current.face).toEqual({ kind: 'main' });
      expect(result.current.focus).toBe(focus);
    },
  );

  it('focuses the escape card of a selection launched from the main hand and returns to its card', () => {
    const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
      initialProps: initial,
    });
    act(() => result.current.launchFrom('action:startSeatSelection'));
    rerender({ ...initial, selection: { escapeCardId: 'action:cancelSeatSelection' } });
    expect(result.current.focus).toBe('action:cancelSeatSelection');
    act(() => result.current.clearFocus());
    rerender(initial);
    expect(result.current.focus).toBe('action:startSeatSelection');
    act(() => result.current.clearFocus());
    rerender({ ...initial, selection: { escapeCardId: null } });
    rerender(initial);
    expect(result.current.focus).toBeNull();
  });

  it('closes the stage menu when a menu action is pressed', () => {
    const { result } = renderHook(() => useRoomHandNavigation({ ...initial, surface: 'menu' }));
    act(() => result.current.openMenu());
    act(() => result.current.openManual());
    act(() => result.current.returnToMain());
    expect(result.current.isMenuOpen).toBe(false);
    expect(result.current.focus).toBe('stage-menu:trigger');
  });

  it('does not reopen an unavailable fixed hand', () => {
    const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
      initialProps: initial,
    });
    act(() => result.current.openManual());
    rerender({ ...initial, hasManual: false });
    expect(result.current.face).toEqual({ kind: 'main' });
    rerender(initial);
    expect(result.current.face).toEqual({ kind: 'main' });
  });

  it('returns from a grouped player hand to its entry and restores focus', () => {
    const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
      initialProps: { ...initial, groupKey: 'night-step' },
    });
    act(() => result.current.openGroup('night-step'));
    expect(result.current.face).toEqual({ kind: 'group', key: 'night-step' });
    expect(result.current.focus).toBe('group:night-step:back');
    act(() => result.current.back());
    expect(result.current.face).toEqual({ kind: 'main' });
    expect(result.current.focus).toBe('group:night-step');
    rerender({ ...initial, groupKey: 'next-night-step' });
    expect(result.current.face).toEqual({ kind: 'main' });
  });

  it('returns from a host sub-hand to its host entry and closes it when unavailable', () => {
    const { result, rerender } = renderHook<ReturnType<typeof useRoomHandNavigation>, Input>(
      (props) => useRoomHandNavigation(props),
      { initialProps: { ...initial, hostGroupKey: 'information' } },
    );
    act(() => result.current.openHost());
    act(() => result.current.openHostGroup('information'));
    expect(result.current.face).toEqual({ kind: 'host-group', key: 'information' });
    expect(result.current.focus).toBe('host-group:information:back');
    act(() => result.current.back());
    expect(result.current.face).toEqual({ kind: 'host' });
    expect(result.current.focus).toBe('host-management:information');
    act(() => result.current.openHostGroup('information'));
    rerender({ ...initial, hostGroupKey: null });
    expect(result.current.face).toEqual({ kind: 'main' });
  });

  it('returns from a menu manual to its entry and then to the menu trigger', () => {
    const { result } = renderHook(() => useRoomHandNavigation({ ...initial, surface: 'menu' }));
    act(() => result.current.openMenu());
    act(() => result.current.openManual());
    expect(result.current.face).toEqual({ kind: 'menu-manual' });
    act(() => result.current.back());
    expect(result.current.face).toEqual({ kind: 'menu' });
    expect(result.current.focus).toBe('stage-menu:manual');
    act(() => result.current.back());
    expect(result.current.isMenuOpen).toBe(false);
    expect(result.current.focus).toBe('stage-menu:trigger');
  });
});
