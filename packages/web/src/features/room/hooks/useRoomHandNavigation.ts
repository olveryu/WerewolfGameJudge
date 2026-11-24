import { useState } from 'react';

import type { RoomHandFace } from '../model/RoomHand';

type HandFace =
  | 'main'
  | 'manual'
  | 'host'
  | { readonly kind: 'group'; readonly key: string }
  | { readonly kind: 'host-group'; readonly key: string };
type MenuFace = 'closed' | 'menu' | 'menu-manual';

interface NavigationState {
  readonly hand: HandFace;
  readonly menu: MenuFace;
  readonly focus: string | null;
  /** The main-hand card the latest action was launched from. */
  readonly launchedFrom: string | null;
  /** While seat selection replaces the hand: the entry that takes focus when it ends. */
  readonly selection: { readonly returnFocus: string | null } | null;
}

/** Seat selection currently projected over the main hand. */
export interface RoomHandSelection {
  /** The card that leaves selection; null when the selection offers none. */
  readonly escapeCardId: string | null;
}

/** The main-hand state with focus on the entry card that opened the current face. */
function mainHandState(current: NavigationState): NavigationState {
  if (current.menu !== 'closed') {
    return { ...current, menu: 'closed', focus: 'stage-menu:trigger' };
  }
  const focus =
    current.hand === 'manual'
      ? 'room-entry:manual'
      : current.hand === 'host'
        ? 'room-entry:host'
        : typeof current.hand === 'object' && current.hand.kind === 'host-group'
          ? 'room-entry:host'
          : typeof current.hand === 'object'
            ? `group:${current.hand.key}`
            : null;
  return { ...current, hand: 'main', menu: 'closed', focus };
}

/**
 * Keeps hand and menu navigation in one place. Every action pressed on a
 * sub-hand or the stage menu returns to the main hand at once. Seat selection
 * projects the main hand without changing the remembered hand; it takes focus
 * on its escape card and hands it back to the entry it was launched from.
 */
export function useRoomHandNavigation(input: {
  readonly surface: 'hand' | 'menu' | 'hidden';
  readonly selection: RoomHandSelection | null;
  readonly hasManual: boolean;
  readonly hasHost: boolean;
  readonly groupKey: string | null;
  readonly hostGroupKey?: string | null;
}) {
  const [state, setState] = useState<NavigationState>({
    hand: 'main',
    menu: 'closed',
    focus: null,
    launchedFrom: null,
    selection: null,
  });
  let hand = state.hand;
  let menu = state.menu;
  if (input.surface !== 'hand' && (hand === 'manual' || hand === 'host')) {
    hand = 'main';
  }
  if (
    input.selection === null &&
    ((hand === 'manual' && !input.hasManual) || (hand === 'host' && !input.hasHost))
  ) {
    hand = 'main';
  }
  if (
    typeof hand === 'object' &&
    hand.kind === 'host-group' &&
    (input.surface !== 'hand' || !input.hasHost || hand.key !== input.hostGroupKey)
  ) {
    hand = 'main';
  }
  if (input.surface !== 'menu') menu = 'closed';
  let next = state;
  if (hand !== state.hand || menu !== state.menu) {
    next = { ...next, hand, menu, focus: null };
  }
  if (input.selection !== null && next.selection === null) {
    next = {
      ...next,
      focus: input.selection.escapeCardId,
      launchedFrom: null,
      selection: { returnFocus: next.launchedFrom },
    };
  } else if (input.selection === null && next.selection !== null) {
    next = { ...next, focus: next.selection.returnFocus, selection: null };
  }
  if (next !== state) setState(next);

  const face: RoomHandFace =
    input.surface === 'menu' && menu !== 'closed'
      ? { kind: menu }
      : input.selection !== null
        ? { kind: 'main' }
        : typeof hand === 'object' && hand.kind === 'group' && hand.key !== input.groupKey
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
    setState((current) => ({
      ...current,
      hand: 'host',
      focus: 'host-management:back',
    }));
  };
  const openHostGroup = (key: string) => {
    setState((current) => ({
      ...current,
      hand: { kind: 'host-group', key },
      focus: `host-group:${key}:back`,
    }));
  };
  const openGroup = (key: string) => {
    setState((current) => ({
      ...current,
      hand: { kind: 'group', key },
      focus: `group:${key}:back`,
    }));
  };
  const openMenu = () => {
    setState((current) => ({
      ...current,
      menu: 'menu',
      focus: 'stage-menu:back',
    }));
  };
  const back = () => {
    setState((current) => {
      if (current.menu === 'menu-manual') {
        return { ...current, menu: 'menu', focus: 'stage-menu:manual' };
      }
      if (typeof current.hand === 'object' && current.hand.kind === 'host-group') {
        return {
          ...current,
          hand: 'host',
          focus: `host-management:${current.hand.key}`,
        };
      }
      if (current.menu === 'closed' && current.hand === 'main') {
        throw new Error('Cannot return from the main room hand');
      }
      return mainHandState(current);
    });
  };
  /** Called when an action on a sub-hand or the stage menu is pressed. */
  const returnToMain = () =>
    setState((current) => {
      const next = mainHandState(current);
      return { ...next, launchedFrom: next.focus };
    });
  /** Called when a main-hand card is pressed, so a selection it starts can return here. */
  const launchFrom = (cardId: string) =>
    setState((current) =>
      current.launchedFrom === cardId ? current : { ...current, launchedFrom: cardId },
    );
  const clearFocus = () =>
    setState((current) => (current.focus === null ? current : { ...current, focus: null }));

  return {
    face,
    isMenuOpen: menu !== 'closed',
    focus: state.focus,
    openManual,
    openHost,
    openHostGroup,
    openGroup,
    openMenu,
    back,
    returnToMain,
    launchFrom,
    clearFocus,
  };
}
