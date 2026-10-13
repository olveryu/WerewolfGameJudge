/** AU-46: every game exposes a build<Game>TestState factory for client tests. */

import { AVALON_STATE_VERSION } from '@game-judge/game-engine/games/avalon/public';
import { DRAWGUESS_STATE_VERSION } from '@game-judge/game-engine/games/drawguess/public';
import { FIB_STATE_VERSION } from '@game-judge/game-engine/games/fibking/public';
import { PICTIONARY_STATE_VERSION } from '@game-judge/game-engine/games/pictionary/public';
import { STORY_RELAY_STATE_VERSION } from '@game-judge/game-engine/games/storyrelay/public';
import { UNDERCOVER_STATE_VERSION } from '@game-judge/game-engine/games/undercover/public';
import { WEREWOLF_STATE_VERSION } from '@game-judge/game-engine/games/werewolf/public';

import { buildAvalonTestState } from '../avalonState';
import { buildDrawGuessTestState } from '../drawguessState';
import { buildFibkingTestState } from '../fibkingState';
import { buildPictionaryTestState } from '../pictionaryState';
import { buildStoryRelayTestState } from '../storyrelayState';
import { buildUndercoverTestState } from '../undercoverState';
import { buildWerewolfTestState } from '../werewolfState';

describe('client test-state factories (AU-46)', () => {
  it('each factory returns its own game identity and version', () => {
    expect(buildAvalonTestState()).toMatchObject({
      gameType: 'avalon',
      stateVersion: AVALON_STATE_VERSION,
    });
    expect(buildFibkingTestState()).toMatchObject({
      gameType: 'fibking',
      stateVersion: FIB_STATE_VERSION,
    });
    expect(buildUndercoverTestState()).toMatchObject({
      gameType: 'undercover',
      stateVersion: UNDERCOVER_STATE_VERSION,
    });
    expect(buildPictionaryTestState()).toMatchObject({
      gameType: 'pictionary',
      stateVersion: PICTIONARY_STATE_VERSION,
    });
    expect(buildStoryRelayTestState()).toMatchObject({
      gameType: 'storyrelay',
      stateVersion: STORY_RELAY_STATE_VERSION,
    });
    expect(buildDrawGuessTestState()).toMatchObject({
      gameType: 'drawguess',
      stateVersion: DRAWGUESS_STATE_VERSION,
    });
    expect(buildWerewolfTestState()).toMatchObject({
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
    });
  });

  it('every factory builds the canonical room and honors overrides', () => {
    const factories = [
      buildAvalonTestState,
      buildFibkingTestState,
      buildUndercoverTestState,
      buildPictionaryTestState,
      buildStoryRelayTestState,
      buildDrawGuessTestState,
      buildWerewolfTestState,
    ];
    for (const build of factories) {
      expect(build().roomCode).toBe('ABCD');
      expect(build({ roomCode: 'WXYZ' }).roomCode).toBe('WXYZ');
    }
  });
});
