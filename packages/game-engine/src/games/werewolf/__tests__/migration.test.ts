/**
 * Persisted-state version gate.
 *
 * v10 is a hard cut: the display profile moved into the roster human
 * occupant and the by-user playerProfiles map was deleted. Payloads
 * below the current version are rejected, not migrated — old rooms are
 * not carried across a state-shape change, and the v5-v9 upgrade chain
 * was deleted with v10 (see state/version.ts). This suite pins the
 * gate: the current version passes through untouched; every older (or
 * newer) version is refused.
 */

import { GameStatus } from '../domain/models/GameStatus';
import { createTemplateFromRoles } from '../domain/models/Template';
import type { GameState } from '../domain/protocol/types';
import { gameReducer } from '../domain/reducer/gameReducer';
import { buildInitialGameState } from '../domain/state/buildInitialState';
import { migratePersistedWerewolfState, parseWerewolfState } from '../state/parseState';
import { WEREWOLF_STATE_VERSION } from '../state/version';

/** A started game in the current shape: 2 humans + 1 bot, roles assigned and viewed. */
function buildStartedState(): GameState {
  let state = buildInitialGameState(
    'ROOM',
    'host',
    createTemplateFromRoles(['wolf', 'seer', 'villager']),
  );
  state = gameReducer(state, {
    type: 'PLAYER_JOIN',
    payload: {
      seat: 0,
      occupant: { seat: 0, userId: 'host', profile: { displayName: '房主' } },
      player: { seat: 0, role: null, hasViewedRole: false },
    },
  });
  state = gameReducer(state, {
    type: 'PLAYER_JOIN',
    payload: {
      seat: 1,
      occupant: { seat: 1, userId: 'alice', profile: { displayName: 'Alice' } },
      player: { seat: 1, role: null, hasViewedRole: false },
    },
  });
  state = gameReducer(state, {
    type: 'FILL_WITH_BOTS',
    payload: {
      bots: { 2: { seat: 2, hasViewedRole: false } },
    },
  });
  // Assign roles and mark everyone as having viewed, as a started game would.
  state = {
    ...state,
    status: GameStatus.Ready,
    players: {
      0: { seat: 0, role: 'wolf', hasViewedRole: true },
      1: { seat: 1, role: 'seer', hasViewedRole: true },
      2: { seat: 2, role: 'villager', hasViewedRole: true },
    },
  };
  return parseWerewolfState(JSON.parse(JSON.stringify(state)));
}

/** Rebuilds the exact document a v9 store would have persisted for the same game. */
function downgradeToV9(state: GameState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  return {
    ...raw,
    stateVersion: 9,
    roster: {
      0: { seat: 0, userId: 'host' },
      1: { seat: 1, userId: 'alice' },
      2: { seat: 2, kind: 'bot' },
    },
    playerProfiles: {
      host: { displayName: '房主' },
      alice: { displayName: 'Alice' },
      'bot-2': { displayName: '机器人3号' },
    },
  };
}

function asStored(state: GameState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
}

describe('persisted state version gate (v10 hard cut)', () => {
  it('pins the current version at 10', () => {
    expect(WEREWOLF_STATE_VERSION).toBe(10);
    expect(buildStartedState().stateVersion).toBe(10);
  });

  it('passes a current-version payload through value-identical (identity baseline)', () => {
    const state = buildStartedState();
    const migrated = migratePersistedWerewolfState(asStored(state));
    expect(migrated).toEqual(state);
    expect(migrated.roster[0]).toEqual({
      seat: 0,
      userId: 'host',
      profile: { displayName: '房主' },
    });
    expect(migrated.roster[2]).toEqual({ seat: 2, kind: 'bot' });
  });

  it('keeps the serialized form string-identical across a parse round-trip', () => {
    // The room repository detects changes by comparing serialized
    // snapshots, so producer and parser key order must agree exactly —
    // the embedded profile subtree included.
    const serialized = JSON.stringify(buildStartedState());
    expect(JSON.stringify(parseWerewolfState(JSON.parse(serialized)))).toBe(serialized);
  });

  it('keeps a fully populated profile string-identical across a parse round-trip', () => {
    // Every optional profile field set: the serialized key order of the
    // whole profile subtree must survive the round-trip unchanged.
    const raw = asStored(buildStartedState());
    const roster = raw.roster as Record<string, { profile?: Record<string, unknown> }>;
    roster[0]!.profile = {
      displayName: '房主',
      avatarUrl: 'https://example.com/avatar.png',
      avatarFrame: 'gold',
      seatFlair: 'crown',
      seatAnimation: 'shine',
      nameStyle: 'gradient',
      revealEffect: 'flip',
      level: 7,
    };
    const serialized = JSON.stringify(parseWerewolfState(raw));
    expect(serialized).toContain(
      '"profile":{"displayName":"房主","avatarUrl":"https://example.com/avatar.png",' +
        '"avatarFrame":"gold","seatFlair":"crown","seatAnimation":"shine",' +
        '"nameStyle":"gradient","revealEffect":"flip","level":7}',
    );
    expect(JSON.stringify(parseWerewolfState(JSON.parse(serialized)))).toBe(serialized);
  });

  it('rejects a v9 payload (profiles still in the by-user map)', () => {
    const legacy = downgradeToV9(buildStartedState());
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 9',
    );
    expect(() => parseWerewolfState(legacy)).toThrow('GameState.stateVersion must be 10');
  });

  it('rejects a v5 payload (identity still embedded in the player record)', () => {
    const legacy = { ...asStored(buildStartedState()), stateVersion: 5 };
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 5',
    );
  });

  it('rejects a payload from a newer version', () => {
    const future = { ...asStored(buildStartedState()), stateVersion: 11 };
    expect(() => migratePersistedWerewolfState(future)).toThrow(
      'Unsupported werewolf state version: 11',
    );
  });

  it('rejects a current-version payload that still carries the dropped playerProfiles field', () => {
    const stored = {
      ...asStored(buildStartedState()),
      playerProfiles: { host: { displayName: '房主' } },
    };
    expect(() => migratePersistedWerewolfState(stored)).toThrow(
      'GameState contains unknown field: playerProfiles',
    );
    expect(() => parseWerewolfState(stored)).toThrow(
      'GameState contains unknown field: playerProfiles',
    );
  });

  it('rejects a current-version payload whose human occupant lacks the embedded profile', () => {
    const stored = asStored(buildStartedState());
    const roster = stored.roster as Record<string, Record<string, unknown>>;
    delete roster[0]!.profile;
    expect(() => parseWerewolfState(stored)).toThrow();
  });
});
