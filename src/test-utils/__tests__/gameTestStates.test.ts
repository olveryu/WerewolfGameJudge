/** AU-46: every game exposes a build<Game>TestState factory for client tests. */

import { buildAvalonTestState } from '../avalonState';
import { buildDrawGuessTestState } from '../drawguessState';
import { buildFibkingTestState } from '../fibkingState';
import { buildPictionaryTestState } from '../pictionaryState';
import { buildStoryRelayTestState } from '../storyrelayState';
import { buildUndercoverTestState } from '../undercoverState';
import { buildWerewolfTestState } from '../werewolfState';

describe('client test-state factories (AU-46)', () => {
  it('each factory returns its engine initial state for the canonical room', () => {
    expect(buildAvalonTestState().roomCode).toBe('ABCD');
    expect(buildFibkingTestState().roomCode).toBe('ABCD');
    expect(buildUndercoverTestState().roomCode).toBe('ABCD');
    expect(buildPictionaryTestState().roomCode).toBe('ABCD');
    expect(buildStoryRelayTestState().roomCode).toBe('ABCD');
    expect(buildDrawGuessTestState().roomCode).toBe('ABCD');
    expect(buildWerewolfTestState().roomCode).toBe('ABCD');
  });

  it('overrides replace top-level fields', () => {
    expect(buildAvalonTestState({ roomCode: 'WXYZ' }).roomCode).toBe('WXYZ');
    expect(buildDrawGuessTestState({ roomCode: 'WXYZ' }).roomCode).toBe('WXYZ');
    expect(buildUndercoverTestState({ roomCode: 'WXYZ' }).roomCode).toBe('WXYZ');
  });
});
