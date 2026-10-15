/** v1 is the current version: persisted states round-trip unchanged through the migration entry. */

import { demoEngine } from '../engine';
import { migratePersistedDemoState, parseDemoState } from '../state/parseState';
import { DEFAULT_DEMO_CONFIG } from '../state/types';

describe('Demo persisted state migration', () => {
  it('accepts a current-version lobby state unchanged', () => {
    const state = demoEngine.createInitialState(
      { ...DEFAULT_DEMO_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const persisted = JSON.parse(JSON.stringify(state)) as unknown;
    expect(parseDemoState(persisted)).toEqual(state);
    expect(migratePersistedDemoState(persisted)).toEqual(state);
  });

  it('rejects a state carrying another game identity', () => {
    const state = demoEngine.createInitialState(
      { ...DEFAULT_DEMO_CONFIG },
      { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
    );
    const foreign = { ...(JSON.parse(JSON.stringify(state)) as object), gameType: 'werewolf' };
    expect(() => migratePersistedDemoState(foreign)).toThrow();
  });
});
