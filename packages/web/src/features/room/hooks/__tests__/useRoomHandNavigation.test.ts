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
  it('restores the originating host hand after seat selection', () => {
    const { result, rerender } = renderHook((props: Input) => useRoomHandNavigation(props), {
      initialProps: initial,
    });
    act(() => result.current.openHost());
    expect(result.current.face).toEqual({ kind: 'host' });
    expect(result.current.focus).toBe('host-management:back');
    rerender({ ...initial, selectionMode: 'host-task' satisfies RoomSelectionMode });
    expect(result.current.face).toEqual({ kind: 'main' });
    rerender(initial);
    expect(result.current.face).toEqual({ kind: 'host' });
    act(() => result.current.back());
    expect(result.current.focus).toBe('room-entry:host');
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
