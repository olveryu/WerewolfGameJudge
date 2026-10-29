/**
 * Persisted-state version gate.
 *
 * v12 is a hard cut: the sheriff election voting phases gained the
 * settle-countdown deadline slot (v11 had moved the viewed record
 * out of the per-player hasViewedRole flag into the state-level
 * roleViewedSeats set; v10 had already moved the display profile
 * into the roster human occupant and deleted the by-user
 * playerProfiles map). Payloads below the current version are
 * rejected, not migrated — old rooms are not carried across a
 * state-shape change, and the v5-v9 upgrade chain was deleted with
 * v10 (see state/version.ts). This suite pins the gate: the current
 * version passes through untouched; every older (or newer) version
 * is refused.
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
      player: { seat: 0, role: null },
    },
  });
  state = gameReducer(state, {
    type: 'PLAYER_JOIN',
    payload: {
      seat: 1,
      occupant: { seat: 1, userId: 'alice', profile: { displayName: 'Alice' } },
      player: { seat: 1, role: null },
    },
  });
  state = gameReducer(state, {
    type: 'FILL_WITH_BOTS',
    payload: {
      bots: { 2: { seat: 2 } },
    },
  });
  // Assign roles and mark everyone as having viewed, as a started game would.
  state = {
    ...state,
    status: GameStatus.Ready,
    players: {
      0: { seat: 0, role: 'wolf' },
      1: { seat: 1, role: 'seer' },
      2: { seat: 2, role: 'villager' },
    },
    roleViewedSeats: [0, 1, 2],
  };
  return parseWerewolfState(JSON.parse(JSON.stringify(state)));
}

/** Rebuilds the exact document a v10 store would have persisted for the same game. */
function downgradeToV10(state: GameState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const players = raw.players as Record<string, Record<string, unknown>>;
  for (const player of Object.values(players)) {
    if (player !== null) player.hasViewedRole = true;
  }
  delete raw.roleViewedSeats;
  return { ...raw, stateVersion: 10 };
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

describe('persisted state version gate (v16, v12–v15 migrate)', () => {
  it('pins the current version at 16', () => {
    expect(WEREWOLF_STATE_VERSION).toBe(16);
    expect(buildStartedState().stateVersion).toBe(16);
  });

  it('migrates a v15 payload to v16 with the game sequence at 0', () => {
    const { gameSequence: _dropped, ...withoutSequence } = asStored(buildStartedState());
    const legacy = { ...withoutSequence, stateVersion: 15 };
    const migrated = migratePersistedWerewolfState(legacy);
    expect(migrated.stateVersion).toBe(16);
    expect(migrated.gameSequence).toBe(0);
    expect(parseWerewolfState(migrated)).toEqual(migrated);
  });

  it('rejects a current-version payload missing gameSequence', () => {
    const { gameSequence: _dropped, ...withoutSequence } = asStored(buildStartedState());
    expect(() => migratePersistedWerewolfState(withoutSequence)).toThrow('GameState.gameSequence');
  });

  it('migrates a v14 payload to v16 by dropping the user-addressed actionRejected', () => {
    const { gameSequence: _dropped, ...withoutSequence } = asStored(buildStartedState());
    const legacy = {
      ...withoutSequence,
      stateVersion: 14,
      actionRejected: {
        action: 'seerCheck',
        reason: 'blocked',
        targetUserId: 'alice',
        rejectionId: 'r1',
      },
    };
    const migrated = migratePersistedWerewolfState(legacy);
    expect(migrated.stateVersion).toBe(16);
    expect(migrated.actionRejected).toBeUndefined();
    expect(migrated.gameSequence).toBe(0);
    expect(parseWerewolfState(migrated)).toEqual(migrated);
  });

  it('rejects a current-version payload whose actionRejected is still user-addressed', () => {
    const stored = {
      ...asStored(buildStartedState()),
      actionRejected: {
        action: 'seerCheck',
        reason: 'blocked',
        targetUserId: 'alice',
        rejectionId: 'r1',
      },
    };
    expect(() => migratePersistedWerewolfState(stored)).toThrow(
      'GameState.actionRejected.targetSeat',
    );
  });

  it('migrates a v13 payload without audioBatchId to v16 with the batch id at 0', () => {
    const {
      audioBatchId: _dropped,
      gameSequence: _droppedSequence,
      ...withoutBatchId
    } = asStored(buildStartedState());
    const legacy = { ...withoutBatchId, stateVersion: 13 };
    const migrated = migratePersistedWerewolfState(legacy);
    expect(migrated.stateVersion).toBe(16);
    expect(migrated.audioBatchId).toBe(0);
    expect(parseWerewolfState(migrated)).toEqual(migrated);
  });

  it('migrates a v12 payload to v16 with the settled wolf target absent and the batch id at 0', () => {
    const {
      audioBatchId: _dropped,
      gameSequence: _droppedSequence,
      ...withoutBatchId
    } = asStored(buildStartedState());
    const legacy = { ...withoutBatchId, stateVersion: 12 };
    const migrated = migratePersistedWerewolfState(legacy);
    expect(migrated.stateVersion).toBe(16);
    expect(migrated.resolvedWolfKillTarget).toBeUndefined();
    expect(migrated.resolvedWolfKillVerdict).toBeUndefined();
    expect(migrated.audioBatchId).toBe(0);
    expect(parseWerewolfState(migrated)).toEqual(migrated);
  });

  it('rejects a current-version payload missing audioBatchId', () => {
    const { audioBatchId: _dropped, ...stored } = asStored(buildStartedState());
    expect(() => migratePersistedWerewolfState(stored)).toThrow(
      'GameState.audioBatchId must be a finite number',
    );
  });

  it('rejects a negative audioBatchId', () => {
    const stored = { ...asStored(buildStartedState()), audioBatchId: -1 };
    expect(() => migratePersistedWerewolfState(stored)).toThrow(
      'GameState.audioBatchId must be a non-negative integer',
    );
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

  it('rejects a v11 payload (sheriff voting phases have no deadline slot)', () => {
    const legacy = { ...asStored(buildStartedState()), stateVersion: 11 };
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 11',
    );
    expect(() => parseWerewolfState(legacy)).toThrow('GameState.stateVersion must be 16');
  });

  it('rejects a v10 payload (viewed record still a per-player flag)', () => {
    const legacy = downgradeToV10(buildStartedState());
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 10',
    );
    expect(() => parseWerewolfState(legacy)).toThrow('GameState.stateVersion must be 16');
  });

  it('rejects a v9 payload (profiles still in the by-user map)', () => {
    const legacy = downgradeToV9(buildStartedState());
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 9',
    );
    expect(() => parseWerewolfState(legacy)).toThrow('GameState.stateVersion must be 16');
  });

  it('rejects a v5 payload (identity still embedded in the player record)', () => {
    const legacy = { ...asStored(buildStartedState()), stateVersion: 5 };
    expect(() => migratePersistedWerewolfState(legacy)).toThrow(
      'Unsupported werewolf state version: 5',
    );
  });

  it('rejects a payload from a newer version', () => {
    const future = { ...asStored(buildStartedState()), stateVersion: 17 };
    expect(() => migratePersistedWerewolfState(future)).toThrow(
      'Unsupported werewolf state version: 17',
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

  it('rejects a current-version payload whose player still carries the dropped hasViewedRole flag', () => {
    const stored = asStored(buildStartedState());
    const players = stored.players as Record<string, Record<string, unknown>>;
    players[0]!.hasViewedRole = true;
    expect(() => parseWerewolfState(stored)).toThrow(
      'GameState.players.0 contains unknown field: hasViewedRole',
    );
  });

  it('rejects a current-version payload whose human occupant lacks the embedded profile', () => {
    const stored = asStored(buildStartedState());
    const roster = stored.roster as Record<string, Record<string, unknown>>;
    delete roster[0]!.profile;
    expect(() => parseWerewolfState(stored)).toThrow();
  });
});
