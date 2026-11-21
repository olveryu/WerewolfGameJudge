import { useEffect, useRef, useState } from 'react';

import type { RoomHandFace, RoomSelectionMode } from '../model/RoomHand';

type HandFace = 'main' | 'manual' | 'host' | { readonly kind: 'group'; readonly key: string };
type MenuFace = 'closed' | 'menu' | 'menu-manual';

interface NavigationState {
  readonly hand: HandFace;
  readonly menu: MenuFace;
  readonly focus: string | null;
}

/**
 * Keeps hand and menu navigation in one place. Seat selection temporarily
 * projects the main hand without changing the remembered hand.
 */
export function useRoomHandNavigation(input: {
  readonly surface: 'hand' | 'menu' | 'hidden';
  readonly selectionMode: RoomSelectionMode | undefined;
  readonly hasManual: boolean;
  readonly hasHost: boolean;
  readonly groupKey: string | null;
}) {
  const [state, setState] = useState<NavigationState>({
    hand: 'main',
    menu: 'closed',
    focus: null,
  });
  const previousSelectionMode = useRef(input.selectionMode);
  useEffect(() => {
    const groupHand = state.hand;
    if (
      previousSelectionMode.current !== undefined &&
      input.selectionMode === undefined &&
      typeof groupHand === 'object' &&
      groupHand.key === input.groupKey
    ) {
      setState((current) => ({ ...current, focus: `group:${groupHand.key}:back` }));
    }
    previousSelectionMode.current = input.selectionMode;
  }, [input.groupKey, input.selectionMode, state.hand]);
  let hand = state.hand;
  let menu = state.menu;
  if (input.surface !== 'hand' && (hand === 'manual' || hand === 'host')) {
    hand = 'main';
  }
  if (
    input.selectionMode === undefined &&
    ((hand === 'manual' && !input.hasManual) || (hand === 'host' && !input.hasHost))
  ) {
    hand = 'main';
  }
  if (input.surface !== 'menu') menu = 'closed';
  if (hand !== state.hand || menu !== state.menu) {
    setState({ hand, menu, focus: null });
  }

  const face: RoomHandFace =
    input.surface === 'menu' && menu !== 'closed'
      ? { kind: menu }
      : input.selectionMode !== undefined
        ? { kind: 'main' }
        : typeof hand === 'object' && hand.key !== input.groupKey
          ? { kind: 'main' }
          : typeof hand === 'object'
            ? hand
            : { kind: hand };

  const openManual = () => {
    setState((current) =>
      input.surface === 'menu'
        ? { ...current, menu: 'menu-manual', focus: 'stage-menu:back' }
        : { ...current, hand: 'manual', focus: 'manual:back' },
    );
  };
  const openHost = () => {
    setState((current) => ({ ...current, hand: 'host', focus: 'host-management:back' }));
  };
  const openGroup = (key: string) => {
    setState((current) => ({
      ...current,
      hand: { kind: 'group', key },
      focus: `group:${key}:back`,
    }));
  };
  const openMenu = () => {
    setState((current) => ({ ...current, menu: 'menu', focus: 'stage-menu:back' }));
  };
  const back = () => {
    setState((current) => {
      if (current.menu === 'menu-manual') {
        return { ...current, menu: 'menu', focus: 'stage-menu:manual' };
      }
      if (current.menu === 'menu') {
        return { ...current, menu: 'closed', focus: 'stage-menu:trigger' };
      }
      if (current.hand === 'manual') {
        return { ...current, hand: 'main', focus: 'room-entry:manual' };
      }
      if (current.hand === 'host') {
        return { ...current, hand: 'main', focus: 'room-entry:host' };
      }
      if (typeof current.hand === 'object') {
        return { ...current, hand: 'main', focus: `group:${current.hand.key}` };
      }
      throw new Error('Cannot return from the main room hand');
    });
  };
  const clearFocus = () =>
    setState((current) => (current.focus === null ? current : { ...current, focus: null }));

  return {
    face,
    isMenuOpen: menu !== 'closed',
    focus: state.focus,
    openManual,
    openHost,
    openGroup,
    openMenu,
    back,
    clearFocus,
  };
}
