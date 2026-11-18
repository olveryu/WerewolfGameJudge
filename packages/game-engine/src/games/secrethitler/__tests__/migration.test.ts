/** v1 is the current version: persisted states round-trip unchanged through the migration entry. */

import { secrethitlerEngine } from '../engine';
import { migratePersistedSecrethitlerState, parseSecrethitlerState } from '../state/parseState';
import { DEFAULT_SECRETHITLER_CONFIG } from '../state/types';

describe('Secrethitler persisted state migration', () => {
  it('accepts a current-version lobby state unchanged', () => {
    const state = secrethitlerEngine.createInitialState(
      { ...DEFAULT_SECRETHITLER_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const persisted = JSON.parse(JSON.stringify(state)) as unknown;
    expect(parseSecrethitlerState(persisted)).toEqual(state);
    expect(migratePersistedSecrethitlerState(persisted)).toEqual(state);
  });

  it('rejects a state carrying another game identity', () => {
    const state = secrethitlerEngine.createInitialState(
      { ...DEFAULT_SECRETHITLER_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const foreign = { ...(JSON.parse(JSON.stringify(state)) as object), gameType: 'werewolf' };
    expect(() => migratePersistedSecrethitlerState(foreign)).toThrow();
  });
});
