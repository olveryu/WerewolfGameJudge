/**
 * Hand-built Werewolf view-model fragments for tests that mock the projection.
 *
 * Boundary: these are shape helpers only — every field defaults to the
 * "nothing to see" value. Tests that need rule facts (actioner, pack, reveal)
 * must build a real GameState and call getWerewolfViewModel instead.
 */

import type {
  WerewolfNightView,
  WerewolfSeatView,
} from '@game-judge/game-engine/games/werewolf/public';

export function emptyWerewolfNight(overrides: Partial<WerewolfNightView> = {}): WerewolfNightView {
  return {
    actionSchema: null,
    currentActionRole: null,
    isActioner: false,
    confirmStatus: null,
    reveals: [],
    wolfVote: null,
    pendingReveal: null,
    rejection: null,
    witchContext: null,
    wolfRobot: null,
    chooseCard: null,
    actorHint: null,
    ...overrides,
  };
}

export function werewolfSeatView(
  seat: number,
  overrides: Partial<Omit<WerewolfSeatView, 'seat'>> = {},
): WerewolfSeatView {
  return {
    seat,
    displayName: `P${seat}`,
    isBot: false,
    visibleRole: null,
    isWolfPackPeer: false,
    hasViewedRole: false,
    disabledReason: null,
    ...overrides,
  };
}
