/**
 * Self-check for the canonical client test-state factory: every state it
 * hands out must survive the engine's own parser (the same codec the
 * worker persists with), so client tests never build impossible states.
 */

import { DEMO_GAME_TYPE, parseDemoState } from '@game-judge/game-engine/games/demo/public';

import { buildDemoTestState } from './buildDemoTestState';

describe('buildDemoTestState', () => {
  it('builds a parseable lobby state for this game', () => {
    const state = buildDemoTestState();
    expect(state.gameType).toBe(DEMO_GAME_TYPE);
    expect(state.phase.kind).toBe('lobby');
    expect(parseDemoState(state)).toEqual(state);
  });

  it('applies overrides on top of the canonical state', () => {
    const state = buildDemoTestState({ hostUserId: 'host-2' });
    expect(state.hostUserId).toBe('host-2');
    expect(parseDemoState(state)).toEqual(state);
  });
});
