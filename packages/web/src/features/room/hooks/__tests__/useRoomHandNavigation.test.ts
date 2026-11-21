import { act, renderHook } from '@testing-library/react';

import type { RoomSelectionMode } from '../../model/RoomHand';
import { useRoomHandNavigation } from '../useRoomHandNavigation';

type Input = Parameters<typeof useRoomHandNavigation>[0];

const initial: Input = {
  surface: 'hand',
  selectionMode: undefined,
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
    'returns from the %s hand to the main hand when an action is pressed',
    (_, open, focus) => {
      const groupInput = { ...initial, groupKey: 'night-step' };
      const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
        initialProps: groupInput,
      });
      act(() => open(result.current));
      act(() => result.current.returnToMain());
      expect(result.current.face).toEqual({ kind: 'main' });
      expect(result.current.focus).toBe(focus);
      rerender({ ...groupInput, selectionMode: 'host-task' satisfies RoomSelectionMode });
      rerender(groupInput);
      expect(result.current.face).toEqual({ kind: 'main' });
    },
  );

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
