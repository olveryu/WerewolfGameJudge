/** v1 is the current version: persisted states round-trip unchanged through the migration entry. */

import { spotmatchEngine } from '../engine';
import { migratePersistedSpotmatchState, parseSpotmatchState } from '../state/parseState';
import { DEFAULT_SPOTMATCH_CONFIG } from '../state/types';

describe('Spotmatch persisted state migration', () => {
  it('accepts a current-version lobby state unchanged', () => {
    const state = spotmatchEngine.createInitialState(
      { ...DEFAULT_SPOTMATCH_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const persisted = JSON.parse(JSON.stringify(state)) as unknown;
    expect(parseSpotmatchState(persisted)).toEqual(state);
    expect(migratePersistedSpotmatchState(persisted)).toEqual(state);
  });

  it('rejects a state carrying another game identity', () => {
    const state = spotmatchEngine.createInitialState(
      { ...DEFAULT_SPOTMATCH_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const foreign = { ...(JSON.parse(JSON.stringify(state)) as object), gameType: 'werewolf' };
    expect(() => migratePersistedSpotmatchState(foreign)).toThrow();
  });
});
